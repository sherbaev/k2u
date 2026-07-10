import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFeatures, percentile } from "../src/predictions/feature-builder.ts";

test("percentile helper", () => {
  assert.ok(Math.abs(percentile([1, 2, 3, 4], 95) - 3.85) < 1e-9);
  assert.equal(percentile([], 95), 0);
  assert.equal(percentile([5], 50), 5);
});

test("builds 15 features with correct windowing", () => {
  const now = new Date("2026-06-30T00:00:00Z");
  const mk = (daysAgo: number, k2u: number, ex2 = 0, ex4 = 0) => ({
    ts: new Date(now.getTime() - daysAgo * 86400000).toISOString(),
    k2u_avg: k2u, k2u_max: k2u + 0.5, k2u_p95: k2u + 0.3,
    exceed_2pct_s: ex2, exceed_4pct_s: ex4, temp_mean: 45, temp_max: 60, load_factor: 0.7,
  });
  const aggs = [
    mk(1, 3.0, 600, 0),   // within 7d and 30d
    mk(5, 1.0, 0, 0),     // within 7d and 30d
    mk(20, 5.0, 3600, 1800), // within 30d only
    mk(40, 9.0, 9999, 9999), // outside both windows -> excluded
  ];
  const f = buildFeatures(aggs, { device_type: "pv_inverter", service_age: 6, rated_power: 10 }, now);

  // 7d window excludes the 20d and 40d rows -> mean of [3.0, 1.0] = 2.0
  assert.equal(f.k2u_mean_7d, 2.0);
  // 30d window includes first three (3,1,5) -> mean 3.0
  assert.equal(f.k2u_mean_30d, 3.0);
  // exposure sums over 30d only, in hours: (600+0+3600)/3600
  assert.ok(Math.abs(f.exposure_2pct_30d - (600 + 3600) / 3600) < 1e-9);
  assert.ok(Math.abs(f.exposure_4pct_30d - 1800 / 3600) < 1e-9);
  // k2u_max_30d = max(k2u_max) of first three = 5.5
  assert.equal(f.k2u_max_30d, 5.5);
  assert.equal(f.is_pv, 1);
  assert.equal(f.service_age, 6);
  assert.equal(f.rated_power, 10);
  // 40d row must be excluded from everything
  assert.ok(f.k2u_max_30d < 9);
  // cum_damage_index within clip
  assert.ok(f.cum_damage_index >= 0 && f.cum_damage_index <= 3.0);
  // all 15 numeric features finite
  for (const k of ["k2u_mean_7d","k2u_mean_30d","k2u_p95_7d","k2u_p95_30d","k2u_max_30d",
    "exposure_2pct_30d","exposure_4pct_30d","cum_damage_index","temp_mean_30d","temp_max_30d",
    "load_factor_mean_30d","thermal_cycles_30d","is_pv","service_age","rated_power"] as const) {
    assert.ok(Number.isFinite(f[k]), `${k} not finite`);
  }
});

test("empty aggregates -> zero stress, only nominal aging, no throw", () => {
  const f = buildFeatures([], { device_type: "telecom_rect", service_age: 2, rated_power: 5 });
  assert.equal(f.k2u_mean_30d, 0);
  assert.equal(f.is_pv, 0);
  // Zero unbalance still ages nominally: ~ service_age / L_nom (15y) ≈ 0.133.
  assert.ok(f.cum_damage_index >= 0 && f.cum_damage_index < 0.2);
  assert.equal(f.exposure_2pct_30d, 0);
});
