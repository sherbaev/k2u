import { Card, CardContent, Typography, Box, Stack, Grid, Divider, Tooltip } from "@mui/material";
import { Info } from "lucide-react";
import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";
import { fmt } from "../lib/useK2uCalc.js";

/**
 * Full-width formulas block for the Overview. Shows the symmetrical-components
 * derivation and the RMS β-method, each substituted with the analyzer's
 * current numbers. Kept separate from the input panel so the equations render
 * at a readable, screenshot-quality width.
 */
export default function K2uFormulas({ calc }) {
  const { lineVolts, result, beta } = calc;
  const k2u = result.valid ? result.k2u : NaN;
  const uab = lineVolts.uab || 0;
  const ubc = lineVolts.ubc || 0;
  const uca = lineVolts.uca || 0;

  const boxSx = {
    bgcolor: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(21,94,156,0.03)"),
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 2,
    p: 2.5,
    height: "100%",
    overflowX: "auto",
    "& .katex": { fontSize: "1rem" },
  };

  return (
    <Card>
      <CardContent>
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Formulas
          </Typography>
          <Tooltip
            title="Two equivalent ways to get K₂U from the three measured line voltages: the full symmetrical-components derivation (needs phase angles) and the RMS-only β-method (magnitudes only) that the ESP32 firmware actually runs."
            arrow
          >
            <Info size={15} style={{ opacity: 0.65, cursor: "help" }} />
          </Tooltip>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          How K₂U is computed from the measured voltages — substituted with the analyzer's current values.
        </Typography>

        <Grid container spacing={2.5}>
          {/* Symmetrical components */}
          <Grid item xs={12} md={6}>
            <Box sx={boxSx}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                Symmetrical components
              </Typography>
              <BlockMath math={"a = e^{j120^\\circ}"} />
              <BlockMath math={"U_1 = \\tfrac{1}{3}(U_{AB} + aU_{BC} + a^2U_{CA}), \\quad U_2 = \\tfrac{1}{3}(U_{AB} + a^2U_{BC} + aU_{CA})"} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                Fortescue transform — splits the three line voltages into a balanced positive-sequence
                phasor U₁ and the unbalanced negative-sequence phasor U₂.
              </Typography>
              <BlockMath math={"K_{2U} = \\dfrac{|U_2|}{|U_1|}\\times 100\\%"} />
              <BlockMath math={`K_{2U} = \\dfrac{|U_2|}{|U_1|}\\times 100\\% = ${fmt(k2u)}\\%`} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                The negative-sequence voltage unbalance factor — the headline metric. GOST 32144-2013
                limits it to 2% (normal) and 4% (maximum).
              </Typography>
            </Box>
          </Grid>

          {/* RMS β-method */}
          <Grid item xs={12} md={6}>
            <Box sx={boxSx}>
              <Stack direction="row" spacing={0.6} alignItems="center">
                <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700 }}>
                  RMS β-method (equivalent, no phase measurement needed)
                </Typography>
                <Tooltip title="IEC 61000-4-30 RMS-only estimate — recovers the same K₂U from just the three voltage magnitudes, with no phase measurement required.">
                  <Info size={13} style={{ opacity: 0.65, cursor: "help" }} />
                </Tooltip>
              </Stack>
              <BlockMath math={"\\beta = \\dfrac{U_{AB}^4+U_{BC}^4+U_{CA}^4}{(U_{AB}^2+U_{BC}^2+U_{CA}^2)^2}"} />
              <BlockMath math={"K_{2U} = \\sqrt{\\dfrac{1-\\sqrt{3-6\\beta}}{1+\\sqrt{3-6\\beta}}}\\times 100\\%"} />
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                IEC 61000-4-30 RMS-only estimate — gets the same K₂U from just the three voltage
                magnitudes (no phase angles). This is what the ESP32 firmware computes on-device.
              </Typography>
              <BlockMath math={`\\beta = \\dfrac{${fmt(uab, 1)}^4+${fmt(ubc, 1)}^4+${fmt(uca, 1)}^4}{(${fmt(uab, 1)}^2+${fmt(ubc, 1)}^2+${fmt(uca, 1)}^2)^2} = ${fmt(beta.beta, 5)}`} />
              <BlockMath math={`K_{2U} \\approx \\sqrt{\\dfrac{1-\\sqrt{3-6(${fmt(beta.beta, 4)})}}{1+\\sqrt{3-6(${fmt(beta.beta, 4)})}}}\\times 100\\% = ${fmt(beta.k2u)}\\%`} />
              <Divider sx={{ my: 1.25 }} />
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Current: β = {fmt(beta.beta, 5)} → K₂U ≈ {fmt(beta.k2u)}%
              </Typography>
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
