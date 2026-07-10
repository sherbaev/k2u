/**
 * Device lifecycle status (pure). Derived from provisioning + data freshness +
 * expiry, so the UI can show: waiting for first data → connected/receiving →
 * offline → archived.
 */
export type DeviceStatus = "provisioned" | "receiving" | "offline" | "archived";

export interface DeviceLike {
  firstSeen?: Date | string | null;
  lastSeen?: Date | string | null;
  telemetryPeriodSec?: number | null;
  expiresAt?: Date | string | null;
}

const ms = (d?: Date | string | null): number | null =>
  d ? new Date(d).getTime() : null;

export function deviceStatus(dev: DeviceLike, now: number = Date.now()): {
  status: DeviceStatus;
  lastSeenAgeSec: number | null;
  online: boolean;
} {
  const expires = ms(dev.expiresAt);
  const first = ms(dev.firstSeen);
  const last = ms(dev.lastSeen);
  const period = dev.telemetryPeriodSec && dev.telemetryPeriodSec > 0 ? dev.telemetryPeriodSec : 10;

  if (expires !== null && now >= expires) {
    return { status: "archived", lastSeenAgeSec: last !== null ? Math.round((now - last) / 1000) : null, online: false };
  }
  if (first === null && last === null) {
    return { status: "provisioned", lastSeenAgeSec: null, online: false };
  }
  const lastTs = last ?? first!;
  const ageSec = Math.round((now - lastTs) / 1000);
  // "receiving" if within 2.5 publish periods (min 2 minutes of grace).
  const graceSec = Math.max(period * 2.5, 120);
  const online = ageSec <= graceSec;
  return { status: online ? "receiving" : "offline", lastSeenAgeSec: ageSec, online };
}
