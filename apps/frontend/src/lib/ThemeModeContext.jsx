import { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "k2u_theme";
const ThemeModeContext = createContext({ mode: "light", toggle: () => {} });

function readStoredMode() {
  if (typeof window === "undefined") return "light";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : "light";
  } catch {
    return "light";
  }
}

/**
 * Light/dark mode provider. Persists the choice in localStorage ("k2u_theme")
 * so the preference survives reloads. Wrap the app once, near the root.
 */
export function ThemeModeProvider({ children }) {
  const [mode, setMode] = useState(readStoredMode);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // localStorage may be unavailable (private mode, SSR) — ignore.
    }
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggle: () => setMode((m) => (m === "light" ? "dark" : "light")),
      setMode,
    }),
    [mode],
  );

  return <ThemeModeContext.Provider value={value}>{children}</ThemeModeContext.Provider>;
}

/** { mode: "light"|"dark", toggle(): void, setMode(mode): void } */
export function useThemeMode() {
  return useContext(ThemeModeContext);
}
