import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { SUB_ALL } from "@k2u/shared-contracts";
import { MqttService } from "../mqtt/mqtt.service.js";
import { LiveBus } from "../realtime/live-bus.js";
import { AlertsService } from "../alerts/alerts.service.js";
import { TelemetryValidator } from "./telemetry-validator.js";
import { Telemetry } from "../schemas/telemetry.schema.js";
import { Aggregate } from "../schemas/aggregate.schema.js";
import { AlertEvent } from "../schemas/event.schema.js";
import { Device } from "../schemas/device.schema.js";

/**
 * Three-stage ingestion pipeline (thesis §3.2): validate → store → event.
 * Subscribes to all device topics, routes by topic suffix, writes to Mongo,
 * and fans out to the LiveBus for the dashboard.
 */
@Injectable()
export class IngestionService implements OnModuleInit {
  private readonly log = new Logger(IngestionService.name);
  /** last seq seen per device, for idempotent handling of resent packets */
  private readonly lastSeq = new Map<string, number>();

  constructor(
    private readonly mqtt: MqttService,
    private readonly bus: LiveBus,
    private readonly alerts: AlertsService,
    private readonly validator: TelemetryValidator,
    @InjectModel(Telemetry.name) private readonly telemetry: Model<Telemetry>,
    @InjectModel(Aggregate.name) private readonly aggregate: Model<Aggregate>,
    @InjectModel(AlertEvent.name) private readonly events: Model<AlertEvent>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
  ) {}

  onModuleInit(): void {
    this.mqtt.subscribe(SUB_ALL, 1);
    this.mqtt.onMessage((topic, payload) => {
      void this.handle(topic, payload);
    });
  }

  private async handle(topic: string, payload: Buffer): Promise<void> {
    const kind = topic.split("/").pop();
    let body: unknown;
    try {
      body = JSON.parse(payload.toString());
    } catch {
      this.log.warn(`rejected non-JSON on ${topic}`);
      return;
    }
    switch (kind) {
      case "telemetry":
        return this.onTelemetry(body);
      case "aggregate":
        return this.onAggregate(body);
      case "alert":
        return this.onAlert(body);
      default:
        return; // cmd/ack handled elsewhere
    }
  }

  private async onTelemetry(body: unknown): Promise<void> {
    const res = this.validator.check(body);
    if (!res.ok || !res.value) {
      this.log.warn(`telemetry rejected: ${res.errors.join("; ")}`);
      return;
    }
    const t = res.value;
    for (const w of res.warnings) this.log.debug(`telemetry warn [${t.dev_id}]: ${w}`);

    // Idempotency: skip an already-seen seq for this device.
    const key = `${t.site_id}/${t.dev_id}`;
    if (typeof t.seq === "number" && this.lastSeq.get(key) === t.seq) return;
    if (typeof t.seq === "number") this.lastSeq.set(key, t.seq);

    const doc = {
      ts: new Date(t.ts),
      meta: { siteId: t.site_id, devId: t.dev_id },
      seq: t.seq,
      u_a: t.u_a, u_b: t.u_b, u_c: t.u_c,
      u_ab: t.u_ab, u_bc: t.u_bc, u_ca: t.u_ca,
      k2u: t.k2u, phi2: t.phi2, freq: t.freq,
      i_a: t.i_a, i_b: t.i_b, i_c: t.i_c,
      temp: t.temp, status: t.status, buf_fill: t.buf_fill,
      source: t.source ?? "device",
    };

    await this.telemetry.create(doc);
    await this.devices.updateOne(
      { devId: t.dev_id },
      { $set: { lastSeen: doc.ts, siteId: t.site_id } },
      { upsert: true },
    );
    this.bus.emit({ kind: "telemetry", data: doc });

    // Alert lifecycle (state-change detection + Telegram) is owned by AlertsService.
    await this.alerts.onTelemetry(t);
  }

  private async onAggregate(body: unknown): Promise<void> {
    const b = body as Record<string, unknown>;
    if (!b || !b.ts || !b.site_id || !b.dev_id) {
      this.log.warn("aggregate rejected: missing ts/site_id/dev_id");
      return;
    }
    await this.aggregate.create({
      ts: new Date(b.ts as string),
      meta: { siteId: b.site_id as string, devId: b.dev_id as string },
      k2u_avg: b.k2u_avg, k2u_min: b.k2u_min, k2u_max: b.k2u_max, k2u_p95: b.k2u_p95,
      exceed_2pct_s: b.exceed_2pct_s, exceed_4pct_s: b.exceed_4pct_s,
      temp_mean: b.temp_mean, temp_max: b.temp_max, load_factor: b.load_factor,
    });
  }

  private async onAlert(body: unknown): Promise<void> {
    const b = body as Record<string, unknown>;
    if (!b || !b.ts || !b.site_id || !b.dev_id || !b.type) return;
    const event = {
      ts: new Date(b.ts as string),
      siteId: b.site_id as string,
      devId: b.dev_id as string,
      type: b.type as string,
      k2u: (b.k2u as number) ?? 0,
      message: (b.message as string) ?? "",
    };
    await this.events.create(event);
    this.bus.emit({ kind: "event", data: event });
  }
}
