import { useEffect, useMemo, useState } from "react";
import { k2uFromVoltages, lineFromPhaseNominal } from "./k2u.js";

export const DEFAULT_PHASE = { ua: 230, ub: 223, uc: 226 };
export const EXAMPLE_PHASE = { ua: 235, ub: 210, uc: 225 };

/** Format a number, or an em-dash when not finite. */
export function fmt(v, d = 2) {
  return Number.isFinite(v) ? v.toFixed(d) : "—";
}

/** RMS β-method estimator (magnitude-only unbalance) — see thesis §3.2. */
export function betaMethod(uab, ubc, uca) {
  const sq = uab * uab + ubc * ubc + uca * uca;
  const beta = (uab ** 4 + ubc ** 4 + uca ** 4) / (sq * sq);
  const inner = 3 - 6 * beta;
  if (inner < 0 || sq === 0) return { beta, inner, k2u: NaN };
  const s = Math.sqrt(inner);
  const ratio = (1 - s) / (1 + s);
  const k2u = ratio >= 0 ? Math.sqrt(ratio) * 100 : NaN;
  return { beta, inner, k2u };
}

/**
 * Shared K₂U analyzer state + computation. Holds the phase/line inputs and
 * derives K₂U (symmetrical components), the RMS β-method estimate, GOST status
 * and the nomogram operating-point ratios. Used once by the Overview so the
 * inputs panel and the formulas panel stay in sync while living in separate
 * layout blocks.
 */
export function useK2uCalc({ telemetry, onPointChange, externalLineVoltages } = {}) {
  const [voltMode, setVoltMode] = useState("phase"); // "phase" | "line"
  const [phase, setPhase] = useState(DEFAULT_PHASE);
  const [line, setLine] = useState(() =>
    lineFromPhaseNominal(DEFAULT_PHASE.ua, DEFAULT_PHASE.ub, DEFAULT_PHASE.uc),
  );
  const [touched, setTouched] = useState(false);

  // Auto-sync from the live device until the user starts editing manually.
  useEffect(() => {
    if (touched || !telemetry) return;
    if (Number.isFinite(telemetry.u_a) && Number.isFinite(telemetry.u_b) && Number.isFinite(telemetry.u_c)) {
      setPhase({ ua: telemetry.u_a, ub: telemetry.u_b, uc: telemetry.u_c });
    }
  }, [telemetry, touched]);

  const lineVolts = useMemo(() => {
    if (voltMode === "line") return line;
    return lineFromPhaseNominal(Number(phase.ua) || 0, Number(phase.ub) || 0, Number(phase.uc) || 0);
  }, [voltMode, phase, line]);

  const result = useMemo(
    () => k2uFromVoltages(lineVolts.uab, lineVolts.ubc, lineVolts.uca),
    [lineVolts],
  );
  const beta = useMemo(
    () => betaMethod(lineVolts.uab, lineVolts.ubc, lineVolts.uca),
    [lineVolts],
  );

  const point = useMemo(() => {
    if (!lineVolts.uab) return null;
    return { x: lineVolts.ubc / lineVolts.uab, y: lineVolts.uca / lineVolts.uab };
  }, [lineVolts]);

  useEffect(() => {
    if (onPointChange) onPointChange(point);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point?.x, point?.y]);

  // Sync from an external drag source (the nomogram's operating point).
  useEffect(() => {
    if (!externalLineVoltages) return;
    const { uab, ubc, uca } = externalLineVoltages;
    if (![uab, ubc, uca].every(Number.isFinite)) return;
    setTouched(true);
    setVoltMode("line");
    setLine({ uab, ubc, uca });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalLineVoltages]);

  function handleVoltModeChange(_e, next) {
    if (!next) return;
    if (next === "line") {
      setLine(lineFromPhaseNominal(Number(phase.ua) || 0, Number(phase.ub) || 0, Number(phase.uc) || 0));
    }
    setVoltMode(next);
  }

  function handlePhaseField(key) {
    return (e) => {
      setTouched(true);
      const v = e.target.value;
      setPhase((p) => ({ ...p, [key]: v === "" ? "" : Number(v) }));
    };
  }
  function handleLineField(key) {
    return (e) => {
      setTouched(true);
      const v = e.target.value;
      setLine((p) => ({ ...p, [key]: v === "" ? "" : Number(v) }));
    };
  }

  function loadExample() {
    setTouched(true);
    setVoltMode("phase");
    setPhase(EXAMPLE_PHASE);
    setLine(lineFromPhaseNominal(EXAMPLE_PHASE.ua, EXAMPLE_PHASE.ub, EXAMPLE_PHASE.uc));
  }

  function syncFromDevice() {
    setTouched(false);
  }

  return {
    voltMode,
    phase,
    line,
    touched,
    hasTelemetry: Boolean(telemetry),
    handleVoltModeChange,
    handlePhaseField,
    handleLineField,
    loadExample,
    syncFromDevice,
    lineVolts,
    result,
    beta,
    point,
  };
}
