import { test } from "node:test";
import assert from "node:assert/strict";
import { verdictFor } from "../src/compliance/compliance-logic.ts";

test("GOST weekly verdict boundaries", () => {
  assert.equal(verdictFor(1.5), "PASS");
  assert.equal(verdictFor(2.0), "PASS");
  assert.equal(verdictFor(2.01), "MARGINAL");
  assert.equal(verdictFor(4.0), "MARGINAL");
  assert.equal(verdictFor(4.01), "FAIL");
});
