/**
 * Pure GOST 32144-2013 compliance report model + CSV serialization.
 * No DOM / no libraries — unit-tested. The PDF/ZIP wrappers render this model.
 */

/** Seconds -> "2h 05m" (or "0m"). */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/** GOST verdict from a K₂U 95-percentile (%). */
export function verdictFor(k2uP95) {
  if (k2uP95 <= 2.0) return "PASS";
  if (k2uP95 <= 4.0) return "MARGINAL";
  return "FAIL";
}

const RANK = { PASS: 0, MARGINAL: 1, FAIL: 2 };
const WORST = ["PASS", "MARGINAL", "FAIL"];

/**
 * Build the structured report from weekly compliance rows.
 * input: { site:{siteId,name,type}, device:{devId}, from, to, compliance:[
 *   { weekStart, k2u_p95, exceed_2pct_s, exceed_4pct_s, verdict? } ] }
 */
export function buildReport(input) {
  const site = input.site || {};
  const device = input.device || {};
  const rows = (input.compliance || [])
    .slice()
    .sort((a, b) => new Date(a.weekStart) - new Date(b.weekStart))
    .map((r) => {
      const p95 = Number(r.k2u_p95) || 0;
      const verdict = r.verdict || verdictFor(p95);
      return {
        weekStart: r.weekStart,
        k2u_p95: p95,
        exceed_2pct_s: Number(r.exceed_2pct_s) || 0,
        exceed_4pct_s: Number(r.exceed_4pct_s) || 0,
        exceed_2pct: formatDuration(r.exceed_2pct_s),
        exceed_4pct: formatDuration(r.exceed_4pct_s),
        verdict,
      };
    });

  const worstP95 = rows.reduce((m, r) => Math.max(m, r.k2u_p95), 0);
  let overall = "PASS";
  for (const r of rows) if (RANK[r.verdict] > RANK[overall]) overall = r.verdict;

  const summary = {
    weeks: rows.length,
    worstP95,
    weeksPass: rows.filter((r) => r.verdict === "PASS").length,
    weeksMarginal: rows.filter((r) => r.verdict === "MARGINAL").length,
    weeksFail: rows.filter((r) => r.verdict === "FAIL").length,
    totalExceed2s: rows.reduce((a, r) => a + r.exceed_2pct_s, 0),
    totalExceed4s: rows.reduce((a, r) => a + r.exceed_4pct_s, 0),
    overallVerdict: rows.length ? overall : "N/A",
  };
  summary.totalExceed2 = formatDuration(summary.totalExceed2s);
  summary.totalExceed4 = formatDuration(summary.totalExceed4s);

  return {
    title: "GOST 32144-2013 Voltage Unbalance Compliance Report",
    generatedAt: new Date().toISOString(),
    siteId: site.siteId || "",
    siteName: site.name || "",
    siteType: site.type || "",
    devId: device.devId || "",
    from: input.from || "",
    to: input.to || "",
    rows,
    summary,
  };
}

/** Serialize a report's weekly rows to CSV. */
export function toCsv(report) {
  const head = ["week_start", "k2u_p95_pct", "exceed_2pct_s", "exceed_4pct_s", "verdict"];
  const lines = [head.join(",")];
  for (const r of report.rows) {
    lines.push([
      new Date(r.weekStart).toISOString(),
      r.k2u_p95.toFixed(3),
      r.exceed_2pct_s,
      r.exceed_4pct_s,
      r.verdict,
    ].join(","));
  }
  return lines.join("\r\n") + "\r\n";
}
