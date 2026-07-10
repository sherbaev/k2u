/**
 * Pure alert state-machine (no I/O) — unit-testable.
 *
 * Emits an alert only on a GOST state *transition* (thesis §3.2): escalations
 * (NORMAL→WARNING→CRITICAL) always fire; de-escalations/recoveries fire unless
 * within the cooldown window, which suppresses flapping.
 */
export type Status = "NORMAL" | "WARNING" | "CRITICAL";

const RANK: Record<Status, number> = { NORMAL: 0, WARNING: 1, CRITICAL: 2 };

export interface DeviceAlertState {
  status: Status;
  lastEmitAtMs: number;
}

export interface AlertDecision {
  emit: boolean;
  kind: "none" | "escalate" | "recover";
  nextStatus: Status;
}

export function evaluateTransition(
  prev: DeviceAlertState | undefined,
  newStatus: Status,
  nowMs: number,
  cooldownMs: number,
): AlertDecision {
  if (!prev) {
    // First observation: only alert if already abnormal.
    const emit = newStatus !== "NORMAL";
    return { emit, kind: emit ? "escalate" : "none", nextStatus: newStatus };
  }
  if (newStatus === prev.status) {
    return { emit: false, kind: "none", nextStatus: newStatus };
  }
  const escalate = RANK[newStatus] > RANK[prev.status];
  const withinCooldown = nowMs - prev.lastEmitAtMs < cooldownMs;
  // Escalations bypass cooldown; recoveries respect it.
  const emit = escalate || !withinCooldown;
  return { emit, kind: escalate ? "escalate" : "recover", nextStatus: newStatus };
}
