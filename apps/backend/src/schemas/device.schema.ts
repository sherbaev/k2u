import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ collection: "devices" })
export class Device {
  @Prop({ required: true, unique: true }) devId!: string;
  @Prop({ required: true, index: true }) siteId!: string;
  @Prop() phaseConfig?: string; // e.g. "4-wire-380/220"
  @Prop({ type: Object }) calib?: Record<string, { k: number; b: number }>;
  @Prop() lastSeen?: Date;
  @Prop() certRef?: string;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
