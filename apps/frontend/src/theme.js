import { createTheme } from "@mui/material/styles";

/**
 * Refined "scientific instrument" SaaS theme for the K₂U monitoring
 * dashboard, available in both light and dark modes so screenshots read as
 * a finished, print-quality product (thesis / journal figures) either way.
 *
 * GOST status colors (success/warning/error) are kept consistent in meaning
 * across both modes — only their exact hex is tuned for contrast.
 */

const SHARED_SHADOWS_LIGHT = [
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
];

const SHARED_SHADOWS_DARK = [
  "none",
  "0 1px 2px rgba(0,0,0,0.35)",
  "0 1px 3px rgba(0,0,0,0.38)",
  "0 2px 6px rgba(0,0,0,0.40)",
  "0 2px 8px rgba(0,0,0,0.40)",
  "0 4px 10px rgba(0,0,0,0.42)",
  "0 4px 12px rgba(0,0,0,0.42)",
  "0 6px 16px rgba(0,0,0,0.44)",
  "0 6px 18px rgba(0,0,0,0.44)",
  "0 8px 20px rgba(0,0,0,0.46)",
  "0 8px 22px rgba(0,0,0,0.46)",
  "0 10px 24px rgba(0,0,0,0.48)",
  "0 10px 26px rgba(0,0,0,0.48)",
  "0 12px 28px rgba(0,0,0,0.50)",
  "0 12px 30px rgba(0,0,0,0.50)",
  "0 14px 32px rgba(0,0,0,0.52)",
  "0 14px 34px rgba(0,0,0,0.52)",
  "0 16px 36px rgba(0,0,0,0.54)",
  "0 16px 38px rgba(0,0,0,0.54)",
  "0 18px 40px rgba(0,0,0,0.56)",
  "0 18px 42px rgba(0,0,0,0.56)",
  "0 20px 44px rgba(0,0,0,0.58)",
  "0 20px 46px rgba(0,0,0,0.58)",
  "0 22px 48px rgba(0,0,0,0.60)",
  "0 22px 50px rgba(0,0,0,0.60)",
];

const LIGHT_PALETTE = {
  mode: "light",
  primary: {
    main: "#155e9c",
    dark: "#0d4373",
    light: "#4a85bd",
    contrastText: "#ffffff",
  },
  secondary: { main: "#0f8b8d" },
  background: {
    default: "#f4f6f9",
    paper: "#ffffff",
  },
  success: { main: "#2e7d32", light: "#e6f4ea" },
  warning: { main: "#ed6c02", light: "#fdf0e2" },
  error: { main: "#d32f2f", light: "#fbe9e7" },
  text: {
    primary: "#1b2430",
    secondary: "#5c6b7a",
  },
  divider: "rgba(20, 30, 45, 0.09)",
};

const DARK_PALETTE = {
  mode: "dark",
  primary: {
    main: "#4a90d9",
    dark: "#2f6cad",
    light: "#7ab0e6",
    contrastText: "#08121c",
  },
  secondary: { main: "#2bb6b8" },
  background: {
    default: "#0f151c",
    paper: "#171f29",
  },
  success: { main: "#4caf50", light: "rgba(76,175,80,0.16)" },
  warning: { main: "#f6a53c", light: "rgba(246,165,60,0.16)" },
  error: { main: "#ef5350", light: "rgba(239,83,80,0.16)" },
  text: {
    primary: "#eef2f6",
    secondary: "#93a1b0",
  },
  divider: "rgba(255, 255, 255, 0.09)",
};

const TYPOGRAPHY = {
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
};

/**
 * @param {"light"|"dark"} mode
 * @returns {import("@mui/material/styles").Theme}
 */
export function getTheme(mode) {
  const isDark = mode === "dark";
  const palette = isDark ? DARK_PALETTE : LIGHT_PALETTE;
  const shadows = isDark ? SHARED_SHADOWS_DARK : SHARED_SHADOWS_LIGHT;
  const cardBorder = isDark ? "rgba(255,255,255,0.08)" : "rgba(20, 30, 45, 0.08)";
  const tableHeadBg = isDark ? "#1b2532" : "#f8fafc";

  return createTheme({
    palette,
    shape: { borderRadius: 12 },
    spacing: 8,
    typography: TYPOGRAPHY,
    shadows,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { backgroundColor: palette.background.default },
        },
      },
      MuiCard: {
        defaultProps: { variant: "outlined" },
        styleOverrides: {
          root: {
            borderRadius: 12,
            borderColor: cardBorder,
            boxShadow: isDark ? "0 1px 3px rgba(0,0,0,0.35)" : "0 1px 3px rgba(16,24,40,0.06)",
            backgroundImage: "none",
            backgroundColor: palette.background.paper,
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
            backgroundColor: palette.background.paper,
            color: palette.text.primary,
            borderBottom: `1px solid ${cardBorder}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: `1px solid ${cardBorder}`,
            backgroundColor: palette.background.paper,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            fontWeight: 700,
            color: palette.text.secondary,
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: 0.4,
            backgroundColor: tableHeadBg,
          },
          root: {
            borderBottomColor: cardBorder,
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
}

// Backward-compatible default export (light theme) for any stray imports.
export const theme = getTheme("light");
