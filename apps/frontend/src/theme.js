import { createTheme } from "@mui/material/styles";

/**
 * Refined light theme — "scientific instrument" SaaS look for the K₂U
 * monitoring dashboard. Confident deep-blue primary, GOST status colors
 * surfaced as palette entries, soft shadows and rounded cards so screenshots
 * read as a finished product in print (thesis / journal figures).
 */
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#155e9c",
      dark: "#0d4373",
      light: "#4a85bd",
      contrastText: "#ffffff",
    },
    secondary: {
      main: "#0f8b8d",
    },
    background: {
      default: "#f4f6f9",
      paper: "#ffffff",
    },
    success: { main: "#2e7d32", light: "#e6f4ea" }, // NORMAL / PASS
    warning: { main: "#ed6c02", light: "#fdf0e2" }, // WARNING / MARGINAL
    error: { main: "#d32f2f", light: "#fbe9e7" }, // CRITICAL / FAIL
    text: {
      primary: "#1b2430",
      secondary: "#5c6b7a",
    },
    divider: "rgba(20, 30, 45, 0.09)",
  },
  shape: { borderRadius: 12 },
  spacing: 8,
  typography: {
    fontFamily:
      '"Inter", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", sans-serif',
    h1: { fontWeight: 700, letterSpacing: -0.5 },
    h2: { fontWeight: 700, letterSpacing: -0.5 },
    h3: { fontWeight: 700, letterSpacing: -0.3 },
    h4: { fontWeight: 700, letterSpacing: -0.3 },
    h5: { fontWeight: 700, letterSpacing: -0.2 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600, textTransform: "none" },
    body2: { lineHeight: 1.55 },
  },
  shadows: [
    "none",
    "0 1px 2px rgba(16,24,40,0.06)",
    "0 1px 3px rgba(16,24,40,0.08)",
    "0 2px 6px rgba(16,24,40,0.08)",
    "0 2px 8px rgba(16,24,40,0.08)",
    "0 4px 10px rgba(16,24,40,0.08)",
    "0 4px 12px rgba(16,24,40,0.09)",
    "0 6px 16px rgba(16,24,40,0.09)",
    "0 6px 18px rgba(16,24,40,0.10)",
    "0 8px 20px rgba(16,24,40,0.10)",
    "0 8px 22px rgba(16,24,40,0.10)",
    "0 10px 24px rgba(16,24,40,0.10)",
    "0 10px 26px rgba(16,24,40,0.11)",
    "0 12px 28px rgba(16,24,40,0.11)",
    "0 12px 30px rgba(16,24,40,0.11)",
    "0 14px 32px rgba(16,24,40,0.12)",
    "0 14px 34px rgba(16,24,40,0.12)",
    "0 16px 36px rgba(16,24,40,0.12)",
    "0 16px 38px rgba(16,24,40,0.12)",
    "0 18px 40px rgba(16,24,40,0.13)",
    "0 18px 42px rgba(16,24,40,0.13)",
    "0 20px 44px rgba(16,24,40,0.13)",
    "0 20px 46px rgba(16,24,40,0.13)",
    "0 22px 48px rgba(16,24,40,0.14)",
    "0 22px 50px rgba(16,24,40,0.14)",
  ],
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: "#f4f6f9" },
      },
    },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          borderRadius: 12,
          borderColor: "rgba(20, 30, 45, 0.08)",
          boxShadow: "0 1px 3px rgba(16,24,40,0.06)",
          backgroundImage: "none",
        },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: 20,
          "&:last-child": { paddingBottom: 20 },
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: "18px 20px 4px" },
        title: { fontSize: "1rem", fontWeight: 600 },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 600,
          textTransform: "none",
          paddingLeft: 16,
          paddingRight: 16,
        },
        containedPrimary: {
          boxShadow: "0 1px 2px rgba(16,24,40,0.12)",
          "&:hover": { boxShadow: "0 2px 6px rgba(16,24,40,0.16)" },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 6 },
      },
    },
    MuiAppBar: {
      defaultProps: { color: "inherit", elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: "#ffffff",
          color: "#1b2430",
          borderBottom: "1px solid rgba(20, 30, 45, 0.08)",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: "1px solid rgba(20, 30, 45, 0.08)",
          backgroundColor: "#ffffff",
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: "#5c6b7a",
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: 0.4,
          backgroundColor: "#f8fafc",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginLeft: 8,
          marginRight: 8,
          width: "auto",
        },
      },
    },
  },
});
