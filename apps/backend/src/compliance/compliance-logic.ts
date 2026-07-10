/** GOST 32144-2013 weekly verdict from the weekly 95-percentile of K₂U (pure). */
export type Verdict = "PASS" | "MARGINAL" | "FAIL";

export function verdictFor(k2uP95: number): Verdict {
  if (k2uP95 <= 2.0) return "PASS";
  if (k2uP95 <= 4.0) return "MARGINAL";
  return "FAIL";
}
