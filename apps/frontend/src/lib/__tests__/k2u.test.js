import { test } from "node:test";
import assert from "node:assert/strict";
import { ratiosFromEpsTheta, k2uFromVoltages, classifyK2U, lineFromPhaseNominal } from "../k2u.js";
import { dataToSvg, svgToData } from "../geometry.js";

test("mirror matches core: balanced -> 0%", () => {
  const r = k2uFromVoltages(380, 380, 380);
  assert.ok(r.valid);
  assert.ok(Math.abs(r.k2u) < 1e-9);
  assert.equal(r.status, "NORMAL");
});

test("mirror matches core: forward/inverse round-trip <1e-7", () => {
  for (const eps of [0.005, 0.02, 0.04, 0.1]) {
    for (let deg = 0; deg < 360; deg += 13) {
      const f = ratiosFromEpsTheta(eps, (deg * Math.PI) / 180);
      const r = k2uFromVoltages(f.uab, f.ubc, f.uca);
      assert.ok(r.valid);
      assert.ok(Math.abs(r.k2u - eps * 100) < 1e-7, `eps=${eps} deg=${deg} -> ${r.k2u}`);
    }
  }
});

test("GOST classification boundaries", () => {
  assert.equal(classifyK2U(2.0), "NORMAL");
  assert.equal(classifyK2U(3.0), "WARNING");
  assert.equal(classifyK2U(4.01), "CRITICAL");
});

test("lineFromPhaseNominal matches core (balanced + unbalanced)", () => {
  const b = lineFromPhaseNominal(220, 220, 220);
  assert.ok(Math.abs(b.uab - 220 * Math.sqrt(3)) < 1e-6);
  const u = lineFromPhaseNominal(230, 215, 220);
  assert.ok(k2uFromVoltages(u.uab, u.ubc, u.uca).k2u > 0.5);
});

test("geometry dataToSvg/svgToData round-trip", () => {
  for (const [x, y] of [[1, 1], [0.9, 1.1], [1.05, 0.95], [0.84, 1.16]]) {
    const [sx, sy] = dataToSvg(x, y);
    const [rx, ry] = svgToData(sx, sy);
    assert.ok(Math.abs(rx - x) < 1e-9 && Math.abs(ry - y) < 1e-9);
  }
});

test("balance point maps to plot center", () => {
  const [sx, sy] = dataToSvg(1, 1);
  assert.ok(Math.abs(sx - 380) < 1e-6 && Math.abs(sy - 380) < 1e-6);
});
