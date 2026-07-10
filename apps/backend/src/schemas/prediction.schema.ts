import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PredictionDocument = HydratedDocument<Prediction>;

/** RUL prediction outputs from the AI service. */
@Schema({ collection: "predictions" })
export class Prediction {
  @Prop({ required: true }) ts!: Date;
  @Prop({ required: true, index: true }) siteId!: string;
  @Prop({ required: true, index: true }) devId!: string;

  /** Relative remaining useful life 0..1. */
  @Prop({ required: true }) rul!: number;
  @Prop() rul_lo?: number;
  @Prop() rul_hi?: number;
  @Prop() k2u_forecast?: number;
  /** none | recommended | required */
  @Prop({ required: true }) balancer_need!: string;
  @Prop() payback?: number;
}

export const PredictionSchema = SchemaFactory.createForClass(Prediction);
PredictionSchema.index({ devId: 1, ts: -1 });
