import { Card, CardContent, Stack, Box, Typography } from "@mui/material";

const TONES = {
  primary: { bg: "rgba(21,94,156,0.10)", fg: "#155e9c" },
  success: { bg: "rgba(46,125,50,0.10)", fg: "#2e7d32" },
  warning: { bg: "rgba(237,108,2,0.10)", fg: "#ed6c02" },
  error: { bg: "rgba(211,47,47,0.10)", fg: "#d32f2f" },
  neutral: { bg: "rgba(92,107,122,0.10)", fg: "#5c6b7a" },
};

/**
 * Compact "at a glance" summary tile used in the top row of the dashboard
 * and devices page (count, worst K₂U, compliance, alerts, etc).
 */
export default function StatCard({ icon, label, value, hint, tone = "primary" }) {
  const t = TONES[tone] || TONES.primary;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="flex-start">
          {icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: t.bg,
                color: t.fg,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.4, fontWeight: 700 }}>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, mt: 0.25 }}>
              {value}
            </Typography>
            {hint && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {hint}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}
