import { useState } from "react";
import { IconButton, Tooltip, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Camera } from "lucide-react";
import { captureToPng } from "../lib/capture.js";

/** Small camera button that saves the referenced element as a PNG figure. */
export default function CaptureButton({ targetRef, filename = "figure", size = "small" }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);

  async function handleCapture() {
    if (!targetRef?.current) return;
    setBusy(true);
    try {
      await captureToPng(targetRef.current, {
        filename,
        background: theme.palette.background.paper,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Tooltip title="Save this graph as an image (PNG) — for papers / figures">
      <IconButton
        size={size}
        onClick={handleCapture}
        disabled={busy}
        aria-label="Save as image"
        sx={{
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        {busy ? <CircularProgress size={16} /> : <Camera size={16} />}
      </IconButton>
    </Tooltip>
  );
}
