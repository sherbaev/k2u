import html2canvas from "html2canvas";

/**
 * Render a DOM node to a high-resolution PNG and trigger a download — for
 * capturing the exact on-screen state of a graph/panel to use as a figure in a
 * paper or Scopus article. Elements marked `data-html2canvas-ignore` (e.g. the
 * capture button itself) are excluded from the image.
 */
export async function captureToPng(node, { filename = "figure", background = "#ffffff", scale = 2 } = {}) {
  if (!node) return;
  const canvas = await html2canvas(node, {
    backgroundColor: background,
    scale,
    useCORS: true,
    logging: false,
  });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Whether the node contains an SVG graph that can be exported as vector. */
export function hasSvg(node) {
  if (!node) return false;
  return node.tagName?.toLowerCase() === "svg" || Boolean(node.querySelector?.("svg"));
}

/**
 * Export the first SVG inside `node` as a standalone .svg file — a crisp vector
 * "ready pic" that scales perfectly in a paper or Claude prompt. The chart's
 * colors are already inline attributes, so it renders standalone.
 */
export function captureSvg(node, { filename = "figure", background = "#ffffff" } = {}) {
  if (!node) return;
  const src = node.tagName?.toLowerCase() === "svg" ? node : node.querySelector("svg");
  if (!src) return;

  const clone = src.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const rect = src.getBoundingClientRect();
  const w = Math.round(rect.width) || 800;
  const h = Math.round(rect.height) || 600;
  clone.setAttribute("width", w);
  clone.setAttribute("height", h);
  clone.style.width = `${w}px`;
  clone.style.height = `${h}px`;

  // Opaque background so it isn't transparent when embedded in a document.
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", "100%");
  bg.setAttribute("height", "100%");
  bg.setAttribute("fill", background);
  clone.insertBefore(bg, clone.firstChild);

  const data = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${data}`], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".svg") ? filename : `${filename}.svg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
