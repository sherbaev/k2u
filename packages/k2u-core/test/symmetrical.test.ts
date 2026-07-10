import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ratiosFromEpsTheta,
  k2uFromVoltages,
  k2uBeta,
  lineFromPhaseNominal,
  classifyK2U,
} from "../src/symmetrical.ts";

test("balanced system -> K2U = 0%", () => {
  const r = k2uFromVoltages(380, 380, 380);
  assert.ok(r.valid);
  assert.ok(Math.abs(r.k2u) < 1e-9, `expected ~0, got ${r.k2u}`);
  assert.equal(r.status, "NORMAL");
  assert.ok(Math.abs(k2uBeta(380, 380, 380)) < 1e-6);
});

test("synthetic 2% case: forward then inverse recovers K2U", () => {
  // Build line voltages for eps=0.02 at several angles, scale to 380 V base.
  for (let deg = 0; deg < 360; deg += 17) {
    const theta = (deg * Math.PI) / 180;
    const f = ratiosFromEpsTheta(0.02, theta);
    const scale = 380;
    const r = k2uFromVoltages(f.uab * scale, f.ubc * scale, f.uca * scale);
    assert.ok(r.valid);
    assert.ok(
      Math.abs(r.k2u - 2.0) < 1e-6,
      `angle ${deg}: expected 2.00%, got ${r.k2u}`,
    );
  }
});

test("forward/inverse round-trip is consistent to ~machine precision", () => {
  for (const eps of [0.005, 0.02, 0.04, 0.08, 0.12]) {
    for (let deg = 0; deg < 360; deg += 11) {
      const theta = (deg * Math.PI) / 180;
      const f = ratiosFromEpsTheta(eps, theta);
      const r = k2uFromVoltages(f.uab, f.ubc, f.uca);
      assert.ok(r.valid, `eps=${eps} deg=${deg} invalid`);
      assert.ok(
        Math.abs(r.k2u - eps * 100) < 1e-7,
        `eps=${eps} deg=${deg}: got ${r.k2u}`,
      );
    }
  }
});

test("beta (RMS-only) agrees with complex method on magnitude", () => {
  for (const eps of [0.0, 0.01, 0.03, 0.05, 0.1]) {
    for (let deg = 0; deg < 360; deg += 23) {
      const theta = (deg * Math.PI) / 180;
      const f = ratiosFromEpsTheta(eps, theta);
      const complex = k2uFromVoltages(f.uab, f.ubc, f.uca).k2u;
      const beta = k2uBeta(f.uab, f.ubc, f.uca);
      assert.ok(
        Math.abs(complex - beta) < 1e-6,
        `eps=${eps} deg=${deg}: complex=${complex} beta=${beta}`,
      );
    }
  }
});

test("degenerate (non-triangle) magnitudes are rejected", () => {
  const r = k2uFromVoltages(380, 100, 100); // 100+100 < 380
  assert.equal(r.valid, false);
});

test("lineFromPhaseNominal: balanced phase -> equal line = phase*sqrt(3), K2U~0", () => {
  const { uab, ubc, uca } = lineFromPhaseNominal(220, 220, 220);
  const exp = 220 * Math.sqrt(3);
  assert.ok(Math.abs(uab - exp) < 1e-6 && Math.abs(ubc - exp) < 1e-6 && Math.abs(uca - exp) < 1e-6);
  assert.ok(k2uBeta(uab, ubc, uca) < 1e-4);
});

test("lineFromPhaseNominal: unbalanced phase -> nonzero K2U", () => {
  const { uab, ubc, uca } = lineFromPhaseNominal(230, 215, 220);
  assert.ok(k2uBeta(uab, ubc, uca) > 0.5);
});

test("GOST classification boundaries", () => {
  assert.equal(classifyK2U(1.5), "NORMAL");
  assert.equal(classifyK2U(2.0), "NORMAL");
  assert.equal(classifyK2U(3.0), "WARNING");
  assert.equal(classifyK2U(4.0), "WARNING");
  assert.equal(classifyK2U(5.0), "CRITICAL");
});
