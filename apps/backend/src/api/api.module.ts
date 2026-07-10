import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ApiController } from "./api.controller.js";
import { ApiService } from "./api.service.js";
import { PredictionsModule } from "../predictions/predictions.module.js";
import { ComplianceModule } from "../compliance/compliance.module.js";
import { Telemetry, TelemetrySchema } from "../schemas/telemetry.schema.js";
import { Aggregate, AggregateSchema } from "../schemas/aggregate.schema.js";
import { AlertEvent, EventSchema } from "../schemas/event.schema.js";
import { Prediction, PredictionSchema } from "../schemas/prediction.schema.js";
import { Device, DeviceSchema } from "../schemas/device.schema.js";
import { Site, SiteSchema } from "../schemas/site.schema.js";

@Module({
  imports: [
    PredictionsModule,
    ComplianceModule,
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
      { name: Aggregate.name, schema: AggregateSchema },
      { name: AlertEvent.name, schema: EventSchema },
      { name: Prediction.name, schema: PredictionSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Site.name, schema: SiteSchema },
    ]),
  ],
  controllers: [ApiController],
  providers: [ApiService],
})
export class ApiModule {}
