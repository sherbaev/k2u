import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Stack,
  Grid,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Divider,
  Tooltip,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { Zap, Radio } from "lucide-react";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { k2uFromVoltages, lineFromPhaseNominal } from "../lib/k2u.js";
import StatusBadge from "./StatusBadge.jsx";

const DEFAULT_PHASE = { ua: 230, ub: 223, uc: 226 };
const EXAMPLE_PHASE = { ua: 235, ub: 210, uc: 225 };
const BAND_MAX = 6; // % — full width of the GOST band meter

const STATUS_TONE = {
  NORMAL: "success.main",
  WARNING: "warning.main",
  CRITICAL: "error.main",
};

function fmt(v, d = 2) {
  return Number.isFinite(v) ? v.toFixed(d) : "—";
}

/** RMS β-method estimator (magnitude-only unbalance) — see thesis §3.2. */
function betaMethod(uab, ubc, uca) {
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
 * Interactive K₂U analyzer — the screenshot centerpiece of the Overview page.
 * Lets the user type phase (or line) voltages and see K₂U / φ₂ / GOST verdict
 * update live, alongside the symmetrical-components and RMS β-method formulas
 * substituted with the current numbers. Reports its operating-point ratios to
 * the parent via onPointChange so the nomogram can track it.
 *
 * Props:
 *   telemetry           : latest live-device telemetry (optional) — auto-fills
 *                          the inputs until the user edits them manually.
 *   onPointChange       : ({x,y}) => void, called whenever the ratios change.
 *   externalLineVoltages: { uab, ubc, uca } (optional) — when this object
 *                          changes identity, the analyzer switches into
 *                          line-voltage mode with these values and recomputes.
 *                          Used to sync from an external drag (e.g. the
 *                          nomogram's draggable operating point).
 */
export default function K2uAnalyzer({ telemetry, onPointChange, externalLineVoltages }) {
  const theme = useTheme();
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
  // Only reacts when a new object arrives, so it never loops back on itself.
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
    } else if (next === "phase") {
      // Best-effort: keep phase fields as-is; line values were derived from them anyway.
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

  const k2u = result.valid ? result.k2u : NaN;
  const status = result.valid ? result.status : null;
  const tone = status ? STATUS_TONE[status] : "text.secondary";
  const markerPct = Number.isFinite(k2u) ? Math.min(100, (k2u / BAND_MAX) * 100) : 0;

  const uab = lineVolts.uab || 0;
  const ubc = lineVolts.ubc || 0;
  const uca = lineVolts.uca || 0;

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              K₂U analyzer
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Live symmetrical-components &amp; RMS β-method calculation
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {telemetry && touched && (
              <Tooltip title="Resume following the selected live device">
                <Button size="small" variant="outlined" startIcon={<Radio size={14} />} onClick={syncFromDevice}>
                  Sync from device
                </Button>
              </Tooltip>
            )}
            <Button size="small" variant="contained" color="warning" startIcon={<Zap size={14} />} onClick={loadExample}>
              Load unbalanced example
            </Button>
          </Stack>
        </Stack>

        <Grid container spacing={3}>
          {/* Inputs + result */}
          <Grid item xs={12} md={5}>
            <Stack spacing={2}>
              <ToggleButtonGroup
                size="small"
                exclusive
                value={voltMode}
                onChange={handleVoltModeChange}
                fullWidth
              >
                <ToggleButton value="phase">Phase voltages</ToggleButton>
                <ToggleButton value="line">Line voltages</ToggleButton>
              </ToggleButtonGroup>

              {voltMode === "phase" ? (
                <Stack direction="row" spacing={1.25}>
                  <TextField label="U_a (V)" size="small" type="number" value={phase.ua} onChange={handlePhaseField("ua")} fullWidth />
                  <TextField label="U_b (V)" size="small" type="number" value={phase.ub} onChange={handlePhaseField("ub")} fullWidth />
                  <TextField label="U_c (V)" size="small" type="number" value={phase.uc} onChange={handlePhaseField("uc")} fullWidth />
                </Stack>
              ) : (
                <Stack direction="row" spacing={1.25}>
                  <TextField label="U_AB (V)" size="small" type="number" value={line.uab} onChange={handleLineField("uab")} fullWidth />
                  <TextField label="U_BC (V)" size="small" type="number" value={line.ubc} onChange={handleLineField("ubc")} fullWidth />
                  <TextField label="U_CA (V)" size="small" type="number" value={line.uca} onChange={handleLineField("uca")} fullWidth />
                </Stack>
              )}

              <Box>
                <Stack direction="row" alignItems="baseline" spacing={1.5}>
                  <Typography variant="h3" sx={{ fontWeight: 700, color: tone, lineHeight: 1 }}>
                    {fmt(k2u)}%
                  </Typography>
                  {status && <StatusBadge status={status} size="medium" />}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  K₂U — negative-sequence voltage unbalance
                </Typography>
              </Box>

              {/* GOST band meter */}
              <Box>
                <Box
                  sx={{
                    position: "relative",
                    height: 14,
                    borderRadius: "7px",
                    overflow: "hidden",
                    display: "flex",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box sx={{ width: `${(2 / BAND_MAX) * 100}%`, bgcolor: alpha(theme.palette.success.main, 0.55) }} />
                  <Box sx={{ width: `${(2 / BAND_MAX) * 100}%`, bgcolor: alpha(theme.palette.warning.main, 0.55) }} />
                  <Box sx={{ width: `${(2 / BAND_MAX) * 100}%`, bgcolor: alpha(theme.palette.error.main, 0.5) }} />
                  {Number.isFinite(k2u) && (
                    <Box
                      sx={{
                        position: "absolute",
                        left: `calc(${markerPct}% - 2px)`,
                        top: -3,
                        width: 4,
                        height: 20,
                        borderRadius: "2px",
                        bgcolor: "text.primary",
                        boxShadow: "0 0 0 2px rgba(255,255,255,0.6)",
                      }}
                    />
                  )}
                </Box>
                <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">0%</Typography>
                  <Typography variant="caption" color="text.secondary">2% normal</Typography>
                  <Typography variant="caption" color="text.secondary">4% max</Typography>
                  <Typography variant="caption" color="text.secondary">6%</Typography>
                </Stack>
              </Box>

              <Divider />

              <Grid container spacing={1.5}>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">φ₂</Typography>
                  <Typography variant="body1">{fmt(result.valid ? result.phi2 : NaN, 1)}°</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">U_BC / U_AB</Typography>
                  <Typography variant="body1">{fmt(uab ? ubc / uab : NaN, 3)}</Typography>
                </Grid>
                <Grid item xs={6} sm={4}>
                  <Typography variant="caption" color="text.secondary">U_CA / U_AB</Typography>
                  <Typography variant="body1">{fmt(uab ? uca / uab : NaN, 3)}</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">U_AB</Typography>
                  <Typography variant="body1">{fmt(uab, 1)} V</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">U_BC</Typography>
                  <Typography variant="body1">{fmt(ubc, 1)} V</Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">U_CA</Typography>
                  <Typography variant="body1">{fmt(uca, 1)} V</Typography>
                </Grid>
              </Grid>
            </Stack>
          </Grid>

          {/* Formulas */}
          <Grid item xs={12} md={7}>
            <Box
              sx={{
                bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(21,94,156,0.03)"),
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                p: 2,
                height: "100%",
                overflowX: "auto",
                "& .katex": { fontSize: "0.95rem" },
              }}
            >
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                Symmetrical components
              </Typography>
              <BlockMath math={"a = e^{j120^\\circ}"} />
              <BlockMath math={"U_1 = \\tfrac{1}{3}(U_{AB} + aU_{BC} + a^2U_{CA}), \\quad U_2 = \\tfrac{1}{3}(U_{AB} + a^2U_{BC} + aU_{CA})"} />
              <BlockMath math={"K_{2U} = \\dfrac{|U_2|}{|U_1|}\\times 100\\%"} />
              <BlockMath
                math={`K_{2U} = \\dfrac{|U_2|}{|U_1|}\\times 100\\% = ${fmt(k2u)}\\%`}
              />

              <Divider sx={{ my: 1.5 }} />

              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                RMS β-method (equivalent, no phase measurement needed)
              </Typography>
              <BlockMath math={"\\beta = \\dfrac{U_{AB}^4+U_{BC}^4+U_{CA}^4}{(U_{AB}^2+U_{BC}^2+U_{CA}^2)^2}"} />
              <BlockMath math={"K_{2U} = \\sqrt{\\dfrac{1-\\sqrt{3-6\\beta}}{1+\\sqrt{3-6\\beta}}}\\times 100\\%"} />
              <BlockMath
                math={`\\beta = \\dfrac{${fmt(uab, 1)}^4+${fmt(ubc, 1)}^4+${fmt(uca, 1)}^4}{(${fmt(uab, 1)}^2+${fmt(ubc, 1)}^2+${fmt(uca, 1)}^2)^2} = ${fmt(beta.beta, 5)}`}
              />
              <BlockMath
                math={`K_{2U} \\approx \\sqrt{\\dfrac{1-\\sqrt{3-6(${fmt(beta.beta, 4)})}}{1+\\sqrt{3-6(${fmt(beta.beta, 4)})}}}\\times 100\\% = ${fmt(beta.k2u)}\\%`}
              />
              <Typography variant="caption" color="text.secondary">
                The two estimators agree to within &lt;0.2% RMSE for magnitude-only unbalance
                (see Research → Measurement accuracy).
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}
