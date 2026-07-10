import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type EventDocument = HydratedDocument<AlertEvent>;

/** WARNING/CRITICAL alert events (regular collection, not time-series). */
@Schema({ collection: "events", timestamps: false })
export class AlertEvent {
  @Prop({ required: true }) ts!: Date;
  @Prop({ required: true, index: true }) siteId!: string;
  @Prop({ required: true, index: true }) devId!: string;
  @Prop({ required: true }) type!: string; // WARNING | CRITICAL
  @Prop({ required: true }) k2u!: number;
  @Prop() message?: string;
  @Prop() ackBy?: string;
  @Prop() ackAt?: Date;
}

export const EventSchema = SchemaFactory.createForClass(AlertEvent);
EventSchema.index({ siteId: 1, ts: -1 });
