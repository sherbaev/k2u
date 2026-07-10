import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Telemetry } from "../schemas/telemetry.schema.js";
import { Device } from "../schemas/device.schema.js";
import { LiveBus } from "../realtime/live-bus.js";
import { AlertsService } from "../alerts/alerts.service.js";
import { computeReading, type RawReading } from "./manual-logic.js";

export interface ReadingInput extends RawReading {
  site_id: string;
  dev_id: string;
  ts?: string;
  temp?: number;
  load_factor?: number;
  source?: "manual" | "import";
}

@Injectable()
export class ManualService {
  private readonly log = new Logger(ManualService.name);

  constructor(
    @InjectModel(Telemetry.name) private readonly telemetry: Model<Telemetry>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
    private readonly bus: LiveBus,
    private readonly alerts: AlertsService,
  ) {}

  /** Compute + store one reading. Returns the computed telemetry or an error. */
  async ingestOne(input: ReadingInput): Promise<{ ok: boolean; error?: string; k2u?: number; status?: string }> {
    if (!input.site_id || !input.dev_id) return { ok: false, error: "site_id and dev_id required" };
    const c = computeReading(input);
    if (!c.ok) return { ok: false, error: c.error };

    const ts = input.ts ? new Date(input.ts) : new Date();
    const source = input.source ?? "manual";
    const doc = {
      ts,
      meta: { siteId: input.site_id, devId: input.dev_id },
      u_a: c.u_a, u_b: c.u_b, u_c: c.u_c,
      u_ab: c.u_ab, u_bc: c.u_bc, u_ca: c.u_ca,
      k2u: c.k2u, phi2: c.phi2, status: c.status,
      temp: input.temp, source,
    };
    await this.telemetry.create(doc);
    await this.devices.updateOne(
      { devId: input.dev_id },
      { $set: { lastSeen: ts, siteId: input.site_id } },
      { upsert: true },
    );
    this.bus.emit({ kind: "telemetry", data: doc });
    await this.alerts.onTelemetry({
      ts: ts.toISOString(), site_id: input.site_id, dev_id: input.dev_id,
      seq: 0, k2u: c.k2u, status: c.status,
    } as any);
    return { ok: true, k2u: c.k2u, status: c.status };
  }

  /** Bulk import; returns inserted/rejected counts. */
  async ingestBulk(items: ReadingInput[]): Promise<{ inserted: number; rejected: number; errors: string[] }> {
    let inserted = 0;
    let rejected = 0;
    const errors: string[] = [];
    for (const it of items) {
      const r = await this.ingestOne({ ...it, source: it.source ?? "import" });
      if (r.ok) inserted++;
      else { rejected++; if (errors.length < 20) errors.push(r.error ?? "unknown"); }
    }
    this.log.log(`bulk import: ${inserted} inserted, ${rejected} rejected`);
    return { inserted, rejected, errors };
  }
}
