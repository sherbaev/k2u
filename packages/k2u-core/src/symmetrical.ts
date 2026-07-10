/**
 * Symmetrical-components math for the negative-sequence voltage unbalance
 * factor K2U and its phase angle phi2.
 *
 * Ported from the proven standalone nomogram (`unbalance/index.html`) plus the
 * IEC 61000-4-30 RMS-only "beta" method used by the ESP32 firmware.
 *
 * Two independent K2U paths are provided and cross-checked in tests:
 *   1. k2uFromVoltages()  — full complex symmetrical-components (gives K2U + phi2)
 *   2. k2uBeta()          — RMS-only closed form (magnitude only, firmware path)
 *
 * All voltages are line-to-line magnitudes (U_AB, U_BC, U_CA).
 */

const TWO_PI_3 = (2 * Math.PI) / 3;

// ---- complex helpers ----
interface Complex {
  re: number;
  im: number;
}
const cMul = (a: Complex, b: Complex): Complex => ({
  re: a.re * b.re - a.im * b.im,
  im: a.re * b.im + a.im * b.re,
});
const cAbs = (a: Complex): number => Math.hypot(a.re, a.im);
const cArg = (a: Complex): number => Math.atan2(a.im, a.re);

const A: Complex = { re: -0.5, im: Math.sqrt(3) / 2 }; // e^{j120}
const A2: Complex = { re: -0.5, im: -Math.sqrt(3) / 2 }; // e^{-j120}

/** GOST 32144-2013 status against the 2 % / 4 % limits. */
export type UnbalanceStatus = "NORMAL" | "WARNING" | "CRITICAL";

export interface K2UResult {
  valid: boolean;
  /** K2U in percent (0..100). */
  k2u: number;
  /** phase angle of the negative-sequence component, degrees [0,360). */
  phi2: number;
  status: UnbalanceStatus;
}

export const GOST_NORMAL_PCT = 2.0;
export const GOST_MAX_PCT = 4.0;

/**
 * Forward map: given the unbalance magnitude eps (= K2U as a fraction, e.g.
 * 0.02 for 2 %) and the negative-sequence angle theta (radians), return the
 * line-voltage ratios and magnitudes for a unit positive sequence.
 * Used to generate iso-K2U curves and synthetic test cases.
 */
export function ratiosFromEpsTheta(
  eps: number,
  theta: number,
): { x: number; y: number; uab: number; ubc: number; uca: number } {
  const c0 = Math.cos(theta);
  const cm = Math.cos(theta - TWO_PI_3);
  const cp = Math.cos(theta + TWO_PI_3);
  const e2 = eps * eps;
  const uab = Math.sqrt(1 + 2 * eps * c0 + e2);
  const ubc = Math.sqrt(1 + 2 * eps * cm + e2);
  const uca = Math.sqrt(1 + 2 * eps * cp + e2);
  return { x: ubc / uab, y: uca / uab, uab, ubc, uca };
}

/**
 * Reconstruct line-voltage magnitudes from the three phase-neutral RMS
 * magnitudes assuming nominal 120° phase spacing. A magnitudes-only device
 * (or a manual reading of phase voltages) cannot know the true angles; this is
 * the same reconstruction the ESP32 firmware uses. Returns |U_AB|,|U_BC|,|U_CA|.
 */
export function lineFromPhaseNominal(
  ua: number,
  ub: number,
  uc: number,
): { uab: number; ubc: number; uca: number } {
  const bx = ub * Math.cos(-TWO_PI_3);
  const by = ub * Math.sin(-TWO_PI_3);
  const cx = uc * Math.cos(TWO_PI_3);
  const cy = uc * Math.sin(TWO_PI_3);
  return {
    uab: Math.hypot(ua - bx, 0 - by),
    ubc: Math.hypot(bx - cx, by - cy),
    uca: Math.hypot(cx - ua, cy - 0),
  };
}

