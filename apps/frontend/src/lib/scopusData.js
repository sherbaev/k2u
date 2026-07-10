/**
 * Real results from the Scopus simulation study (apps/ai-service/train + the
 * paper's sim_summary1/2/3.json). Used by the Research page so the figures show
 * the actual published numbers, not mock data.
 */

// ---- Model accuracy (temporal test set) — sim_summary2.json ----
export const MODEL_METRICS = [
  { model: "XGB (no physics)", rmse: 0.330, mae: 0.263, r2: 0.148 },
  { model: "Linear", rmse: 0.315, mae: 0.255, r2: 0.225 },
  { model: "Physics-only", rmse: 0.287, mae: 0.228, r2: 0.356 },
  { model: "Random Forest", rmse: 0.277, mae: 0.217, r2: 0.400 },
  { model: "XGBoost (full)", rmse: 0.173, mae: 0.132, r2: 0.765 },
];

export const MODEL_BY_TYPE = [
  { type: "PV inverter", r2: 0.721 },
  { type: "Telecom rectifier", r2: 0.791 },
  { type: "Combined", r2: 0.765 },
];

// ---- Feature importance (gain) — sim_summary2.json ----
export const FEATURE_IMPORTANCE = [
  { feature: "cum_damage_index", gain: 0.352 },
  { feature: "exposure_2pct_30d", gain: 0.170 },
  { feature: "service_age", gain: 0.098 },
  { feature: "k2u_mean_30d", gain: 0.078 },
  { feature: "load_factor_mean_30d", gain: 0.073 },
  { feature: "exposure_4pct_30d", gain: 0.048 },
  { feature: "thermal_cycles_30d", gain: 0.038 },
  { feature: "rated_power", gain: 0.038 },
  { feature: "k2u_p95_7d", gain: 0.018 },
  { feature: "k2u_mean_7d", gain: 0.017 },
  { feature: "is_pv", gain: 0.016 },
  { feature: "k2u_p95_30d", gain: 0.016 },
  { feature: "temp_max_30d", gain: 0.015 },
  { feature: "k2u_max_30d", gain: 0.014 },
  { feature: "temp_mean_30d", gain: 0.007 },
];

// ---- Conformal prediction (CQR) — sim_summary3.json ----
export const CQR = {
  qhat: 0.0715,
  coverageBefore: 0.638,
  coverageAfter: 0.783,
  widthBefore: 0.641,
  widthAfter: 0.784,
  target: 0.8,
};

// ---- Balancer decision layer — sim_summary2.json ----
export const DECISION = {
  accuracy: 0.951,
  labels: ["none", "recommended", "required"],
  // confusion[trueLevel][predLevel]
  confusion: [
    [4324, 172, 0],
    [122, 1429, 3],
    [1, 1, 53],
  ],
  shareTrue: [0.736, 0.255, 0.009],
};

// ---- Fleet / measurement — sim_summary1.json ----
export const FLEET = {
  medianTFailPvYears: 20.25,
  medianTFailTelecomYears: 22.98,
  k2uP95Dist: { p25: 1.43, p50: 2.04, p75: 2.9, p95: 4.27 },
  // RMS β-method estimator error vs the exact symmetrical-components value:
  measurementRmsePct: { magnitudeOnly: 0.102, withAngleDeviation: 0.811 },
};

// ---- Physics model (Miner + Montsinger/Arrhenius) for interactive charts ----
export const PHYSICS = {
  TREF: 40, // °C, hotspot at which nominal life is reached
  params: {
    pv_inverter: { lNomYears: 12, kUnb: 1.6, dTloadMax: 22 },
    telecom_rect: { lNomYears: 15, kUnb: 1.2, dTloadMax: 18 },
  },
};

/** Hotspot temperature: ambient + load heating + unbalance heating (∝ k·K₂U²). */
export function hotspotTemp({ kUnb, tAmb, load, dTloadMax, k2u }) {
  return tAmb + dTloadMax * load * load + kUnb * k2u * k2u;
}

/** Montsinger life (years): halves per +10 °C above T_ref. */
export function lifeYears({ lNomYears, tHot, tRef = PHYSICS.TREF }) {
  return lNomYears * Math.pow(2, (tRef - tHot) / 10);
}

/**
 * Degradation trajectory: remaining useful life fraction vs years, for a device
 * type under a given K₂U / ambient / load regime. Interactive (recompute in JS).
 */
export function degradationCurve({ deviceType = "pv_inverter", k2u = 2, tAmb = 25, load = 0.6, years = 25, steps = 60 }) {
  const p = PHYSICS.params[deviceType] ?? PHYSICS.params.pv_inverter;
  const tHot = hotspotTemp({ kUnb: p.kUnb, tAmb, load, dTloadMax: p.dTloadMax, k2u });
  const L = Math.max(lifeYears({ lNomYears: p.lNomYears, tHot }), 0.1);
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const t = (years * i) / steps;
    out.push({ t: Number(t.toFixed(2)), rul: Math.max(0, 1 - t / L) });
  }
  return { data: out, lifeYears: L, tHot };
}
