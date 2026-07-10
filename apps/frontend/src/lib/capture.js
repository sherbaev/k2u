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
