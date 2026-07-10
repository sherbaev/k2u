/**
 * TypeScript type definitions mirroring the JSON Schemas in ../schemas/.
 * These provide compile-time safety for the same payloads the schemas
 * validate at runtime. Keep field names, optionality, and ranges in sync
 * with the .schema.json files and the firmware validation logic.
 */

/** Device operating status. */
export type Status = "NORMAL" | "WARNING" | "CRITICAL";

/** Alert severity. */
export type AlertType = "WARNING" | "CRITICAL";

/** Recommended balancer action derived from a RUL prediction. */
export type BalancerNeed = "none" | "recommended" | "required";

/** Origin of a telemetry sample. */
export type Source = "device" | "manual" | "import";

/**
 * Payload published every ~10s by a K2U monitoring device.
 * Mirrors schemas/telemetry.schema.json.
 */
export interface Telemetry {
  /** ISO 8601 date-time. */
  ts: string;
  site_id: string;
  dev_id: string;
  /** Monotonic sequence number, >= 0. */
  seq: number;
  /** Phase A voltage, 0..500 V. */
  u_a?: number;
  /** Phase B voltage, 0..500 V. */
  u_b?: number;
  /** Phase C voltage, 0..500 V. */
  u_c?: number;
  /** Line voltage A-B, 0..600 V. */
  u_ab?: number;
  /** Line voltage B-C, 0..600 V. */
  u_bc?: number;
  /** Line voltage C-A, 0..600 V. */
  u_ca?: number;
  /** Voltage unbalance factor, 0..100 %. */
  k2u: number;
  /** Negative-sequence phase angle, 0..360 deg. */
  phi2?: number;
  /** Line frequency, 40..70 Hz. */
  freq?: number;
  /** Phase A current, >= 0 A. */
  i_a?: number;
  /** Phase B current, >= 0 A. */
  i_b?: number;
  /** Phase C current, >= 0 A. */
  i_c?: number;
  /** Device temperature, -40..150 deg C. */
  temp?: number;
  status: Status;
  /** Onboard buffer fill ratio, 0..1. */
  buf_fill?: number;
  /** Sample origin, defaults to "device". */
  source?: Source;
}

/**
 * 10-minute, RTC-aligned aggregate summary of telemetry.
 * Mirrors schemas/aggregate.schema.json.
 */
export interface Aggregate {
  ts: string;
  site_id: string;
  dev_id: string;
  /** Mean K2U over the window, 0..100 %. */
  k2u_avg?: number;
  /** Minimum K2U over the window, 0..100 %. */
  k2u_min?: number;
  /** Maximum K2U over the window, 0..100 %. */
  k2u_max?: number;
  /** 95th percentile K2U over the window, 0..100 %. */
  k2u_p95?: number;
  /** Seconds K2U exceeded 2%, >= 0. */
  exceed_2pct_s?: number;
  /** Seconds K2U exceeded 4%, >= 0. */
  exceed_4pct_s?: number;
  /** Mean temperature over the window, deg C. */
  temp_mean?: number;
  /** Max temperature over the window, deg C. */
  temp_max?: number;
  /** Load factor, 0..1. */
  load_factor?: number;
}

/**
 * Alert raised when a device crosses a WARNING or CRITICAL threshold.
 * Mirrors schemas/alert.schema.json.
 */
export interface Alert {
  ts: string;
  site_id: string;
  dev_id: string;
  type: AlertType;
  /** K2U value that triggered the alert, 0..100 %. */
  k2u: number;
  message?: string;
}

/**
 * Remaining-useful-life (RUL) prediction output.
 * Mirrors schemas/prediction.schema.json.
 */
export interface Prediction {
  ts: string;
  site_id: string;
  dev_id: string;
  /** Relative remaining resource, 0..1. */
  rul: number;
  /** Lower bound of the RUL confidence interval, 0..1. */
  rul_lo?: number;
  /** Upper bound of the RUL confidence interval, 0..1. */
  rul_hi?: number;
  /** Forecast K2U value, 0..100 %. */
  k2u_forecast?: number;
  balancer_need: BalancerNeed;
  /** Payback period for a balancer investment, years, >= 0. */
  payback?: number;
}
