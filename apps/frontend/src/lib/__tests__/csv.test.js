import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toReadings } from "../csv.js";

test("parses header row into object keys", () => {
  const text =
    "site_id,dev_id,ts,u_a,u_b,u_c,temp,load_factor\n" +
    "S1,D1,2026-07-10T00:00:00Z,231.2,229.8,230.5,24.1,0.62\n";
  const rows = parseCsv(text);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]), [
    "site_id",
    "dev_id",
    "ts",
    "u_a",
    "u_b",
    "u_c",
    "temp",
    "load_factor",
  ]);
});

test("coerces numeric-looking fields to Number", () => {
  const text = "u_a,u_b,u_c,temp,load_factor\n220,221,219.5,-3.2,0.5\n";
  const rows = parseCsv(text);
  assert.equal(typeof rows[0].u_a, "number");
  assert.equal(rows[0].u_a, 220);
  assert.equal(rows[0].u_c, 219.5);
  assert.equal(rows[0].temp, -3.2);
  assert.equal(rows[0].load_factor, 0.5);
});

test("keeps site_id, dev_id, ts as strings even when numeric-looking", () => {
  const text = "site_id,dev_id,ts\n001,002,1699999999\n";
  const rows = parseCsv(text);
  assert.equal(rows[0].site_id, "001");
  assert.equal(typeof rows[0].site_id, "string");
  assert.equal(rows[0].dev_id, "002");
  assert.equal(typeof rows[0].dev_id, "string");
  assert.equal(rows[0].ts, "1699999999");
  assert.equal(typeof rows[0].ts, "string");
});

test("ignores blank lines, including CRLF and trailing blanks", () => {
  const text = "site_id,dev_id\r\nS1,D1\r\n\r\nS2,D2\r\n\r\n";
  const rows = parseCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].site_id, "S1");
  assert.equal(rows[1].site_id, "S2");
});

test("strips surrounding double quotes from values without crashing", () => {
  const text = 'site_id,dev_id,u_a\n"S1","D1","231.5"\n';
  const rows = parseCsv(text);
  assert.equal(rows[0].site_id, "S1");
  assert.equal(rows[0].dev_id, "D1");
  assert.equal(rows[0].u_a, 231.5);
  assert.equal(typeof rows[0].u_a, "number");
});

test("tolerates missing trailing cells and ignores extra cells", () => {
  const text = "site_id,dev_id,ts,u_a\nS1,D1\nS2,D2,2026-01-01T00:00:00Z,220,999\n";
  const rows = parseCsv(text);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].site_id, "S1");
  assert.equal(rows[0].u_a, undefined);
  assert.equal(rows[1].u_a, 220);
  assert.equal(Object.keys(rows[1]).length, 4);
});

test("returns an empty array for empty or all-blank input", () => {
  assert.deepEqual(parseCsv(""), []);
  assert.deepEqual(parseCsv("\n\n\n"), []);
});

test("toReadings sets source:'import' and coerces phase voltages/temp/load_factor to numbers", () => {
  const rows = parseCsv(
    "site_id,dev_id,ts,u_a,u_b,u_c,temp,load_factor\n" +
      "S1,D1,2026-07-10T00:00:00Z,231.2,229.8,230.5,24.1,0.62\n",
  );
  const readings = toReadings(rows);
  assert.equal(readings.length, 1);
  const r = readings[0];
  assert.equal(r.source, "import");
  assert.equal(r.site_id, "S1");
  assert.equal(r.dev_id, "D1");
  assert.equal(typeof r.u_a, "number");
  assert.equal(r.u_a, 231.2);
  assert.equal(typeof r.temp, "number");
  assert.equal(typeof r.load_factor, "number");
});

test("toReadings coerces line-voltage fields too", () => {
  const rows = parseCsv("site_id,dev_id,u_ab,u_bc,u_ca\nS1,D1,380,381,379\n");
  const readings = toReadings(rows);
  assert.equal(readings[0].source, "import");
  assert.equal(typeof readings[0].u_ab, "number");
  assert.equal(readings[0].u_ab, 380);
  assert.equal(readings[0].u_bc, 381);
  assert.equal(readings[0].u_ca, 379);
});

test("toReadings drops undefined fields from missing cells", () => {
  const rows = parseCsv("site_id,dev_id,ts,u_a\nS1,D1\n");
  const readings = toReadings(rows);
  assert.equal("ts" in readings[0], false);
  assert.equal("u_a" in readings[0], false);
});
