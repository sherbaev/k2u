import { createTheme } from "@mui/material/styles";

/** Light theme with GOST status colors surfaced as palette entries. */
export const theme = createTheme({
  palette: {
    mode: "light",
    background: { default: "#f5f6f8" },
    success: { main: "#2e7d32" }, // NORMAL / PASS
    warning: { main: "#ed6c02" }, // WARNING / MARGINAL
    error: { main: "#d32f2f" }, // CRITICAL / FAIL
    primary: { main: "#1565c0" },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
});
