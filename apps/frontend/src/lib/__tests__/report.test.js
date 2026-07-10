import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport, toCsv, formatDuration, verdictFor } from "../report.js";

test("formatDuration", () => {
  assert.equal(formatDuration(0), "0m");
  assert.equal(formatDuration(65), "1m");
  assert.equal(formatDuration(3600), "1h 00m");
  assert.equal(formatDuration(7530), "2h 05m");
});

test("verdictFor boundaries", () => {
  assert.equal(verdictFor(2.0), "PASS");
  assert.equal(verdictFor(3.0), "MARGINAL");
  assert.equal(verdictFor(4.01), "FAIL");
});

const sample = {
  site: { siteId: "UZ-PV-01", name: "PV Site", type: "pv" },
  device: { devId: "K2U-02" },
  from: "2026-05-01",
  to: "2026-06-01",
  compliance: [
    { weekStart: "2026-05-15", k2u_p95: 1.6, exceed_2pct_s: 0, exceed_4pct_s: 0 },
    { weekStart: "2026-05-01", k2u_p95: 3.2, exceed_2pct_s: 3600, exceed_4pct_s: 0 },
    { weekStart: "2026-05-08", k2u_p95: 4.5, exceed_2pct_s: 7530, exceed_4pct_s: 1800 },
  ],
};

test("buildReport sorts weeks, derives verdicts, computes summary", () => {
  const r = buildReport(sample);
  // sorted ascending by weekStart
  assert.deepEqual(r.rows.map((x) => x.weekStart), ["2026-05-01", "2026-05-08", "2026-05-15"]);
  // derived verdicts
  assert.deepEqual(r.rows.map((x) => x.verdict), ["MARGINAL", "FAIL", "PASS"]);
  // overall = worst = FAIL
  assert.equal(r.summary.overallVerdict, "FAIL");
  assert.equal(r.summary.worstP95, 4.5);
  assert.equal(r.summary.weeksPass, 1);
  assert.equal(r.summary.weeksMarginal, 1);
  assert.equal(r.summary.weeksFail, 1);
  // durations formatted
  assert.equal(r.rows[1].exceed_2pct, "2h 05m");
  assert.equal(r.summary.totalExceed2, formatDuration(3600 + 7530));
});

test("empty compliance -> N/A verdict, no throw", () => {
  const r = buildReport({ site: {}, device: {}, compliance: [] });
  assert.equal(r.summary.overallVerdict, "N/A");
  assert.equal(r.rows.length, 0);
});

test("toCsv has header + one line per week", () => {
  const csv = toCsv(buildReport(sample));
  const lines = csv.trim().split("\r\n");
  assert.equal(lines[0], "week_start,k2u_p95_pct,exceed_2pct_s,exceed_4pct_s,verdict");
  assert.equal(lines.length, 4); // header + 3 weeks
  assert.ok(lines[1].includes("MARGINAL"));
});
