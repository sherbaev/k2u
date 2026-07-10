/**
 * Small shared formatting helpers for device lifecycle/UX copy — age since
 * last telemetry, human telemetry-period labels, and date rendering. Kept
 * dependency-free (no date-fns) since these are one-line conversions.
 */

/** @param {number|null|undefined} seconds @returns {string} e.g. "45s ago", "12m ago", "3h ago", "5d ago" */
export function formatAge(seconds) {
  if (seconds === undefined || seconds === null || !Number.isFinite(seconds)) return "—";
  const s = Math.max(0, seconds);
  if (s < 60) return `${Math.round(s)}s ago`;
  const minutes = s / 60;
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)}h ago`;
  const days = hours / 24;
  return `${Math.round(days)}d ago`;
}

/** @param {number|null|undefined} sec telemetry period in seconds @returns {string} e.g. "every 60 s", "every 5 min", "every 1 hour" */
export function formatPeriod(sec) {
  const s = Number(sec);
  if (!Number.isFinite(s) || s <= 0) return "—";
  if (s < 60) return `every ${s}s`;
  if (s % 3600 === 0) {
    const h = s / 3600;
    return `every ${h} hour${h === 1 ? "" : "s"}`;
  }
  const m = s / 60;
  return `every ${m} min`;
}

/** @param {string|null|undefined} iso @returns {string} localized date-time, "—" if absent/invalid */
export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** @param {string|null|undefined} iso @returns {string} YYYY-MM-DD for a date <input>, "" if absent/invalid */
export function toDateInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** @param {string} dateInputValue YYYY-MM-DD from a date <input> @returns {string|null} ISO end-of-day timestamp, or null if empty */
export function fromDateInputValue(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T23:59:59`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
