import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import type { Telemetry as TelemetryPayload } from "@k2u/shared-contracts";
import { AlertEvent } from "../schemas/event.schema.js";
import { LiveBus } from "../realtime/live-bus.js";
import { TelegramService } from "./telegram.service.js";
import { evaluateTransition, type DeviceAlertState, type Status } from "./alert-logic.js";

/**
 * Owns alert lifecycle: state-change detection (via the pure alert-logic),
 * persistence to `events`, live push, and Telegram dispatch. Called by the
 * ingestion pipeline for every telemetry packet.
 */
@Injectable()
export class AlertsService {
  private readonly log = new Logger(AlertsService.name);
  private readonly state = new Map<string, DeviceAlertState>();
  private readonly cooldownMs = 5 * 60_000;

  constructor(
    @InjectModel(AlertEvent.name) private readonly events: Model<AlertEvent>,
    private readonly bus: LiveBus,
    private readonly telegram: TelegramService,
  ) {}

  async onTelemetry(t: TelemetryPayload): Promise<void> {
    const key = `${t.site_id}/${t.dev_id}`;
    const prev = this.state.get(key);
    const nowMs = new Date(t.ts).getTime() || Date.now();
    const decision = evaluateTransition(prev, t.status as Status, nowMs, this.cooldownMs);

    const nextEmitAt = decision.emit ? nowMs : (prev?.lastEmitAtMs ?? nowMs);
    this.state.set(key, { status: decision.nextStatus, lastEmitAtMs: nextEmitAt });

    if (!decision.emit || t.status === "NORMAL") {
      // Still record recoveries to NORMAL as an informational event.
      if (decision.emit && decision.kind === "recover") await this.record(t, "NORMAL");
      return;
    }
    await this.record(t, t.status);
  }

  private async record(t: TelemetryPayload, type: string): Promise<void> {
    const event = {
      ts: new Date(t.ts),
      siteId: t.site_id,
      devId: t.dev_id,
      type,
      k2u: t.k2u,
      message: `K₂U ${t.k2u}% (${type})`,
    };
    await this.events.create(event);
    this.bus.emit({ kind: "event", data: event });
    if (type !== "NORMAL") {
      await this.telegram.send(
        `⚠️ <b>${type}</b> — ${t.site_id}/${t.dev_id}\nK₂U = ${t.k2u}% at ${t.ts}`,
      );
    }
    this.log.log(`alert ${type} ${t.site_id}/${t.dev_id} K2U=${t.k2u}%`);
  }

  async ack(eventId: string, by: string): Promise<void> {
    await this.events.updateOne({ _id: eventId }, { $set: { ackBy: by, ackAt: new Date() } });
  }
}
