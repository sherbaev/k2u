import { useRef } from "react";
import { Box } from "@mui/material";
import CaptureButton from "./CaptureButton.jsx";

/**
 * Wraps a graph/panel and overlays a "save as PNG" camera button in the corner.
 * The button is excluded from the captured image (data-html2canvas-ignore).
 */
export default function CapturePanel({ filename = "figure", children, sx }) {
  const ref = useRef(null);
  return (
    <Box ref={ref} sx={{ position: "relative", height: "100%", ...sx }}>
      {children}
      <Box
        data-html2canvas-ignore="true"
        sx={{ position: "absolute", top: 10, right: 10, zIndex: 3 }}
      >
        <CaptureButton targetRef={ref} filename={filename} />
      </Box>
    </Box>
  );
}
