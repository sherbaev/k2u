import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ComplianceDocument = HydratedDocument<Compliance>;

/** Weekly GOST 32144-2013 compliance summary per device. */
@Schema({ collection: "compliance" })
export class Compliance {
  @Prop({ required: true }) ts!: Date; // when computed
  @Prop({ required: true, index: true }) siteId!: string;
  @Prop({ required: true, index: true }) devId!: string;
  @Prop({ required: true }) weekStart!: Date;
  @Prop({ required: true }) k2u_p95!: number;
  @Prop() exceed_2pct_s?: number;
  @Prop() exceed_4pct_s?: number;
  @Prop({ required: true }) verdict!: string; // PASS | MARGINAL | FAIL
}

export const ComplianceSchema = SchemaFactory.createForClass(Compliance);
ComplianceSchema.index({ devId: 1, weekStart: -1 });
