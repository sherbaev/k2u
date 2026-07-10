/**
 * CSV parsing helpers for the manual bulk-import flow (ManualEntry page).
 * Pure, DOM-free functions so they can be unit-tested under node:test
 * without a browser/File API. Not a full RFC-4180 parser: fields are
 * split on plain commas, but a single wrapping pair of double quotes is
 * tolerated and stripped.
 */

/** Fields that must always remain strings, even when numeric-looking. */
const STRING_FIELDS = new Set(["site_id", "dev_id", "ts"]);

/** Fields coerced to Number by toReadings() when present. */
const NUMBER_FIELDS = ["u_a", "u_b", "u_c", "u_ab", "u_bc", "u_ca", "temp", "load_factor"];

const NUMERIC_RE = /^-?\d+(\.\d+)?$/;

/** Strip a single wrapping pair of double quotes from a trimmed value. */
function stripQuotes(raw) {
  const value = raw.trim();
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}

/** Coerce one cell's raw text to Number unless the field is string-only. */
function coerceCell(field, rawValue) {
  if (rawValue === undefined) return undefined;
  const value = stripQuotes(rawValue);
  if (!STRING_FIELDS.has(field) && NUMERIC_RE.test(value)) {
    return Number(value);
  }
  return value;
}

/**
 * Parse CSV text into an array of row objects keyed by the header row.
 *
 * Rules:
 * - Handles both \r\n and \n line endings; blank lines are ignored.
 * - The first non-blank line is the header (comma-separated field names).
 * - Numeric-looking fields (matching /^-?\d+(\.\d+)?$/) become Number,
 *   except site_id/dev_id/ts, which are always kept as strings.
 * - Missing trailing cells become undefined; extra trailing cells are
 *   ignored (uneven rows do not throw).
 *
 * @param {string} text raw CSV file contents
 * @returns {Array<Record<string, string|number|undefined>>}
 */
export function parseCsv(text) {
  if (!text) return [];

  const lines = text.split(/\r\n|\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const header = lines[0].split(",").map((h) => h.trim());

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(",");
    const row = {};
    header.forEach((field, idx) => {
      row[field] = coerceCell(field, cells[idx]);
    });
    rows.push(row);
  }
  return rows;
}

/** Coerce a single value to a finite Number, or undefined if it can't be. */
function toFiniteNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Map parsed CSV rows (from parseCsv) into /api/readings/bulk payload
 * items: tags each row source:"import" and coerces voltage/temp/
 * load_factor fields to numbers when present. Undefined fields are
 * dropped from the output object.
 *
 * @param {Array<Record<string, any>>} rows
 * @returns {Array<Record<string, any>>}
 */
export function toReadings(rows) {
  return rows.map((row) => {
    const reading = { source: "import" };
    for (const [key, value] of Object.entries(row)) {
      if (value === undefined) continue;
      if (NUMBER_FIELDS.includes(key)) {
        const n = toFiniteNumber(value);
        if (n !== undefined) reading[key] = n;
      } else {
        reading[key] = value;
      }
    }
    return reading;
  });
}
