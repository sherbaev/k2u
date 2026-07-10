import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Model } from "mongoose";
import { Aggregate } from "../schemas/aggregate.schema.js";
import { Device } from "../schemas/device.schema.js";
import { Compliance } from "./compliance.schema.js";
import { percentile } from "../predictions/feature-builder.js";
import { verdictFor } from "./compliance-logic.js";

@Injectable()
export class ComplianceService {
  private readonly log = new Logger(ComplianceService.name);

  constructor(
    @InjectModel(Aggregate.name) private readonly aggregate: Model<Aggregate>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
    @InjectModel(Compliance.name) private readonly compliance: Model<Compliance>,
  ) {}

  /** Nightly rollup of the trailing 7 days into a weekly compliance record. */
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async rollupAll(): Promise<void> {
    const weekStart = new Date(Date.now() - 7 * 86400000);
    const devices = await this.devices.find().lean();
    for (const d of devices) {
      try {
        await this.rollupDevice(d.devId, d.siteId, weekStart);
      } catch (e) {
        this.log.warn(`compliance rollup failed for ${d.devId}: ${(e as Error).message}`);
      }
    }
    this.log.log(`compliance rollup done for ${devices.length} device(s)`);
  }

  async rollupDevice(devId: string, siteId: string, weekStart: Date): Promise<Compliance | null> {
    const rows = await this.aggregate
      .find({ "meta.devId": devId, ts: { $gte: weekStart } })
      .lean();
    if (rows.length === 0) return null;

    const p95series = rows.map((r: any) => Number(r.k2u_p95 ?? r.k2u_avg ?? 0));
    const k2u_p95 = percentile(p95series, 95);
    const exceed_2pct_s = rows.reduce((a: number, r: any) => a + Number(r.exceed_2pct_s ?? 0), 0);
    const exceed_4pct_s = rows.reduce((a: number, r: any) => a + Number(r.exceed_4pct_s ?? 0), 0);

    return this.compliance.findOneAndUpdate(
      { devId, weekStart },
      {
        $set: {
          ts: new Date(),
          siteId,
          k2u_p95,
          exceed_2pct_s,
          exceed_4pct_s,
          verdict: verdictFor(k2u_p95),
        },
      },
      { upsert: true, new: true },
    );
  }

  list(devId?: string, siteId?: string) {
    const filter: Record<string, unknown> = {};
    if (devId) filter.devId = devId;
    if (siteId) filter.siteId = siteId;
    return this.compliance.find(filter).sort({ weekStart: -1 }).limit(52).lean();
  }
}
