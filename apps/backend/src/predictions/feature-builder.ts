/**
 * Pure feature engineering: roll a device's recent 10-minute aggregates into the
 * 15 RUL model features (paper Table 4.1). No I/O — unit-testable.
 *
 * Directly measured features come from the aggregates; `cum_damage_index` and
 * `thermal_cycles_30d` use documented physics proxies (the real platform
 * accumulates damage continuously from telemetry — see ai-service physics model).
 */
export interface AggRow {
  ts: string | Date;
  k2u_avg?: number;
  k2u_max?: number;
  k2u_p95?: number;
  exceed_2pct_s?: number;
  exceed_4pct_s?: number;
  temp_mean?: number;
  temp_max?: number;
  load_factor?: number;
}

export interface DeviceMeta {
  device_type: "pv_inverter" | "telecom_rect" | string;
  service_age: number; // years
  rated_power: number; // kW
}

export interface RulFeatures {
  k2u_mean_7d: number; k2u_mean_30d: number;
  k2u_p95_7d: number; k2u_p95_30d: number; k2u_max_30d: number;
  exposure_2pct_30d: number; exposure_4pct_30d: number;
  cum_damage_index: number;
  temp_mean_30d: number; temp_max_30d: number;
  load_factor_mean_30d: number; thermal_cycles_30d: number;
  is_pv: number; service_age: number; rated_power: number;
  device_type: string; siteId?: string; devId?: string;
}

const DAY = 86_400_000;

export function percentile(values: number[], p: number): number {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return 0;
  const idx = (p / 100) * (v.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return v[lo]!;
  return v[lo]! + (v[hi]! - v[lo]!) * (idx - lo);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const num = (x: number | undefined) => (Number.isFinite(x as number) ? (x as number) : 0);

export function buildFeatures(
  aggregates: AggRow[],
  meta: DeviceMeta,
  now: Date = new Date(),
): RulFeatures {
  const nowMs = now.getTime();
  const within = (rows: AggRow[], days: number) =>
    rows.filter((r) => nowMs - new Date(r.ts).getTime() <= days * DAY);

  const w7 = within(aggregates, 7);
  const w30 = within(aggregates, 30);

  const k2uAvg7 = w7.map((r) => num(r.k2u_avg));
  const k2uAvg30 = w30.map((r) => num(r.k2u_avg));
  const k2uP95src7 = w7.map((r) => num(r.k2u_p95 ?? r.k2u_avg));
  const k2uP95src30 = w30.map((r) => num(r.k2u_p95 ?? r.k2u_avg));

  const isPv = meta.device_type === "pv_inverter" ? 1 : 0;

  const k2u_mean_30d = mean(k2uAvg30);
  const temp_mean_30d = mean(w30.map((r) => num(r.temp_mean)));
  const temp_max_30d = w30.length ? Math.max(...w30.map((r) => num(r.temp_max))) : 0;

  // Physics proxy for cumulative damage: Montsinger life-loss rate integrated
  // over service age from mean stress. Approximate; real system accumulates from
  // telemetry. dT ≈ k·K2U^2 + thermal offset; damage ∝ 2^(dT/10).
  const kUnb = isPv ? 1.6 : 1.2;
  const dT = kUnb * k2u_mean_30d ** 2 + Math.max(0, temp_mean_30d - 40) ;
  const annualDamageProxy = Math.pow(2, dT / 10) / (isPv ? 12 : 15);
  const cum_damage_index = Math.min(annualDamageProxy * Math.max(meta.service_age, 0), 3.0);

  return {
    k2u_mean_7d: mean(k2uAvg7),
    k2u_mean_30d,
    k2u_p95_7d: percentile(k2uP95src7, 95),
    k2u_p95_30d: percentile(k2uP95src30, 95),
    k2u_max_30d: w30.length ? Math.max(...w30.map((r) => num(r.k2u_max))) : 0,
    exposure_2pct_30d: sum(w30.map((r) => num(r.exceed_2pct_s))) / 3600,
    exposure_4pct_30d: sum(w30.map((r) => num(r.exceed_4pct_s))) / 3600,
    cum_damage_index,
    temp_mean_30d,
    temp_max_30d,
    load_factor_mean_30d: mean(w30.map((r) => num(r.load_factor))),
    // Proxy: count distinct days present in the 30d window (no per-cycle data here).
    thermal_cycles_30d: new Set(w30.map((r) => new Date(r.ts).toISOString().slice(0, 10))).size,
    is_pv: isPv,
    service_age: meta.service_age,
    rated_power: meta.rated_power,
    device_type: meta.device_type,
  };
}
