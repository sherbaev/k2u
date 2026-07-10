import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type AggregateDocument = HydratedDocument<Aggregate>;

@Schema({ _id: false })
export class AggregateMeta {
  @Prop({ required: true, index: true }) siteId!: string;
  @Prop({ required: true, index: true }) devId!: string;
}
const AggregateMetaSchema = SchemaFactory.createForClass(AggregateMeta);

/**
 * 10-minute RTC-aligned aggregates, time-series collection. Kept long-term
 * (no TTL) — the GOST weekly 95-percentile is computed from these.
 */
@Schema({
  timeseries: { timeField: "ts", metaField: "meta", granularity: "minutes" },
  autoCreate: true,
})
export class Aggregate {
  @Prop({ required: true }) ts!: Date;
  @Prop({ type: AggregateMetaSchema, required: true }) meta!: AggregateMeta;

  @Prop() k2u_avg?: number;
  @Prop() k2u_min?: number;
  @Prop() k2u_max?: number;
  @Prop() k2u_p95?: number;
  @Prop() exceed_2pct_s?: number;
  @Prop() exceed_4pct_s?: number;
  @Prop() temp_mean?: number;
  @Prop() temp_max?: number;
  @Prop() load_factor?: number;
}

export const AggregateSchema = SchemaFactory.createForClass(Aggregate);
