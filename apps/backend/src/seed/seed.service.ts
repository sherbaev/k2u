import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { Telemetry } from "../schemas/telemetry.schema.js";
import { Aggregate } from "../schemas/aggregate.schema.js";
import { Device } from "../schemas/device.schema.js";
import { Site } from "../schemas/site.schema.js";
import { Compliance } from "../compliance/compliance.schema.js";
import { PredictionsService } from "../predictions/predictions.service.js";
import { DEMO_DEVICES, generateSeries, recentTelemetry, weeklyCompliance } from "./seed-gen.js";

/**
 * Seeds two simulated ESP32 nodes with ~2 months of physics-based history so the
 * dashboard, GOST reports and RUL predictions reproduce the paper's regime.
 */
@Injectable()
export class SeedService {
  private readonly log = new Logger(SeedService.name);

  constructor(
    @InjectModel(Telemetry.name) private readonly telemetry: Model<Telemetry>,
    @InjectModel(Aggregate.name) private readonly aggregate: Model<Aggregate>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
    @InjectModel(Site.name) private readonly sites: Model<Site>,
    @InjectModel(Compliance.name) private readonly compliance: Model<Compliance>,
    private readonly predictions: PredictionsService,
  ) {}

  async clear(): Promise<void> {
    const devIds = DEMO_DEVICES.map((d) => d.devId);
    const siteIds = DEMO_DEVICES.map((d) => d.siteId);
    await Promise.all([
      this.telemetry.deleteMany({ "meta.devId": { $in: devIds } }),
      this.aggregate.deleteMany({ "meta.devId": { $in: devIds } }),
      this.compliance.deleteMany({ devId: { $in: devIds } }),
      this.devices.deleteMany({ devId: { $in: devIds } }),
      this.sites.deleteMany({ siteId: { $in: siteIds } }),
    ]);
  }

  async seed(days = 60): Promise<{ ok: boolean; devices: unknown[] }> {
    await this.clear();
    const now = Date.now();
    const summary: unknown[] = [];

    for (const spec of DEMO_DEVICES) {
      await this.sites.create({
        siteId: spec.siteId, name: spec.siteName,
        type: spec.deviceType === "pv_inverter" ? "pv" : "telecom",
        location: spec.location,
        ratings: { ratedPowerKw: spec.ratedPower, voltage: 380 },
      });
      await this.devices.create({
        devId: spec.devId, siteId: spec.siteId, name: spec.name,
        deviceType: spec.deviceType, ratedPower: spec.ratedPower,
        serviceAge: spec.serviceAge, location: spec.location,
        phaseConfig: "4-wire-380/220",
        firstSeen: new Date(now - days * 86400000), lastSeen: new Date(now),
        telemetryPeriodSec: 3600, simulated: true,
        energyKwh: Math.round(spec.ratedPower * 24 * days * (spec.deviceType === "pv_inverter" ? 0.18 : 0.55)),
      });

      const agg = generateSeries(spec, days, now);
      const meta = { siteId: spec.siteId, devId: spec.devId };

      // bulk insert aggregates (time-series)
      await this.aggregate.insertMany(agg.map((a) => ({ ts: a.ts, meta, ...stripTs(a) })), { ordered: false });

      // recent telemetry (last 48h) for the live charts + nomogram
      const tel = recentTelemetry(spec, agg, 48);
      await this.telemetry.insertMany(
        tel.map((t) => ({ ts: t.ts, meta, ...stripTs(t), source: "import" })),
        { ordered: false },
      );

      // weekly GOST compliance
      const weekly = weeklyCompliance(agg);
      await this.compliance.insertMany(
        weekly.map((w) => ({ ts: new Date(now), siteId: spec.siteId, devId: spec.devId, ...w })),
      );

      // RUL prediction from the AI service (best-effort)
      let pred: unknown = null;
      try {
        pred = await this.predictions.refreshDevice(spec.devId, spec.siteId, {
          device_type: spec.deviceType, service_age: spec.serviceAge, rated_power: spec.ratedPower,
        });
      } catch (e) {
        this.log.warn(`prediction for ${spec.devId} failed: ${(e as Error).message}`);
      }

      const p95All = weekly.map((w) => w.k2u_p95).sort((a, b) => a - b);
      summary.push({
        devId: spec.devId, name: spec.name, type: spec.deviceType,
        aggregates: agg.length, telemetry: tel.length, weeks: weekly.length,
        worstWeeklyP95: p95All[p95All.length - 1],
        prediction: pred,
      });
      this.log.log(`seeded ${spec.devId}: ${agg.length} aggregates, ${weekly.length} weeks`);
    }
    return { ok: true, devices: summary };
  }
}

function stripTs<T extends { ts: Date }>(o: T): Omit<T, "ts"> {
  const { ts, ...rest } = o;
  return rest;
}
