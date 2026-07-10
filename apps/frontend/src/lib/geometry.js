/**
 * Pure presentation geometry for the K₂U polar nomogram (SVG coordinate
 * mapping and curve generation). No measurement math lives here — that is in
 * ./k2u.js. These helpers are unit-tested for coordinate round-trip.
 */
import { ratiosFromEpsTheta } from "./k2u.js";

export const SVG_SIZE = 760;
export const PAD = 60;
export const DATA_MIN = 0.84;
export const DATA_MAX = 1.16;
export const PLOT_SIZE = SVG_SIZE - 2 * PAD;

/** data (x = U_BC/U_AB, y = U_CA/U_AB) -> SVG pixel coords (y inverted). */
export function dataToSvg(x, y) {
  const sx = PAD + ((x - DATA_MIN) / (DATA_MAX - DATA_MIN)) * PLOT_SIZE;
  const sy = PAD + (1 - (y - DATA_MIN) / (DATA_MAX - DATA_MIN)) * PLOT_SIZE;
  return [sx, sy];
}

/** inverse of dataToSvg. */
export function svgToData(sx, sy) {
  const x = DATA_MIN + ((sx - PAD) / PLOT_SIZE) * (DATA_MAX - DATA_MIN);
  const y = DATA_MIN + (1 - (sy - PAD) / PLOT_SIZE) * (DATA_MAX - DATA_MIN);
  return [x, y];
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** SVG path "d" for one closed iso-K₂U curve at unbalance fraction eps. */
export function isoCurvePath(eps, step = 2) {
  let d = "";
  for (let i = 0; i <= 360; i += step) {
    const r = ratiosFromEpsTheta(eps, (i * Math.PI) / 180);
    const [px, py] = dataToSvg(r.x, r.y);
    d += (i === 0 ? "M" : "L") + px.toFixed(2) + "," + py.toFixed(2) + " ";
  }
  return d + "Z";
}

/** Filled donut path "d" between two iso curves (a GOST zone band). */
export function gostBandPath(epsInner, epsOuter, step = 2) {
  const outer = [];
  const inner = [];
  for (let i = 0; i <= 360; i += step) {
    const ro = ratiosFromEpsTheta(epsOuter, (i * Math.PI) / 180);
    const ri = ratiosFromEpsTheta(epsInner, (i * Math.PI) / 180);
    outer.push(dataToSvg(ro.x, ro.y));
    inner.push(dataToSvg(ri.x, ri.y));
  }
  inner.reverse();
  const toPath = (pts) =>
    pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(2) + "," + p[1].toFixed(2)).join(" ");
  return toPath(outer) + " Z " + (epsInner > 0 ? toPath(inner) + " Z" : "");
}

/** SVG line endpoints for a constant-phase-angle radial. */
export function radialLine(angleDeg, epsMax = 0.16) {
  const r0 = ratiosFromEpsTheta(0.001, (angleDeg * Math.PI) / 180);
  const r1 = ratiosFromEpsTheta(epsMax, (angleDeg * Math.PI) / 180);
  const [x1, y1] = dataToSvg(r0.x, r0.y);
  const [x2, y2] = dataToSvg(r1.x, r1.y);
  return { x1, y1, x2, y2 };
}
