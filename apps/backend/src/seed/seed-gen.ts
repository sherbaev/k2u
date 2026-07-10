/**
 * Physics-based demo data generator (pure, no I/O) for 2 simulated ESP32 nodes,
 * ~2 months of history. Reproduces the Scopus/thesis regime: negative-sequence
 * unbalance K₂U with daily/weekly variation + AR(1) noise + occasional single-
 * phase excursions; Montsinger/Arrhenius thermal life for the RUL story.
 *
 * Deterministic (seeded RNG) so the demo is reproducible.
 */
import { lineFromPhaseNominal, k2uFromVoltages } from "@k2u/core";

// ---- small deterministic RNG (mulberry32) ----
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

export interface SeedDeviceSpec {
  siteId: string;
  siteName: string;
  devId: string;
  name: string;
  deviceType: "pv_inverter" | "telecom_rect";
  ratedPower: number;
  serviceAge: number;
  location: { lat: number; lon: number; address: string };
  baseK2u: number; // baseline unbalance %
  seed: number;
}

export const DEMO_DEVICES: SeedDeviceSpec[] = [
  {
    siteId: "UZ-PV-01", siteName: "Jizzakh Rooftop PV",
    devId: "K2U-PV-01", name: "Rooftop PV Inverter A",
    deviceType: "pv_inverter", ratedPower: 10, serviceAge: 6,
    location: { lat: 40.115, lon: 67.842, address: "Jizzakh, UZ" },
    baseK2u: 1.5, seed: 1013,
  },
  {
    siteId: "UZ-TC-01", siteName: "Samarkand Telecom Tower",
    devId: "K2U-TC-01", name: "Telecom Tower Rectifier",
    deviceType: "telecom_rect", ratedPower: 15, serviceAge: 4,
    location: { lat: 39.654, lon: 66.959, address: "Samarkand, UZ" },
    baseK2u: 2.4, seed: 7727,
  },
];

const DAY = 86_400_000;
const TEN_MIN = 600_000;

export interface AggPoint {
  ts: Date;
  k2u_avg: number; k2u_min: number; k2u_max: number; k2u_p95: number;
  exceed_2pct_s: number; exceed_4pct_s: number;
  temp_mean: number; temp_max: number; load_factor: number;
}
export interface TelemetryPoint {
  ts: Date; u_a: number; u_b: number; u_c: number;
  u_ab: number; u_bc: number; u_ca: number;
  k2u: number; phi2: number; temp: number; status: string;
}

function classify(k: number): string {
  return k <= 2 ? "NORMAL" : k <= 4 ? "WARNING" : "CRITICAL";
}

