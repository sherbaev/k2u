import { k2uFromVoltages, lineFromPhaseNominal, classifyK2U } from "@k2u/core";

/**
 * Pure compute for a manually-entered or imported reading. Accepts either the
 * three line voltages (U_AB/U_BC/U_CA) or the three phase-neutral voltages
 * (U_A/U_B/U_C); in the latter case line voltages are reconstructed with nominal
 * 120° spacing (same as the firmware). Computes K2U + φ₂ + GOST status via the
 * shared k2u-core so manual data flows through the identical math as devices.
 */
export interface RawReading {
  u_a?: number; u_b?: number; u_c?: number;
  u_ab?: number; u_bc?: number; u_ca?: number;
}

export interface ComputedReading {
  ok: boolean;
  error?: string;
  u_a?: number; u_b?: number; u_c?: number;
  u_ab: number; u_bc: number; u_ca: number;
  k2u: number;
  phi2: number;
  status: "NORMAL" | "WARNING" | "CRITICAL";
}

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

export function computeReading(r: RawReading): ComputedReading {
  let uab = r.u_ab, ubc = r.u_bc, uca = r.u_ca;
  let ua = r.u_a, ub = r.u_b, uc = r.u_c;

  if (!(isNum(uab) && isNum(ubc) && isNum(uca))) {
    if (isNum(ua) && isNum(ub) && isNum(uc)) {
      const line = lineFromPhaseNominal(ua, ub, uc);
      uab = line.uab; ubc = line.ubc; uca = line.uca;
    } else {
      return { ok: false, error: "need all three line or all three phase voltages", uab: 0, ubc: 0, uca: 0, k2u: NaN, phi2: NaN, status: "CRITICAL" };
    }
  }

  const res = k2uFromVoltages(uab!, ubc!, uca!);
  if (!res.valid) {
    return { ok: false, error: "voltages do not form a valid triangle", uab: uab!, ubc: ubc!, uca: uca!, k2u: NaN, phi2: NaN, status: "CRITICAL" };
  }
  return {
    ok: true,
    u_a: ua, u_b: ub, u_c: uc,
    u_ab: uab!, u_bc: ubc!, u_ca: uca!,
    k2u: Number(res.k2u.toFixed(3)),
    phi2: Number(res.phi2.toFixed(1)),
    status: classifyK2U(res.k2u),
  };
}
