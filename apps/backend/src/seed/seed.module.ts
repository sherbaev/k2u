import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { SeedController } from "./seed.controller.js";
import { SeedService } from "./seed.service.js";
import { PredictionsModule } from "../predictions/predictions.module.js";
import { Telemetry, TelemetrySchema } from "../schemas/telemetry.schema.js";
import { Aggregate, AggregateSchema } from "../schemas/aggregate.schema.js";
import { Device, DeviceSchema } from "../schemas/device.schema.js";
import { Site, SiteSchema } from "../schemas/site.schema.js";
import { Compliance, ComplianceSchema } from "../compliance/compliance.schema.js";

@Module({
  imports: [
    PredictionsModule,
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
      { name: Aggregate.name, schema: AggregateSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Site.name, schema: SiteSchema },
      { name: Compliance.name, schema: ComplianceSchema },
    ]),
  ],
  controllers: [SeedController],
  providers: [SeedService],
})
export class SeedModule {}
