import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: "users" })
export class User {
  @Prop({ required: true, unique: true }) username!: string;
  @Prop({ required: true }) passwordHash!: string;
  @Prop({ required: true, default: "operator" }) role!: string; // operator | admin
}

export const UserSchema = SchemaFactory.createForClass(User);
