import { useMemo, useRef } from "react";
import {
  SVG_SIZE,
  PAD,
  DATA_MIN,
  DATA_MAX,
  dataToSvg,
  svgToData,
  clamp,
  isoCurvePath,
  gostBandPath,
  radialLine,
} from "../lib/geometry.js";

const ISO_EPS = [0.02, 0.04, 0.06, 0.08, 0.1, 0.12, 0.14];
const MAJOR_EPS = new Set([0.02, 0.04, 0.1]);
const TICKS = [0.84, 0.88, 0.92, 0.96, 1.0, 1.04, 1.08, 1.12, 1.16];

/**
 * K₂U polar nomogram (thesis §3.3): iso-K₂U curves, 2%/4% GOST zones, radial
 * phase-angle lines, live operating point + trail. Optionally interactive:
 * pass onPoint(x, y) to receive dragged coordinates (educational inverse mode).
 *
 * Props:
 *   point   : { x, y } current operating ratios (U_BC/U_AB, U_CA/U_AB), optional
 *   trail   : [{ x, y }] recent points (drawn faint), optional
 *   onPoint : (x, y) => void  enables drag interaction
 */
export default function Nomogram({ point, trail = [], onPoint }) {
  const ref = useRef(null);

  // Static layers computed once.
  const layers = useMemo(() => {
    const bands = [
      { d: gostBandPath(0, 0.02), fill: "rgba(46,125,50,.12)" },
      { d: gostBandPath(0.02, 0.04), fill: "rgba(237,108,2,.12)" },
      { d: gostBandPath(0.04, 0.2), fill: "rgba(211,47,47,.10)" },
    ];
    const iso = ISO_EPS.map((eps) => ({
      d: isoCurvePath(eps),
      major: MAJOR_EPS.has(eps),
      label: `${(eps * 100).toFixed(0)}%`,
      at: dataToSvg(...ratioLabel(eps)),
    }));
    const radials = [];
    for (let a = 0; a < 360; a += 15) radials.push({ ...radialLine(a), major: a % 30 === 0 });
    return { bands, iso, radials };
  }, []);

  const [bx, by] = dataToSvg(1, 1);
  const cur = point ? dataToSvg(clamp(point.x, DATA_MIN, DATA_MAX), clamp(point.y, DATA_MIN, DATA_MAX)) : null;

  function handlePointer(e) {
    if (!onPoint || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const sx = clamp((e.clientX - rect.left) * (SVG_SIZE / rect.width), PAD, SVG_SIZE - PAD);
    const sy = clamp((e.clientY - rect.top) * (SVG_SIZE / rect.height), PAD, SVG_SIZE - PAD);
    const [x, y] = svgToData(sx, sy);
    onPoint(x, y);
  }

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      style={{ width: "100%", height: "auto", touchAction: "none", cursor: onPoint ? "crosshair" : "default" }}
      onPointerDown={onPoint ? (e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e); } : undefined}
      onPointerMove={onPoint ? (e) => e.buttons && handlePointer(e) : undefined}
    >
      <clipPath id="plot-clip">
        <rect x={PAD} y={PAD} width={SVG_SIZE - 2 * PAD} height={SVG_SIZE - 2 * PAD} />
      </clipPath>

      {/* GOST zones */}
      <g clipPath="url(#plot-clip)">
        {layers.bands.map((b, i) => (
          <path key={i} d={b.d} fill={b.fill} fillRule="evenodd" />
        ))}
      </g>

      {/* grid */}
      <g>
        {TICKS.map((t) => {
          const major = Math.abs(t - 1) < 1e-6;
          const [vx1, vy1] = dataToSvg(t, DATA_MIN);
          const [vx2, vy2] = dataToSvg(t, DATA_MAX);
          const [hx1, hy1] = dataToSvg(DATA_MIN, t);
          const [hx2, hy2] = dataToSvg(DATA_MAX, t);
          const stroke = major ? "#b0b7c3" : "#e2e5ea";
          return (
            <g key={t}>
              <line x1={vx1} y1={vy1} x2={vx2} y2={vy2} stroke={stroke} />
              <line x1={hx1} y1={hy1} x2={hx2} y2={hy2} stroke={stroke} />
              <text x={vx1} y={vy1 + 16} textAnchor="middle" fontSize="10" fill="#6b7280">{t.toFixed(2)}</text>
              <text x={hx1 - 6} y={hy1 + 3} textAnchor="end" fontSize="10" fill="#6b7280">{t.toFixed(2)}</text>
            </g>
          );
        })}
      </g>

      {/* iso-K₂U curves */}
      <g clipPath="url(#plot-clip)" fill="none">
        {layers.iso.map((c, i) => (
          <g key={i}>
            <path d={c.d} stroke={c.major ? "#8a94a6" : "#c7cdd8"} strokeWidth={c.major ? 1.4 : 0.8} />
            <text x={c.at[0] + 4} y={c.at[1] - 4} fontSize="10" fill="#5b6472">{c.label}</text>
          </g>
        ))}
      </g>

      {/* radial phase-angle lines */}
      <g clipPath="url(#plot-clip)">
        {layers.radials.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} stroke={r.major ? "#cfd4dd" : "#e6e9ee"} />
        ))}
      </g>

      {/* balance mark */}
      <circle cx={bx} cy={by} r={3} fill="#111827" />

      {/* trail */}
      {trail.map((p, i) => {
        const [px, py] = dataToSvg(clamp(p.x, DATA_MIN, DATA_MAX), clamp(p.y, DATA_MIN, DATA_MAX));
        return <circle key={i} cx={px} cy={py} r={2} fill="#1565c0" opacity={0.15 + (0.5 * i) / Math.max(1, trail.length)} />;
      })}

      {/* operating point */}
      {cur && (
        <g>
          <line x1={bx} y1={by} x2={cur[0]} y2={cur[1]} stroke="#1565c0" strokeWidth={1.2} opacity={0.6} />
          <circle cx={cur[0]} cy={cur[1]} r={7} fill="#1565c0" stroke="#fff" strokeWidth={2} />
        </g>
      )}
    </svg>
  );
}

// Place an iso-curve label near theta = 45°.
function ratioLabel(eps) {
  const c0 = Math.cos((45 * Math.PI) / 180);
  const cm = Math.cos((45 * Math.PI) / 180 - (2 * Math.PI) / 3);
  const cp = Math.cos((45 * Math.PI) / 180 + (2 * Math.PI) / 3);
  const e2 = eps * eps;
  const uab = Math.sqrt(1 + 2 * eps * c0 + e2);
  const ubc = Math.sqrt(1 + 2 * eps * cm + e2);
  const uca = Math.sqrt(1 + 2 * eps * cp + e2);
  return [ubc / uab, uca / uab];
}
