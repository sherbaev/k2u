import { useEffect, useState } from "react";

/**
 * Small localStorage-backed viewer preferences, currently just the
 * show/hide-coordinates privacy toggle. Reactive across the whole app via a
 * custom window event, so any component using useShowCoords() re-renders the
 * instant the preference changes — no context provider, no reload needed.
 */
const SHOW_COORDS_KEY = "k2u_show_coords";
const SHOW_COORDS_EVENT = "k2u:show-coords-changed";

/** @returns {boolean} default true (coordinates shown) until explicitly hidden. */
export function getShowCoords() {
  try {
    const v = window.localStorage.getItem(SHOW_COORDS_KEY);
    return v === null ? true : v === "1";
  } catch {
    return true;
  }
}

/** @param {boolean} value */
export function setShowCoords(value) {
  try {
    window.localStorage.setItem(SHOW_COORDS_KEY, value ? "1" : "0");
  } catch {
    // localStorage may be unavailable (private mode) — ignore.
  }
  try {
    window.dispatchEvent(new CustomEvent(SHOW_COORDS_EVENT, { detail: { value } }));
  } catch {
    // ignore
  }
}

/** React hook: current show-coordinates preference, updates live app-wide. */
export function useShowCoords() {
  const [value, setValue] = useState(getShowCoords);

  useEffect(() => {
    function onChange(e) {
      setValue(typeof e?.detail?.value === "boolean" ? e.detail.value : getShowCoords());
    }
    window.addEventListener(SHOW_COORDS_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SHOW_COORDS_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return value;
}
