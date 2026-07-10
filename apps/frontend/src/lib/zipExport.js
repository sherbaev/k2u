/** Bundle the GOST report PDF + CSV into a single ZIP (JSZip). */
import JSZip from "jszip";
import { toCsv } from "./report.js";
import { pdfBlob } from "./pdf.js";

/** Returns a Blob for a .zip containing gost-compliance.pdf + gost-compliance.csv. */
export async function buildReportZip(report) {
  const zip = new JSZip();
  zip.file("gost-compliance.pdf", pdfBlob(report));
  zip.file("gost-compliance.csv", toCsv(report));
  return zip.generateAsync({ type: "blob" });
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadReportZip(report, filename = "gost-compliance.zip") {
  downloadBlob(await buildReportZip(report), filename);
}

/** Download just the CSV. */
export function downloadCsv(report, filename = "gost-compliance.csv") {
  downloadBlob(new Blob([toCsv(report)], { type: "text/csv" }), filename);
}
