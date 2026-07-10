import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ collection: "devices" })
export class Device {
  @Prop({ required: true, unique: true }) devId!: string;
  @Prop({ required: true, index: true }) siteId!: string;
  @Prop() name?: string; // friendly label, e.g. "Rooftop inverter A"
  @Prop() deviceType?: string; // pv_inverter | telecom_rect
  @Prop() ratedPower?: number; // kW
  @Prop() serviceAge?: number; // years
  @Prop() energyKwh?: number; // cumulative energy (kWh), editable
  @Prop({ type: Object }) location?: { lat?: number; lon?: number; address?: string };
  @Prop() phaseConfig?: string; // e.g. "4-wire-380/220"
  @Prop({ type: Object }) calib?: Record<string, { k: number; b: number }>;
  @Prop() firstSeen?: Date; // when the first telemetry arrived
  @Prop() lastSeen?: Date;
  @Prop({ default: 10 }) telemetryPeriodSec?: number; // how often the node publishes
  @Prop() expiresAt?: Date; // after this, the device is archived
  @Prop({ default: false }) simulated?: boolean; // driven by the hourly simulator
  @Prop() certRef?: string;
  @Prop({ default: () => new Date() }) createdAt?: Date;
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
