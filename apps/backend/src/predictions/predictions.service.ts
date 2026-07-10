import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Model } from "mongoose";
import { CONFIG, type AppConfig } from "../config/configuration.js";
import { Aggregate } from "../schemas/aggregate.schema.js";
import { Device } from "../schemas/device.schema.js";
import { Prediction } from "../schemas/prediction.schema.js";
import { LiveBus } from "../realtime/live-bus.js";
import { buildFeatures, type AggRow, type DeviceMeta } from "./feature-builder.js";

/**
 * Builds RUL features from each device's recent aggregates, calls the AI
 * service, and stores predictions. Runs nightly and on demand.
 */
@Injectable()
export class PredictionsService {
  private readonly log = new Logger(PredictionsService.name);

  constructor(
    @Inject(CONFIG) private readonly config: AppConfig,
    @InjectModel(Aggregate.name) private readonly aggregate: Model<Aggregate>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
    @InjectModel(Prediction.name) private readonly predictions: Model<Prediction>,
    private readonly bus: LiveBus,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async refreshAll(): Promise<void> {
    const devices = await this.devices.find().lean();
    this.log.log(`prediction refresh for ${devices.length} device(s)`);
    for (const d of devices) {
      try {
        await this.refreshDevice(d.devId, d.siteId, {
          device_type: (d as any).deviceType ?? "pv_inverter",
          service_age: (d as any).serviceAge ?? 3,
          rated_power: (d as any).ratedPower ?? 5,
        });
      } catch (e) {
        this.log.warn(`prediction failed for ${d.devId}: ${(e as Error).message}`);
      }
    }
  }

  async refreshDevice(devId: string, siteId: string, meta: DeviceMeta): Promise<Prediction | null> {
    const since = new Date(Date.now() - 31 * 86400000);
    const aggs = (await this.aggregate
      .find({ "meta.devId": devId, ts: { $gte: since } })
      .sort({ ts: 1 })
      .lean()) as unknown as (AggRow & { meta: unknown })[];

    const features = buildFeatures(aggs, meta);
    const body = { items: [{ ...features, siteId, devId }] };

    const res = await fetch(`${this.config.aiUrl}/predict`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`AI service ${res.status}`);
    const json = (await res.json()) as { predictions: Array<Record<string, unknown>> };
    const p = json.predictions?.[0];
    if (!p) return null;

    const doc = await this.predictions.create({
      ts: new Date(),
      siteId,
      devId,
      rul: p.rul,
      rul_lo: p.rul_lo,
      rul_hi: p.rul_hi,
      k2u_forecast: p.k2u_forecast,
      balancer_need: p.balancer_need,
      payback: p.payback ?? undefined,
    });
    this.bus.emit({ kind: "prediction", data: doc });
    return doc;
  }
}
