import { useState } from "react";
import {
  IconButton,
  Tooltip,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Camera, Image as ImageIcon, FileCode } from "lucide-react";
import { captureToPng, captureSvg, hasSvg } from "../lib/capture.js";

/**
 * Camera button that saves the referenced graph as a figure. Offers a crisp
 * vector SVG (for SVG-based charts) and a high-resolution PNG.
 */
export default function CaptureButton({ targetRef, filename = "figure", size = "small" }) {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [anchor, setAnchor] = useState(null);

  const svgAvailable = hasSvg(targetRef?.current);

  function open(e) {
    e.stopPropagation();
    setAnchor(e.currentTarget);
  }
  function close() {
    setAnchor(null);
  }

  async function savePng() {
    close();
    if (!targetRef?.current) return;
    setBusy(true);
    try {
      await captureToPng(targetRef.current, { filename, background: theme.palette.background.paper });
    } finally {
      setBusy(false);
    }
  }

  function saveSvg() {
    close();
    captureSvg(targetRef?.current, { filename, background: theme.palette.background.paper });
  }

  return (
    <>
      <Tooltip title="Save this graph as an image (PNG / SVG)">
        <IconButton
          size={size}
          onClick={open}
          disabled={busy}
          aria-label="Save graph as image"
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
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        {svgAvailable && (
          <MenuItem onClick={saveSvg}>
            <ListItemIcon>
              <FileCode size={16} />
            </ListItemIcon>
            <ListItemText primary="Download SVG" secondary="Vector — best for papers" />
          </MenuItem>
        )}
        <MenuItem onClick={savePng}>
          <ListItemIcon>
            <ImageIcon size={16} />
          </ListItemIcon>
          <ListItemText primary="Download PNG" secondary="High-resolution image" />
        </MenuItem>
      </Menu>
    </>
  );
}