/** Generate one device's K₂U/temp/load series at 10-min resolution over `days`. */
export function generateSeries(spec: SeedDeviceSpec, days: number, now: number) {
  const r = rng(spec.seed);
  const n = Math.floor((days * DAY) / TEN_MIN);
  const isPv = spec.deviceType === "pv_inverter";
  const dailyAmp = (isPv ? 0.45 : 0.3) * spec.baseK2u;
  const weeklyAmp = 0.18 * spec.baseK2u;
  const noiseSig = 0.18 * spec.baseK2u;
  const phi = 0.9;

  const agg: AggPoint[] = [];
  let noise = 0;
  // pre-schedule a few excursions (single-phase load switching)
  const excursions: Array<{ start: number; len: number; amp: number }> = [];
  const nEv = 4 + Math.floor(r() * 5);
  for (let e = 0; e < nEv; e++) {
    excursions.push({ start: Math.floor(r() * n), len: 6 + Math.floor(r() * 30), amp: 0.6 + r() * 2.2 });
  }

  for (let i = 0; i < n; i++) {
    const ts = new Date(now - (n - i) * TEN_MIN);
    const dayFrac = ((ts.getTime() / DAY) % 1 + 1) % 1;
    const weekFrac = ((ts.getTime() / (7 * DAY)) % 1 + 1) % 1;
    const hour = dayFrac * 24;

    noise = phi * noise + noiseSig * Math.sqrt(1 - phi * phi) * gauss(r);
    let k2u =
      spec.baseK2u +
      dailyAmp * Math.sin(2 * Math.PI * dayFrac + (isPv ? -1.2 : 0.4)) +
      weeklyAmp * Math.sin(2 * Math.PI * weekFrac) +
      noise;
    for (const ex of excursions) if (i >= ex.start && i < ex.start + ex.len) k2u += ex.amp;
    k2u = Math.min(Math.max(k2u, 0.05), 8);

    // temperature & load
    const doy = (ts.getTime() / DAY) % 365;
    const tAmb = (isPv ? 16 : 18) + (isPv ? 14 : 10) * Math.sin((2 * Math.PI * (doy - 100)) / 365) +
      (isPv ? 8 : 5) * Math.sin(2 * Math.PI * dayFrac - Math.PI / 2);
    const load = isPv
      ? Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) * (0.65 + 0.2 * r())
      : Math.min(1, Math.max(0.2, 0.6 + 0.08 * Math.sin(2 * Math.PI * dayFrac) + 0.02 * gauss(r)));
    const dTload = (isPv ? 22 : 18) * load * load;
    const temp = tAmb + dTload + (isPv ? 1.6 : 1.2) * k2u * k2u * 0.15;

    agg.push({
      ts,
      k2u_avg: round(k2u, 3),
      k2u_min: round(Math.max(0.05, k2u - 0.2 - 0.2 * r()), 3),
      k2u_max: round(k2u + 0.2 + 0.3 * r(), 3),
      k2u_p95: round(k2u + 0.25, 3),
      exceed_2pct_s: k2u >= 2 ? 600 : 0,
      exceed_4pct_s: k2u >= 4 ? 600 : 0,
      temp_mean: round(temp, 1),
      temp_max: round(temp + 1.5 + r(), 1),
      load_factor: round(load, 3),
    });
  }
  return agg;
}

/** Recent telemetry (last `hours`) at 10-min resolution, from the tail regime. */
export function recentTelemetry(spec: SeedDeviceSpec, agg: AggPoint[], hours: number): TelemetryPoint[] {
  const count = Math.min(agg.length, Math.floor((hours * 3600 * 1000) / TEN_MIN));
  const tail = agg.slice(-count);
  const base = 226; // nominal phase-neutral volts
  const r = rng(spec.seed + 99);
  return tail.map((a) => {
    // pick phase voltages that reproduce ~a.k2u_avg (search a small unbalance)
    const eps = a.k2u_avg / 100;
    const ua = base * (1 + eps * 0.9);
    const ub = base * (1 - eps * 0.5 + 0.001 * gauss(r));
    const uc = base * (1 - eps * 0.4);
    const line = lineFromPhaseNominal(ua, ub, uc);
    const res = k2uFromVoltages(line.uab, line.ubc, line.uca);
    return {
      ts: a.ts, u_a: round(ua, 1), u_b: round(ub, 1), u_c: round(uc, 1),
      u_ab: round(line.uab, 1), u_bc: round(line.ubc, 1), u_ca: round(line.uca, 1),
      k2u: round(res.valid ? res.k2u : a.k2u_avg, 3),
      phi2: round(res.valid ? res.phi2 : 180, 1),
      temp: a.temp_mean, status: classify(a.k2u_avg),
    };
  });
}

/** Weekly GOST compliance rollup from the aggregates. */
export function weeklyCompliance(agg: AggPoint[]) {
  const byWeek = new Map<number, AggPoint[]>();
  for (const a of agg) {
    const wk = Math.floor(a.ts.getTime() / (7 * DAY));
    (byWeek.get(wk) ?? byWeek.set(wk, []).get(wk)!).push(a);
  }
  const out: Array<{ weekStart: Date; k2u_p95: number; exceed_2pct_s: number; exceed_4pct_s: number; verdict: string }> = [];
  for (const [wk, rows] of [...byWeek.entries()].sort((a, b) => a[0] - b[0])) {
    const p95s = rows.map((x) => x.k2u_p95).sort((a, b) => a - b);
    const p95 = percentile(p95s, 95);
    out.push({
      weekStart: new Date(wk * 7 * DAY),
      k2u_p95: round(p95, 3),
      exceed_2pct_s: rows.reduce((s, x) => s + x.exceed_2pct_s, 0),
      exceed_4pct_s: rows.reduce((s, x) => s + x.exceed_4pct_s, 0),
      verdict: p95 <= 2 ? "PASS" : p95 <= 4 ? "MARGINAL" : "FAIL",
    });
  }
  return out;
}

