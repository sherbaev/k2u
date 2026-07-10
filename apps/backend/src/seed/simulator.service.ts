import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Model } from "mongoose";
import { Telemetry } from "../schemas/telemetry.schema.js";
import { Aggregate } from "../schemas/aggregate.schema.js";
import { Device } from "../schemas/device.schema.js";
import { AlertEvent } from "../schemas/event.schema.js";
import { LiveBus } from "../realtime/live-bus.js";
import { generateOnePoint } from "./seed-gen.js";
import { classifyK2U } from "@k2u/core";

/**
 * Makes `simulated` devices behave like real nodes: every hour it publishes a
 * fresh telemetry + aggregate point, refreshes lastSeen (so status shows
 * "receiving"), and raises alerts on WARNING/CRITICAL — as if an ESP32 were
 * transmitting.
 */
@Injectable()
export class SimulatorService {
  private readonly log = new Logger(SimulatorService.name);

  constructor(
    @InjectModel(Telemetry.name) private readonly telemetry: Model<Telemetry>,
    @InjectModel(Aggregate.name) private readonly aggregate: Model<Aggregate>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
    @InjectModel(AlertEvent.name) private readonly events: Model<AlertEvent>,
    private readonly bus: LiveBus,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async tick(): Promise<void> {
    const now = Date.now();
    const sims = await this.devices.find({ simulated: true }).lean();
    for (const d of sims) {
      // Skip archived devices.
      if (d.expiresAt && now >= new Date(d.expiresAt).getTime()) continue;
      const deviceType = (d as any).deviceType === "telecom_rect" ? "telecom_rect" : "pv_inverter";
      const baseK2u = deviceType === "pv_inverter" ? 1.5 : 2.4;
      const { telemetry, aggregate } = generateOnePoint(
        { deviceType, baseK2u, seed: hash(d.devId) },
        now,
      );
      const meta = { siteId: d.siteId, devId: d.devId };
      const tdoc = { ts: telemetry.ts, meta, ...omitTs(telemetry), source: "device" };
      const adoc = { ts: aggregate.ts, meta, ...omitTs(aggregate) };
      await this.telemetry.create(tdoc);
      await this.aggregate.create(adoc);
      await this.devices.updateOne(
        { devId: d.devId },
        { $set: { lastSeen: telemetry.ts, ...(d.firstSeen ? {} : { firstSeen: telemetry.ts }) } },
      );
      this.bus.emit({ kind: "telemetry", data: tdoc });
      if (telemetry.status !== "NORMAL") {
        const ev = { ts: telemetry.ts, siteId: d.siteId, devId: d.devId, type: telemetry.status, k2u: telemetry.k2u, message: `K₂U ${telemetry.k2u}% (${telemetry.status})` };
        await this.events.create(ev);
        this.bus.emit({ kind: "event", data: ev });
      }
    }
    if (sims.length) this.log.log(`simulator tick: ${sims.length} device(s)`);
    void classifyK2U; // (kept for parity with the shared math)
  }
}

function omitTs<T extends { ts: Date }>(o: T): Omit<T, "ts"> {
  const { ts, ...rest } = o;
  return rest;
}
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h) || 1;
}
