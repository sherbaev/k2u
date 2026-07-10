import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/auth/auth-crypto.ts";

test("hash then verify round-trips", () => {
  const stored = hashPassword("s3cret-pass");
  assert.ok(stored.startsWith("scrypt$"));
  assert.equal(verifyPassword("s3cret-pass", stored), true);
});

test("wrong password fails", () => {
  const stored = hashPassword("correct-horse");
  assert.equal(verifyPassword("battery-staple", stored), false);
});

test("distinct salts -> distinct hashes for same password", () => {
  const a = hashPassword("same");
  const b = hashPassword("same");
  assert.notEqual(a, b);
  assert.ok(verifyPassword("same", a) && verifyPassword("same", b));
});

test("malformed stored value is rejected", () => {
  assert.equal(verifyPassword("x", "not-a-valid-hash"), false);
  assert.equal(verifyPassword("x", "bcrypt$salt$hash"), false);
});
