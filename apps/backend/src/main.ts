import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { WsAdapter } from "@nestjs/platform-ws";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config/configuration.js";

async function bootstrap(): Promise<void> {
  const config = loadConfig();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.enableCors({ origin: config.corsOrigin.split(","), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.useWebSocketAdapter(new WsAdapter(app));

  await app.listen(config.port);
  new Logger("Bootstrap").log(
    `K2U backend listening on :${config.port} (REST /api, WS /ws/live)`,
  );
}

void bootstrap();
