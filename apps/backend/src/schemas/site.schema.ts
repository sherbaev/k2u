import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type SiteDocument = HydratedDocument<Site>;

@Schema({ collection: "sites" })
export class Site {
  @Prop({ required: true, unique: true }) siteId!: string;
  @Prop({ required: true }) name!: string;
  @Prop({ required: true }) type!: string; // pv | telecom
  @Prop({ type: Object }) location?: { lat?: number; lon?: number; address?: string };
  @Prop({ type: Object }) ratings?: { ratedPowerKw?: number; voltage?: number };
}

export const SiteSchema = SchemaFactory.createForClass(Site);
