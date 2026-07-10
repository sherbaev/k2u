import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTransition } from "../src/alerts/alert-logic.ts";

const COOL = 60_000;

test("first observation: normal -> no alert", () => {
  const d = evaluateTransition(undefined, "NORMAL", 0, COOL);
  assert.equal(d.emit, false);
});

test("first observation: already critical -> alert", () => {
  const d = evaluateTransition(undefined, "CRITICAL", 0, COOL);
  assert.equal(d.emit, true);
  assert.equal(d.kind, "escalate");
});

test("same status -> no alert", () => {
  const d = evaluateTransition({ status: "WARNING", lastEmitAtMs: 0 }, "WARNING", 1000, COOL);
  assert.equal(d.emit, false);
  assert.equal(d.kind, "none");
});

test("escalation bypasses cooldown", () => {
  const d = evaluateTransition({ status: "WARNING", lastEmitAtMs: 1000 }, "CRITICAL", 1500, COOL);
  assert.equal(d.emit, true);
  assert.equal(d.kind, "escalate");
});

test("recovery within cooldown is suppressed", () => {
  const d = evaluateTransition({ status: "CRITICAL", lastEmitAtMs: 1000 }, "WARNING", 5000, COOL);
  assert.equal(d.emit, false);
  assert.equal(d.kind, "recover");
});

test("recovery after cooldown fires", () => {
  const d = evaluateTransition({ status: "WARNING", lastEmitAtMs: 1000 }, "NORMAL", 1000 + COOL + 1, COOL);
  assert.equal(d.emit, true);
  assert.equal(d.kind, "recover");
});