/** Generate one fresh (telemetry, aggregate) point "now" for the live simulator. */
export function generateOnePoint(
  spec: Pick<SeedDeviceSpec, "deviceType" | "baseK2u" | "seed">,
  now: number,
): { telemetry: TelemetryPoint; aggregate: AggPoint } {
  const r = rng(spec.seed + Math.floor(now / 3_600_000)); // varies per hour
  const isPv = spec.deviceType === "pv_inverter";
  const dayFrac = ((now / DAY) % 1 + 1) % 1;
  const hour = dayFrac * 24;
  const dailyAmp = (isPv ? 0.45 : 0.3) * spec.baseK2u;
  let k2u = spec.baseK2u + dailyAmp * Math.sin(2 * Math.PI * dayFrac + (isPv ? -1.2 : 0.4)) + 0.18 * spec.baseK2u * gauss(r);
  if (r() < 0.06) k2u += 0.6 + r() * 2.0; // rare excursion
  k2u = Math.min(Math.max(k2u, 0.05), 8);

  const doy = (now / DAY) % 365;
  const tAmb = (isPv ? 16 : 18) + (isPv ? 14 : 10) * Math.sin((2 * Math.PI * (doy - 100)) / 365) +
    (isPv ? 8 : 5) * Math.sin(2 * Math.PI * dayFrac - Math.PI / 2);
  const load = isPv ? Math.max(0, Math.sin((Math.PI * (hour - 6)) / 12)) * (0.65 + 0.2 * r())
    : Math.min(1, Math.max(0.2, 0.6 + 0.08 * Math.sin(2 * Math.PI * dayFrac)));
  const temp = tAmb + (isPv ? 22 : 18) * load * load + (isPv ? 1.6 : 1.2) * k2u * k2u * 0.15;
  const ts = new Date(now);

  const base = 226;
  const eps = k2u / 100;
  const ua = base * (1 + eps * 0.9), ub = base * (1 - eps * 0.5), uc = base * (1 - eps * 0.4);
  const line = lineFromPhaseNominal(ua, ub, uc);
  const res = k2uFromVoltages(line.uab, line.ubc, line.uca);
  const k = res.valid ? res.k2u : k2u;

  return {
    telemetry: {
      ts, u_a: r2(ua), u_b: r2(ub), u_c: r2(uc),
      u_ab: r2(line.uab), u_bc: r2(line.ubc), u_ca: r2(line.uca),
      k2u: r3(k), phi2: r1(res.valid ? res.phi2 : 180), temp: r1(temp), status: classify(k),
    },
    aggregate: {
      ts, k2u_avg: r3(k2u), k2u_min: r3(Math.max(0.05, k2u - 0.3)), k2u_max: r3(k2u + 0.3), k2u_p95: r3(k2u + 0.25),
      exceed_2pct_s: k2u >= 2 ? 600 : 0, exceed_4pct_s: k2u >= 4 ? 600 : 0,
      temp_mean: r1(temp), temp_max: r1(temp + 2), load_factor: r3(load),
    },
  };
}
const r1 = (v: number) => Math.round(v * 10) / 10;
const r2 = (v: number) => Math.round(v * 100) / 100;
const r3 = (v: number) => Math.round(v * 1000) / 1000;

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? sorted[lo]! : sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

function round(v: number, d: number): number {
  const f = Math.pow(10, d);
  return Math.round(v * f) / f;
}
