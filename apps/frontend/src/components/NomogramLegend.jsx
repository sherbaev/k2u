import { Box, Stack, Typography } from "@mui/material";

/**
 * Compact, theme-aware legend explaining the K₂U polar nomogram's visual
 * language: GOST compliance zones, the operating point, history trail,
 * iso-K₂U contours and phase-angle radials. Colors are read from the MUI
 * palette so the swatches always match what Nomogram.jsx actually draws.
 */
export default function NomogramLegend() {
  const zones = [
    { color: "success.main", label: "≤ 2% — normal (GOST)" },
    { color: "warning.main", label: "2–4% — max (GOST)" },
    { color: "error.main", label: "> 4% — out of spec" },
  ];

  return (
    <Stack spacing={0.75} sx={{ mt: 1.25 }}>
      <Stack direction="row" spacing={1.75} flexWrap="wrap" useFlexGap justifyContent="center">
        {zones.map((z) => (
          <Stack key={z.label} direction="row" spacing={0.6} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: z.color, flexShrink: 0 }} />
            <Typography variant="caption" color="text.secondary">
              {z.label}
            </Typography>
          </Stack>
        ))}
      </Stack>
      <Stack direction="row" spacing={1.75} flexWrap="wrap" useFlexGap justifyContent="center">
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box
            sx={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              bgcolor: "primary.main",
              border: "2px solid",
              borderColor: "background.paper",
              boxShadow: 1,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Operating point
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              bgcolor: "primary.light",
              opacity: 0.6,
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Recent history
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box
            sx={{
              width: 14,
              height: 9,
              borderRadius: "50%",
              border: "1.5px solid",
              borderColor: "text.secondary",
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Iso-K₂U contours
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} alignItems="center">
          <Box
            sx={{
              width: 14,
              height: 0,
              borderTop: "1.5px solid",
              borderColor: "text.secondary",
              transform: "rotate(35deg)",
              flexShrink: 0,
            }}
          />
          <Typography variant="caption" color="text.secondary">
            Phase angle φ₂
          </Typography>
        </Stack>
      </Stack>
    </Stack>
  );
}