/** Classify a K2U percentage against GOST 32144-2013 limits. */
export function classifyK2U(k2uPct: number): UnbalanceStatus {
  if (k2uPct <= GOST_NORMAL_PCT) return "NORMAL";
  if (k2uPct <= GOST_MAX_PCT) return "WARNING";
  return "CRITICAL";
}

/**
 * Inverse map (full complex): from the three line-voltage magnitudes recover
 * K2U (percent) and the negative-sequence phase angle phi2 (degrees).
 *
 * Places U_AB on the +real axis, closes the voltage triangle using the ABC
 * sequence convention (Im(U_BC) < 0), then takes symmetrical components.
 * Returns valid=false when the magnitudes cannot form a triangle.
 */
export function k2uFromVoltages(uab: number, ubc: number, uca: number): K2UResult {
  const invalid: K2UResult = { valid: false, k2u: NaN, phi2: NaN, status: "CRITICAL" };
  if (!(uab > 0) || !(ubc > 0) || !(uca > 0)) return invalid;
  // Triangle inequality
  if (uab + ubc <= uca || ubc + uca <= uab || uca + uab <= ubc) return invalid;

  const reBC = (uca * uca - uab * uab - ubc * ubc) / (2 * uab);
  const im2 = ubc * ubc - reBC * reBC;
  if (im2 < 0) return invalid;
  const imBC = -Math.sqrt(im2); // ABC sequence convention

  const UAB: Complex = { re: uab, im: 0 };
  const UBC: Complex = { re: reBC, im: imBC };
  const UCA: Complex = { re: -uab - reBC, im: -imBC };

  // U1 = (U_AB + a·U_BC + a²·U_CA) / 3
  const U1: Complex = {
    re: (UAB.re + cMul(A, UBC).re + cMul(A2, UCA).re) / 3,
    im: (UAB.im + cMul(A, UBC).im + cMul(A2, UCA).im) / 3,
  };
  // U2 = (U_AB + a²·U_BC + a·U_CA) / 3
  const U2: Complex = {
    re: (UAB.re + cMul(A2, UBC).re + cMul(A, UCA).re) / 3,
    im: (UAB.im + cMul(A2, UBC).im + cMul(A, UCA).im) / 3,
  };
  const m1 = cAbs(U1);
  const m2 = cAbs(U2);
  if (m1 === 0) return invalid;

  let phi2 = ((cArg(U2) - cArg(U1)) * 180) / Math.PI;
  while (phi2 < 0) phi2 += 360;
  while (phi2 >= 360) phi2 -= 360;

  const k2u = (m2 / m1) * 100;
  return { valid: true, k2u, phi2, status: classifyK2U(k2u) };
}

/**
 * RMS-only closed form (IEC 61000-4-30), the exact method the ESP32 firmware
 * runs. Magnitude only — no phase angle. Returns K2U in percent, or NaN when
 * the magnitudes are degenerate.
 *
 *   beta = (U_AB^4 + U_BC^4 + U_CA^4) / (U_AB^2 + U_BC^2 + U_CA^2)^2
 *   K2U  = sqrt((1 - sqrt(3 - 6·beta)) / (1 + sqrt(3 - 6·beta))) · 100 %
 */
export function k2uBeta(uab: number, ubc: number, uca: number): number {
  if (!(uab > 0) || !(ubc > 0) || !(uca > 0)) return NaN;
  const s2 = uab * uab + ubc * ubc + uca * uca;
  const s4 = uab ** 4 + ubc ** 4 + uca ** 4;
  let beta = s4 / (s2 * s2);
  // Clamp beta to its valid domain [1/3, 1/2) to guard float noise.
  if (beta < 1 / 3) beta = 1 / 3;
  if (beta >= 1 / 2) beta = 0.5 - 1e-12;
  const root = Math.sqrt(3 - 6 * beta);
  return Math.sqrt((1 - root) / (1 + root)) * 100;
}
