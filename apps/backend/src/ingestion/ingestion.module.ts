import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import telemetrySchemaJson from "@k2u/shared-contracts/schemas/telemetry.schema.json";
import { IngestionService } from "./ingestion.service.js";
import { TelemetryValidator } from "./telemetry-validator.js";
import { Telemetry, TelemetrySchema } from "../schemas/telemetry.schema.js";
import { Aggregate, AggregateSchema } from "../schemas/aggregate.schema.js";
import { AlertEvent, EventSchema } from "../schemas/event.schema.js";
import { Device, DeviceSchema } from "../schemas/device.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Telemetry.name, schema: TelemetrySchema },
      { name: Aggregate.name, schema: AggregateSchema },
      { name: AlertEvent.name, schema: EventSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
  ],
  providers: [
    IngestionService,
    {
      provide: TelemetryValidator,
      useFactory: () => new TelemetryValidator(telemetrySchemaJson as object),
    },
  ],
})
export class IngestionModule {}
