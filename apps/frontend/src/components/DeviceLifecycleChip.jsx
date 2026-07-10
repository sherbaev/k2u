import { Box, Chip } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { Archive } from "lucide-react";

/**
 * Device *lifecycle* status chip — provisioned / receiving / offline /
 * archived — as distinct from StatusBadge, which renders the *telemetry
 * quality* band (NORMAL/WARNING/CRITICAL) for a single reading. Used on the
 * device detail page header and on Devices list cards.
 */
const META = {
  provisioned: {
    label: "Waiting for first data",
    dot: "#8a94a6",
    pulse: true,
    bg: (t) => (t.palette.mode === "dark" ? "rgba(255,255,255,0.08)" : "rgba(90,100,115,0.12)"),
    fg: (t) => t.palette.text.secondary,
  },
  receiving: {
    label: "Connected · receiving data",
    dot: null,
    pulse: false,
    bg: (t) => alpha(t.palette.success.main, t.palette.mode === "dark" ? 0.22 : 0.14),
    fg: (t) => t.palette.success.main,
  },
  offline: {
    label: "Offline",
    dot: null,
    pulse: false,
    bg: (t) => alpha(t.palette.warning.main, t.palette.mode === "dark" ? 0.24 : 0.16),
    fg: (t) => t.palette.warning.main,
  },
  archived: {
    label: "Archived",
    dot: null,
    pulse: false,
    bg: () => "#1f2733",
    fg: () => "#cbd3dc",
  },
};

function PulseDot({ color }) {
  return (
    <Box
      component="span"
      sx={{
        width: 8,
        height: 8,
        ml: 1.25,
        borderRadius: "50%",
        bgcolor: color,
        display: "inline-block",
        flexShrink: 0,
        animation: "k2u-status-pulse 1.8s ease-out infinite",
        "@keyframes k2u-status-pulse": {
          "0%": { boxShadow: `0 0 0 0 ${alpha(color, 0.6)}` },
          "70%": { boxShadow: `0 0 0 7px ${alpha(color, 0)}` },
          "100%": { boxShadow: `0 0 0 0 ${alpha(color, 0)}` },
        },
      }}
    />
  );
}

/**
 * @param {{status?: "provisioned"|"receiving"|"offline"|"archived", size?: "small"|"medium"}} props
 */
export default function DeviceLifecycleChip({ status, size = "medium" }) {
  const meta = META[status] || META.provisioned;
  return (
    <Chip
      size={size}
      icon={
        meta.pulse ? (
          <PulseDot color={meta.dot} />
        ) : status === "archived" ? (
          <Archive size={13} style={{ marginLeft: 9 }} />
        ) : (
          <Box component="span" sx={{ width: 8, height: 8, ml: 1.25, borderRadius: "50%", bgcolor: meta.dot || "currentColor", display: "inline-block" }} />
        )
      }
      label={meta.label}
      sx={{
        bgcolor: meta.bg,
        color: meta.fg,
        fontWeight: 600,
        "& .MuiChip-icon": { color: "inherit" },
      }}
    />
  );
}
