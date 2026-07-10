import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { deviceStatus } from "./device-status.js";

/** Strip operator-only fields (e.g. `simulated`) before returning a device. */
function publicDevice<T extends Record<string, unknown>>(d: T): Omit<T, "simulated"> {
  const { simulated: _simulated, ...rest } = d as any;
  return rest;
}
import { Telemetry } from "../schemas/telemetry.schema.js";
import { Aggregate } from "../schemas/aggregate.schema.js";
import { AlertEvent } from "../schemas/event.schema.js";
import { Prediction } from "../schemas/prediction.schema.js";
import { Device } from "../schemas/device.schema.js";
import { Site } from "../schemas/site.schema.js";

export interface RangeQuery {
  devId?: string;
  siteId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable()
export class ApiService {
  constructor(
    @InjectModel(Telemetry.name) private readonly telemetry: Model<Telemetry>,
    @InjectModel(Aggregate.name) private readonly aggregate: Model<Aggregate>,
    @InjectModel(AlertEvent.name) private readonly events: Model<AlertEvent>,
    @InjectModel(Prediction.name) private readonly predictions: Model<Prediction>,
    @InjectModel(Device.name) private readonly devices: Model<Device>,
    @InjectModel(Site.name) private readonly sites: Model<Site>,
  ) {}

  listSites() {
    return this.sites.find().lean();
  }

  async listDevices(siteId?: string) {
    const list = await this.devices.find(siteId ? { siteId } : {}).lean();
    return list.map((d) => publicDevice({ ...d, ...deviceStatus(d as any) }));
  }

  async getDevice(devId: string) {
    const dev = await this.devices.findOne({ devId }).lean();
    if (!dev) return null;
    const latest = await this.telemetry.findOne({ "meta.devId": devId }).sort({ ts: -1 }).lean();
    const prediction = await this.predictions.findOne({ devId }).sort({ ts: -1 }).lean();
    return { ...publicDevice({ ...dev, ...deviceStatus(dev as any) }), latest, prediction };
  }

  async patchDevice(devId: string, body: Record<string, unknown>) {
    // `simulated` is operator-only; never let it be set via the public API.
    const { devId: _ignore, _id, simulated: _sim, ...rest } = body as any;
    const dev = await this.devices.findOneAndUpdate({ devId }, { $set: rest }, { new: true }).lean();
    return dev ? publicDevice({ ...dev, ...deviceStatus(dev as any) }) : null;
  }

  upsertSite(body: Record<string, unknown>) {
    const { siteId, ...rest } = body;
    return this.sites.findOneAndUpdate({ siteId }, { $set: { siteId, ...rest } }, { upsert: true, new: true }).lean();
  }

  async upsertDevice(body: Record<string, unknown>) {
    const { devId, simulated: _sim, ...rest } = body as any;
    const dev = await this.devices.findOneAndUpdate({ devId }, { $set: { devId, ...rest } }, { upsert: true, new: true }).lean();
    return publicDevice(dev as any);
  }

  /** Delete a device and all of its data. */
  async deleteDevice(devId: string) {
    await Promise.all([
      this.telemetry.deleteMany({ "meta.devId": devId }),
      this.aggregate.deleteMany({ "meta.devId": devId }),
      this.events.deleteMany({ devId }),
      this.predictions.deleteMany({ devId }),
      this.devices.deleteOne({ devId }),
    ]);
    return { ok: true, devId };
  }

  /** Latest telemetry point for one device, or for every device. */
  async latest(devId?: string) {
    if (devId) {
      return this.telemetry
        .findOne({ "meta.devId": devId })
        .sort({ ts: -1 })
        .lean();
    }
    // one latest doc per device
    return this.telemetry.aggregate([
      { $sort: { ts: -1 } },
      { $group: { _id: "$meta.devId", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
    ]);
  }

  history(q: RangeQuery) {
    const filter = this.rangeFilter(q, "meta.devId");
    return this.telemetry
      .find(filter)
      .sort({ ts: -1 })
      .limit(Math.min(q.limit ?? 1000, 10000))
      .lean();
  }

  aggregates(q: RangeQuery) {
    const filter = this.rangeFilter(q, "meta.devId");
    return this.aggregate
      .find(filter)
      .sort({ ts: -1 })
      .limit(Math.min(q.limit ?? 2000, 20000))
      .lean();
  }

  listEvents(q: RangeQuery) {
    const filter: Record<string, unknown> = {};
    if (q.siteId) filter.siteId = q.siteId;
    if (q.devId) filter.devId = q.devId;
    return this.events
      .find(filter)
      .sort({ ts: -1 })
      .limit(Math.min(q.limit ?? 200, 2000))
      .lean();
  }

  listPredictions(q: RangeQuery) {
    const filter: Record<string, unknown> = {};
    if (q.devId) filter.devId = q.devId;
    if (q.siteId) filter.siteId = q.siteId;
    return this.predictions
      .find(filter)
      .sort({ ts: -1 })
      .limit(Math.min(q.limit ?? 100, 1000))
      .lean();
  }

  private rangeFilter(q: RangeQuery, devField: string): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (q.devId) filter[devField] = q.devId;
    const ts: Record<string, Date> = {};
    if (q.from) ts.$gte = new Date(q.from);
    if (q.to) ts.$lte = new Date(q.to);
    if (Object.keys(ts).length) filter.ts = ts;
    return filter;
  }
}
