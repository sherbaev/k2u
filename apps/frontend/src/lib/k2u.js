/**
 * Frontend K₂U math — a plain-JS mirror of the tested TypeScript source in
 * `packages/k2u-core`. Kept in JS so the Vite app and its node:test suite have
 * no TS-toolchain dependency. The canonical, authoritative implementation is
 * `packages/k2u-core/src/symmetrical.ts`; this mirror is independently verified
 * against the same invariants in `__tests__/k2u.test.js`.
 */

const TWO_PI_3 = (2 * Math.PI) / 3;

const cMul = (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const cAbs = (a) => Math.hypot(a.re, a.im);
const cArg = (a) => Math.atan2(a.im, a.re);
const A = { re: -0.5, im: Math.sqrt(3) / 2 };
const A2 = { re: -0.5, im: -Math.sqrt(3) / 2 };

export const GOST_NORMAL_PCT = 2.0;
export const GOST_MAX_PCT = 4.0;

/** Forward: (eps, theta) -> line-voltage ratios/magnitudes for unit U1. */
export function ratiosFromEpsTheta(eps, theta) {
  const e2 = eps * eps;
  const uab = Math.sqrt(1 + 2 * eps * Math.cos(theta) + e2);
  const ubc = Math.sqrt(1 + 2 * eps * Math.cos(theta - TWO_PI_3) + e2);
  const uca = Math.sqrt(1 + 2 * eps * Math.cos(theta + TWO_PI_3) + e2);
  return { x: ubc / uab, y: uca / uab, uab, ubc, uca };
}

/** Derive line-voltage magnitudes from phase-neutral magnitudes (nominal 120°). */
export function lineFromPhaseNominal(ua, ub, uc) {
  const bx = ub * Math.cos(-TWO_PI_3), by = ub * Math.sin(-TWO_PI_3);
  const cx = uc * Math.cos(TWO_PI_3), cy = uc * Math.sin(TWO_PI_3);
  return {
    uab: Math.hypot(ua - bx, -by),
    ubc: Math.hypot(bx - cx, by - cy),
    uca: Math.hypot(cx - ua, cy),
  };
}

/** GOST 32144-2013 band. */
export function classifyK2U(k2uPct) {
  if (k2uPct <= GOST_NORMAL_PCT) return "NORMAL";
  if (k2uPct <= GOST_MAX_PCT) return "WARNING";
  return "CRITICAL";
}

/** Inverse: line-voltage magnitudes -> { valid, k2u(%), phi2(deg), status }. */
export function k2uFromVoltages(uab, ubc, uca) {
  const invalid = { valid: false, k2u: NaN, phi2: NaN, status: "CRITICAL" };
  if (!(uab > 0) || !(ubc > 0) || !(uca > 0)) return invalid;
  if (uab + ubc <= uca || ubc + uca <= uab || uca + uab <= ubc) return invalid;

  const reBC = (uca * uca - uab * uab - ubc * ubc) / (2 * uab);
  const im2 = ubc * ubc - reBC * reBC;
  if (im2 < 0) return invalid;
  const imBC = -Math.sqrt(im2);

  const UAB = { re: uab, im: 0 };
  const UBC = { re: reBC, im: imBC };
  const UCA = { re: -uab - reBC, im: -imBC };

  const U1 = {
    re: (UAB.re + cMul(A, UBC).re + cMul(A2, UCA).re) / 3,
    im: (UAB.im + cMul(A, UBC).im + cMul(A2, UCA).im) / 3,
  };
  const U2 = {
    re: (UAB.re + cMul(A2, UBC).re + cMul(A, UCA).re) / 3,
    im: (UAB.im + cMul(A2, UBC).im + cMul(A, UCA).im) / 3,
  };
  const m1 = cAbs(U1);
  const m2 = cAbs(U2);
  if (m1 === 0) return invalid;

  let phi2 = ((cArg(U2) - cArg(U1)) * 180) / Math.PI;
  while (phi2 < 0) phi2 += 360;
  while (phi2 >= 360) phi2 -= 360;

  const k2u = (m2 / m1) * 100;
  return { valid: true, k2u, phi2, status: classifyK2U(k2u) };
}
