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
import { fmt } from "../lib/useK2uCalc.js";
import StatusBadge from "./StatusBadge.jsx";

const BAND_MAX = 6; // % — full width of the GOST band meter

const STATUS_TONE = {
  NORMAL: "success.main",
  WARNING: "warning.main",
  CRITICAL: "error.main",
};

/**
 * K₂U analyzer — inputs + live result panel. Takes a `calc` object from
 * useK2uCalc so it can share state with the (separately placed) formulas
 * block. This is the compact panel that sits beside the nomogram.
 */
export default function K2uAnalyzer({ calc }) {
  const theme = useTheme();
  const {
    voltMode,
    phase,
    line,
    touched,
    hasTelemetry,
    handleVoltModeChange,
    handlePhaseField,
    handleLineField,
    loadExample,
    syncFromDevice,
    lineVolts,
    result,
  } = calc;

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
              Type phase or line voltages — K₂U updates live
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            {hasTelemetry && touched && (
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

        <Stack spacing={2}>
          <ToggleButtonGroup size="small" exclusive value={voltMode} onChange={handleVoltModeChange} fullWidth>
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
      </CardContent>
    </Card>
  );
}
