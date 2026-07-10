import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ComplianceService } from "./compliance.service.js";
import { Compliance, ComplianceSchema } from "./compliance.schema.js";
import { Aggregate, AggregateSchema } from "../schemas/aggregate.schema.js";
import { Device, DeviceSchema } from "../schemas/device.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Compliance.name, schema: ComplianceSchema },
      { name: Aggregate.name, schema: AggregateSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
  ],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}
