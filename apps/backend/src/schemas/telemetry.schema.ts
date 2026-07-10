import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TelemetryDocument = HydratedDocument<Telemetry>;

/** Per-device meta subdocument (the time-series metaField). */
@Schema({ _id: false })
export class TelemetryMeta {
  @Prop({ required: true, index: true })
  siteId!: string;

  @Prop({ required: true, index: true })
  devId!: string;
}
const TelemetryMetaSchema = SchemaFactory.createForClass(TelemetryMeta);

/**
 * Raw telemetry, stored as a MongoDB time-series collection.
 * timeField = ts, metaField = meta {siteId, devId}. Bucketed by minutes.
 * TTL (expireAfterSeconds) is applied at module init from config (default 90 days).
 */
@Schema({
  timeseries: {
    timeField: "ts",
    metaField: "meta",
    granularity: "minutes",
  },
  autoCreate: true,
})
export class Telemetry {
  @Prop({ required: true })
  ts!: Date;

  @Prop({ type: TelemetryMetaSchema, required: true })
  meta!: TelemetryMeta;

  @Prop() seq?: number;
  @Prop() u_a?: number;
  @Prop() u_b?: number;
  @Prop() u_c?: number;
  @Prop() u_ab?: number;
  @Prop() u_bc?: number;
  @Prop() u_ca?: number;
  @Prop({ required: true }) k2u!: number;
  @Prop() phi2?: number;
  @Prop() freq?: number;
  @Prop() i_a?: number;
  @Prop() i_b?: number;
  @Prop() i_c?: number;
  @Prop() temp?: number;
  @Prop({ required: true }) status!: string;
  @Prop() buf_fill?: number;

  /** Provenance: device | manual | import. */
  @Prop({ default: "device" }) source?: string;
}

export const TelemetrySchema = SchemaFactory.createForClass(Telemetry);
