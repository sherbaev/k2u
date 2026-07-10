import Ajv2020 from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { classifyK2U, k2uBeta } from "@k2u/core";
import type { Telemetry } from "@k2u/shared-contracts";

export interface ValidationResult {
  ok: boolean;
  /** Schema/range errors that cause rejection. */
  errors: string[];
  /** Non-fatal advisories (e.g. reported status disagrees with K2U band). */
  warnings: string[];
  /** The parsed packet when ok. */
  value?: Telemetry;
}

/**
 * Validates raw MQTT telemetry against the canonical JSON Schema and applies
 * business rules:
 *   - hard reject: schema/type/range violations (thesis §3.2 stage 1)
 *   - soft warn:   reported `status` disagrees with the GOST band of `k2u`
 *   - soft warn:   reported `k2u` disagrees with a recompute from line voltages
 *
 * The schema object is injected so this class is trivially unit-testable
 * without the Nest/Mongo runtime.
 */
export class TelemetryValidator {
  private readonly validate: ValidateFunction;
  /** absolute % tolerance for the K2U recompute cross-check */
  private readonly k2uTolerancePct: number;

  constructor(schema: object, k2uTolerancePct = 0.5) {
    const ajv = new Ajv2020({ allErrors: true, coerceTypes: false });
    addFormats(ajv);
    this.validate = ajv.compile(schema);
    this.k2uTolerancePct = k2uTolerancePct;
  }

  check(raw: unknown): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof raw !== "object" || raw === null) {
      return { ok: false, errors: ["payload is not an object"], warnings };
    }

    if (!this.validate(raw)) {
      for (const e of this.validate.errors ?? []) {
        errors.push(`${e.instancePath || "(root)"} ${e.message ?? "invalid"}`);
      }
      return { ok: false, errors, warnings };
    }

    const t = raw as Telemetry;

    // Rule: status must match the GOST band of the reported k2u.
    const expected = classifyK2U(t.k2u);
    if (t.status !== expected) {
      warnings.push(
        `status "${t.status}" disagrees with GOST band of k2u=${t.k2u}% (expected "${expected}")`,
      );
    }

    // Rule: if line voltages are present, recomputed K2U should match.
    if (
      typeof t.u_ab === "number" &&
      typeof t.u_bc === "number" &&
      typeof t.u_ca === "number"
    ) {
      const recomputed = k2uBeta(t.u_ab, t.u_bc, t.u_ca);
      if (
        Number.isFinite(recomputed) &&
        Math.abs(recomputed - t.k2u) > this.k2uTolerancePct
      ) {
        warnings.push(
          `reported k2u=${t.k2u}% differs from recompute ${recomputed.toFixed(2)}% ` +
            `by >${this.k2uTolerancePct}%`,
        );
      }
    }

    return { ok: true, errors, warnings, value: t };
  }
}
