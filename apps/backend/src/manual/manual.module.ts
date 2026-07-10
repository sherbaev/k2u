import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ManualController } from "./manual.controller.js";
import { ManualService } from "./manual.service.js";
import { Telemetry, TelemetrySchema } from "../schemas/telemetry.schema.js";
import { Device, DeviceSchema } from "../schemas/device.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
  ],
  controllers: [ManualController],
  providers: [ManualService],
})
export class ManualModule {}
