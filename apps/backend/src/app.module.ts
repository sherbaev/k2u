import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { loadConfig } from "./config/configuration.js";
import { ConfigModule } from "./config/config.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { MqttModule } from "./mqtt/mqtt.module.js";
import { RealtimeModule } from "./realtime/realtime.module.js";
import { AlertsModule } from "./alerts/alerts.module.js";
import { IngestionModule } from "./ingestion/ingestion.module.js";
import { PredictionsModule } from "./predictions/predictions.module.js";
import { ComplianceModule } from "./compliance/compliance.module.js";
import { ManualModule } from "./manual/manual.module.js";
import { ApiModule } from "./api/api.module.js";

@Module({
  imports: [
    ConfigModule,
    ScheduleModule.forRoot(),
    MongooseModule.forRoot(loadConfig().mongoUri),
    AuthModule,
    MqttModule,
    RealtimeModule,
    AlertsModule,
    IngestionModule,
    PredictionsModule,
    ComplianceModule,
    ManualModule,
    ApiModule,
  ],
})
export class AppModule {}
