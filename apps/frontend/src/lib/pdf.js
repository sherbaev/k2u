/**
 * GOST compliance PDF rendering via jsPDF. Thin layer over the tested report
 * model in ./report.js (manual table layout — no autotable plugin needed).
 */
import { jsPDF } from "jspdf";

const VERDICT_COLOR = {
  PASS: [46, 125, 50],
  MARGINAL: [237, 108, 2],
  FAIL: [211, 47, 47],
  "N/A": [120, 120, 120],
};

export function renderCompliancePdf(report) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  let y = 54;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(report.title, M, y);
  y += 22;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    `Site: ${report.siteName || report.siteId} (${report.siteType})   Device: ${report.devId}`,
    `Period: ${report.from} — ${report.to}`,
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
  ];
  for (const line of meta) { doc.text(line, M, y); y += 15; }
  y += 6;

  // Overall verdict badge
  const ov = report.summary.overallVerdict;
  const c = VERDICT_COLOR[ov] || VERDICT_COLOR["N/A"];
  doc.setFont("helvetica", "bold");
  doc.setTextColor(c[0], c[1], c[2]);
  doc.text(`Overall verdict: ${ov}   (worst weekly K2U p95: ${report.summary.worstP95.toFixed(2)}%)`, M, y);
  doc.setTextColor(0, 0, 0);
  y += 22;

  // Table header
  const cols = [
    { h: "Week start", x: M, w: 120 },
    { h: "K2U p95 %", x: M + 130, w: 70 },
    { h: "≥2% time", x: M + 210, w: 80 },
    { h: "≥4% time", x: M + 300, w: 80 },
    { h: "Verdict", x: M + 390, w: 80 },
  ];
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  for (const col of cols) doc.text(col.h, col.x, y);
  y += 4;
  doc.setDrawColor(200);
  doc.line(M, y, M + 470, y);
  y += 14;

  doc.setFont("helvetica", "normal");
  for (const r of report.rows) {
    if (y > 780) { doc.addPage(); y = 54; }
    const week = new Date(r.weekStart).toISOString().slice(0, 10);
    doc.text(week, cols[0].x, y);
    doc.text(r.k2u_p95.toFixed(2), cols[1].x, y);
    doc.text(r.exceed_2pct, cols[2].x, y);
    doc.text(r.exceed_4pct, cols[3].x, y);
    const vc = VERDICT_COLOR[r.verdict] || [0, 0, 0];
    doc.setTextColor(vc[0], vc[1], vc[2]);
    doc.text(r.verdict, cols[4].x, y);
    doc.setTextColor(0, 0, 0);
    y += 15;
  }
  if (report.rows.length === 0) { doc.text("No data for the selected period.", M, y); y += 15; }

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.text("Summary", M, y); y += 15;
  doc.setFont("helvetica", "normal");
  const s = report.summary;
  const sum = [
    `Weeks: ${s.weeks}   PASS: ${s.weeksPass}   MARGINAL: ${s.weeksMarginal}   FAIL: ${s.weeksFail}`,
    `Total time ≥2%: ${s.totalExceed2}   Total time ≥4%: ${s.totalExceed4}`,
    `GOST 32144-2013 limits: K2U ≤ 2% normal, ≤ 4% maximum.`,
  ];
  for (const line of sum) { doc.text(line, M, y); y += 14; }

  return doc;
}

export function downloadPdf(report, filename = "gost-compliance.pdf") {
  renderCompliancePdf(report).save(filename);
}

export function pdfBlob(report) {
  return renderCompliancePdf(report).output("blob");
}
