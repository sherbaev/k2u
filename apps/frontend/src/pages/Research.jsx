import { useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Button,
  Grid,
  Slider,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Divider,
} from "@mui/material";
import { useTheme, alpha } from "@mui/material/styles";
import { FlaskConical, Download, Gauge } from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import html2canvas from "html2canvas";
import PageHeader from "../components/PageHeader.jsx";
import {
  MODEL_METRICS,
  MODEL_BY_TYPE,
  FEATURE_IMPORTANCE,
  CQR,
  DECISION,
  FLEET,
  degradationCurve,
} from "../lib/scopusData.js";

const DEVICE_TYPE_OPTIONS = [
  { value: "pv_inverter", label: "PV inverter" },
  { value: "telecom_rect", label: "Telecom rectifier" },
];

/** Downloads the given DOM node as a PNG via html2canvas. */
async function exportNodeAsPng(node, filename) {
  if (!node) return;
  const canvas = await html2canvas(node, { backgroundColor: null, scale: 2 });
  const url = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Card shell shared by every figure: title, chart area (exportable), caption, PNG button. */
function FigureCard({ title, caption, filename, headline, children }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  async function handleDownload() {
    setBusy(true);
    try {
      await exportNodeAsPng(ref.current, filename || `${title.replace(/[^\w]+/g, "_").toLowerCase()}.png`);
    } catch {
      // Non-critical UX action — ignore export failures (e.g. unsupported browser).
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {title}
            </Typography>
            {headline && (
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                {headline}
              </Typography>
            )}
          </Box>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download size={14} />}
            onClick={handleDownload}
            disabled={busy}
          >
            {busy ? "Exporting…" : "PNG"}
          </Button>
        </Stack>
        <Box ref={ref} sx={{ bgcolor: "background.paper" }}>
          {children}
        </Box>
        {caption && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5, lineHeight: 1.5 }}>
            {caption}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function Research() {
  const theme = useTheme();
  const grid = theme.palette.divider;
  const axis = theme.palette.text.secondary;

  // ---- Figure 2 interactive state (degradation trajectories) ----
  const [deviceType, setDeviceType] = useState("pv_inverter");
  const [k2u, setK2u] = useState(2);
  const [tAmb, setTAmb] = useState(25);
  const [load, setLoad] = useState(0.6);

  const degradation = useMemo(
    () => degradationCurve({ deviceType, k2u, tAmb, load, years: 25 }),
    [deviceType, k2u, tAmb, load],
  );

  // ---- Figure 1 data ----
  const measurementData = [
    { name: "Magnitude-only unbalance", rmse: FLEET.measurementRmsePct.magnitudeOnly },
    { name: "With angle deviation", rmse: FLEET.measurementRmsePct.withAngleDeviation },
  ];

  // ---- Figure 5 data ----
  const coverageData = [
    { name: "Before calibration", coverage: CQR.coverageBefore * 100 },
    { name: "After conformal (CQR)", coverage: CQR.coverageAfter * 100 },
  ];
  // ---- Figure 6 data ----
  const rowTotals = DECISION.confusion.map((row) => row.reduce((a, b) => a + b, 0));

  const modelHighlight = "XGBoost (full)";
  const featureHighlight = "cum_damage_index";

  return (
    <Box>
      <PageHeader
        icon={<FlaskConical size={22} />}
        title="Research & simulation"
        subtitle="Reproduces the K₂U measurement and remaining-useful-life (RUL) simulation study behind this platform — figures use the paper's actual published numbers, not mock data."
        actions={<Chip size="small" variant="outlined" label="sim_summary1–3.json" />}
      />

      <Grid container spacing={2}>
        {/* Figure 1 — measurement accuracy */}
        <Grid item xs={12} lg={6}>
          <FigureCard
            title="Fig. 1 — Measurement accuracy: RMS β-method vs. exact"
            caption="The RMS β-method estimates K₂U from voltage magnitudes only (no phase measurement). Against the exact symmetrical-components value, its RMSE is <0.2% for pure magnitude unbalance; angle deviation (phase-shifted faults) increases the error but stays under 1%."
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={measurementData} layout="vertical" margin={{ top: 8, right: 24, left: 16, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: axis, fontSize: 12 }} label={{ value: "RMSE (%)", position: "insideBottom", offset: -4, fill: axis }} />
                <YAxis type="category" dataKey="name" tick={{ fill: axis, fontSize: 11 }} width={150} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(3)}%`} contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${grid}` }} />
                <Bar dataKey="rmse" radius={[0, 6, 6, 0]} barSize={34}>
                  <Cell fill={theme.palette.success.main} />
                  <Cell fill={theme.palette.warning.main} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </FigureCard>
        </Grid>

        {/* Figure 3 — RUL model accuracy */}
        <Grid item xs={12} lg={6}>
          <FigureCard
            title="Fig. 3 — RUL model accuracy (R², temporal test split)"
            headline={`XGBoost (full physics features): R² = ${MODEL_METRICS.find((m) => m.model === modelHighlight)?.r2.toFixed(3)}`}
            caption="Ablation on a temporal (out-of-time) test split: adding physics-informed features (cumulative damage, exposure, thermal cycles) to XGBoost raises R² from 0.15 to 0.77 — far more than physics-only or linear baselines."
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={MODEL_METRICS} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" domain={[0, 1]} tick={{ fill: axis, fontSize: 12 }} label={{ value: "R²", position: "insideBottom", offset: -4, fill: axis }} />
                <YAxis type="category" dataKey="model" tick={{ fill: axis, fontSize: 12 }} width={130} />
                <Tooltip formatter={(v) => Number(v).toFixed(3)} contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${grid}` }} />
                <Bar dataKey="r2" radius={[0, 6, 6, 0]} barSize={18}>
                  {MODEL_METRICS.map((m) => (
                    <Cell key={m.model} fill={m.model === modelHighlight ? theme.palette.primary.main : alpha(theme.palette.primary.main, 0.35)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Divider sx={{ my: 1.5 }} />
            <Stack direction="row" spacing={3} justifyContent="center">
              {MODEL_BY_TYPE.map((m) => (
                <Box key={m.type} sx={{ textAlign: "center" }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{m.r2.toFixed(3)}</Typography>
                  <Typography variant="caption" color="text.secondary">{m.type}</Typography>
                </Box>
              ))}
            </Stack>
          </FigureCard>
        </Grid>

        {/* Figure 2 — interactive degradation trajectories (flagship) */}
        <Grid item xs={12}>
          <FigureCard
            title="Fig. 2 — Degradation trajectories (physics model, interactive)"
            caption="Remaining-useful-life fraction vs. years, from the Miner + Montsinger/Arrhenius thermal-aging model: hotspot temperature rises with ambient, load² and k·K₂U², and life halves per +10 °C above the 40 °C reference. Adjust the controls to explore any operating regime."
          >
            <Grid container spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Grid item xs={12} sm="auto">
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  value={deviceType}
                  onChange={(_e, v) => v && setDeviceType(v)}
                >
                  {DEVICE_TYPE_OPTIONS.map((o) => (
                    <ToggleButton key={o.value} value={o.value}>{o.label}</ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="caption" color="text.secondary">K₂U: {k2u.toFixed(1)}%</Typography>
                <Slider size="small" min={0.5} max={6} step={0.1} value={k2u} onChange={(_e, v) => setK2u(v)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="caption" color="text.secondary">Ambient: {tAmb.toFixed(0)} °C</Typography>
                <Slider size="small" min={10} max={45} step={1} value={tAmb} onChange={(_e, v) => setTAmb(v)} />
              </Grid>
              <Grid item xs={12} sm={3}>
                <Typography variant="caption" color="text.secondary">Load factor: {load.toFixed(2)}</Typography>
                <Slider size="small" min={0.3} max={1.0} step={0.05} value={load} onChange={(_e, v) => setLoad(v)} />
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={9}>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={degradation.data} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                    <XAxis dataKey="t" tick={{ fill: axis, fontSize: 12 }} label={{ value: "Years", position: "insideBottom", offset: -4, fill: axis }} />
                    <YAxis domain={[0, 1]} tick={{ fill: axis, fontSize: 12 }} label={{ value: "RUL fraction", angle: -90, position: "insideLeft", fill: axis }} />
                    <Tooltip formatter={(v) => Number(v).toFixed(3)} labelFormatter={(l) => `${l} yr`} contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${grid}` }} />
                    <ReferenceLine y={0} stroke={grid} />
                    <Line type="monotone" dataKey="rul" name="RUL fraction" stroke={theme.palette.primary.main} strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Grid>
              <Grid item xs={12} md={3}>
                <Stack spacing={2} justifyContent="center" sx={{ height: "100%" }}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Gauge size={16} color={theme.palette.text.secondary} />
                      <Typography variant="caption" color="text.secondary">Hotspot temperature</Typography>
                    </Stack>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{degradation.tHot.toFixed(1)} °C</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Projected life</Typography>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>{degradation.lifeYears.toFixed(1)} yr</Typography>
                  </Box>
                </Stack>
              </Grid>
            </Grid>
          </FigureCard>
        </Grid>

        {/* Figure 4 — feature importance */}
        <Grid item xs={12} lg={6}>
          <FigureCard
            title="Fig. 4 — Feature importance (gain)"
            headline={`Top driver: ${featureHighlight} (${(FEATURE_IMPORTANCE[0].gain * 100).toFixed(1)}% of total gain)`}
            caption="XGBoost split-gain importance for the RUL model. The cumulative damage index (Miner's-rule integral of thermal/unbalance stress) dominates, followed by 30-day exposure above the 2% GOST limit and service age."
          >
            <ResponsiveContainer width="100%" height={380}>
              <BarChart data={FEATURE_IMPORTANCE} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
                <XAxis type="number" tick={{ fill: axis, fontSize: 12 }} label={{ value: "Gain", position: "insideBottom", offset: -4, fill: axis }} />
                <YAxis type="category" dataKey="feature" tick={{ fill: axis, fontSize: 11 }} width={150} />
                <Tooltip formatter={(v) => Number(v).toFixed(3)} contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${grid}` }} />
                <Bar dataKey="gain" radius={[0, 6, 6, 0]} barSize={13}>
                  {FEATURE_IMPORTANCE.map((f) => (
                    <Cell key={f.feature} fill={f.feature === featureHighlight ? theme.palette.secondary.main : alpha(theme.palette.primary.main, 0.4)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </FigureCard>
        </Grid>

        {/* Figure 5 — conformal prediction */}
        <Grid item xs={12} lg={6}>
          <FigureCard
            title="Fig. 5 — Conformal prediction (CQR) calibration"
            headline={`Empirical coverage: ${(CQR.coverageBefore * 100).toFixed(1)}% → ${(CQR.coverageAfter * 100).toFixed(1)}% (target 80%)`}
            caption={`Conformalized quantile regression widens the raw quantile interval by q̂ = ${CQR.qhat.toFixed(4)} so the empirical coverage matches the 80% target on held-out data, at the cost of a wider interval (${CQR.widthBefore.toFixed(2)} → ${CQR.widthAfter.toFixed(2)}).`}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={coverageData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={grid} />
                <XAxis dataKey="name" tick={{ fill: axis, fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: axis, fontSize: 12 }} label={{ value: "Coverage (%)", angle: -90, position: "insideLeft", fill: axis }} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(1)}%`} contentStyle={{ background: theme.palette.background.paper, border: `1px solid ${grid}` }} />
                <ReferenceLine y={CQR.target * 100} stroke={theme.palette.error.main} strokeDasharray="6 4" label={{ value: "80% target", fill: theme.palette.error.main, fontSize: 11, position: "insideTopRight" }} />
                <Bar dataKey="coverage" radius={[6, 6, 0, 0]} barSize={70}>
                  <Cell fill={alpha(theme.palette.warning.main, 0.75)} />
                  <Cell fill={theme.palette.success.main} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </FigureCard>
        </Grid>

        {/* Figure 6 — balancer decision confusion matrix */}
        <Grid item xs={12}>
          <FigureCard
            title="Fig. 6 — Balancer decision layer: confusion matrix"
            headline={`Accuracy: ${(DECISION.accuracy * 100).toFixed(1)}%`}
            caption="3-class decision layer (no balancer needed / recommended / required) driven by predicted RUL and K₂U exposure. Rows are ground truth, columns are predictions; darker green = higher share of that true class, correctly predicted on the diagonal."
          >
            <Table size="small" sx={{ maxWidth: 560, mx: "auto" }}>
              <TableHead>
                <TableRow>
                  <TableCell />
                  {DECISION.labels.map((l) => (
                    <TableCell key={l} align="center" sx={{ textTransform: "capitalize" }}>
                      {l}
                    </TableCell>
                  ))}
                  <TableCell align="right">Total</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DECISION.confusion.map((row, i) => (
                  <TableRow key={DECISION.labels[i]}>
                    <TableCell sx={{ fontWeight: 700, textTransform: "capitalize" }}>{DECISION.labels[i]}</TableCell>
                    {row.map((val, j) => {
                      const share = rowTotals[i] ? val / rowTotals[i] : 0;
                      const isDiag = i === j;
                      const bg = isDiag
                        ? alpha(theme.palette.success.main, 0.15 + 0.65 * share)
                        : alpha(theme.palette.error.main, share > 0 ? 0.12 + 0.55 * share : 0);
                      return (
                        <TableCell
                          key={j}
                          align="center"
                          sx={{
                            bgcolor: bg,
                            fontWeight: isDiag ? 700 : 500,
                            color: "text.primary",
                          }}
                        >
                          {val.toLocaleString()}
                        </TableCell>
                      );
                    })}
                    <TableCell align="right" sx={{ color: "text.secondary" }}>
                      {rowTotals[i].toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </FigureCard>
        </Grid>
      </Grid>
    </Box>
  );
}
