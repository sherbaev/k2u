import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { PredictionsService } from "./predictions.service.js";
import { Aggregate, AggregateSchema } from "../schemas/aggregate.schema.js";
import { Device, DeviceSchema } from "../schemas/device.schema.js";
import { Prediction, PredictionSchema } from "../schemas/prediction.schema.js";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Aggregate.name, schema: AggregateSchema },
      { name: Device.name, schema: DeviceSchema },
      { name: Prediction.name, schema: PredictionSchema },
    ]),
  ],
  providers: [PredictionsService],
  exports: [PredictionsService],
})
export class PredictionsModule {}
