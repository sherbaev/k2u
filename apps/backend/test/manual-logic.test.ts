import { test } from "node:test";
import assert from "node:assert/strict";
import { computeReading } from "../src/manual/manual-logic.ts";

test("line voltages balanced -> K2U ~0, NORMAL", () => {
  const c = computeReading({ u_ab: 380, u_bc: 380, u_ca: 380 });
  assert.equal(c.ok, true);
  assert.ok(c.k2u < 0.01);
  assert.equal(c.status, "NORMAL");
});

test("phase voltages balanced -> derives equal line voltages, K2U ~0", () => {
  const c = computeReading({ u_a: 220, u_b: 220, u_c: 220 });
  assert.equal(c.ok, true);
  assert.ok(Math.abs(c.u_ab - 220 * Math.sqrt(3)) < 1e-3);
  assert.ok(c.k2u < 0.01);
});

test("phase voltages unbalanced -> nonzero K2U", () => {
  const c = computeReading({ u_a: 230, u_b: 210, u_c: 220 });
  assert.equal(c.ok, true);
  assert.ok(c.k2u > 0.5);
  assert.ok(["NORMAL", "WARNING", "CRITICAL"].includes(c.status));
});

test("missing voltages -> not ok", () => {
  const c = computeReading({ u_a: 220, u_b: 220 });
  assert.equal(c.ok, false);
});

test("non-triangle line voltages -> not ok", () => {
  const c = computeReading({ u_ab: 380, u_bc: 100, u_ca: 100 });
  assert.equal(c.ok, false);
});
