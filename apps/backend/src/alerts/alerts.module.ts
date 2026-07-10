import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AlertEvent, EventSchema } from "../schemas/event.schema.js";
import { AlertsService } from "./alerts.service.js";
import { TelegramService } from "./telegram.service.js";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: AlertEvent.name, schema: EventSchema }])],
  providers: [AlertsService, TelegramService],
  exports: [AlertsService],
})
export class AlertsModule {}
