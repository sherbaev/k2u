export interface AppConfig {
  port: number;
  mongoUri: string;
  mqttUrl: string;
  jwtSecret: string;
  telegramToken: string;
  telegramChatId: string;
  aiUrl: string;
  corsOrigin: string;
  rawTelemetryTtlDays: number;
  authRequired: boolean;
  seedAdminUser: string;
  seedAdminPassword: string;
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT ?? "3000", 10),
    mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/k2u",
    mqttUrl: process.env.MQTT_URL ?? "mqtt://localhost:1883",
    jwtSecret: process.env.JWT_SECRET ?? "change-me",
    telegramToken: process.env.TELEGRAM_TOKEN ?? "",
    telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
    aiUrl: process.env.AI_URL ?? "http://localhost:8000",
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
    rawTelemetryTtlDays: parseInt(process.env.RAW_TTL_DAYS ?? "90", 10),
    authRequired: (process.env.AUTH_REQUIRED ?? "false").toLowerCase() === "true",
    seedAdminUser: process.env.SEED_ADMIN_USER ?? "admin",
    seedAdminPassword: process.env.SEED_ADMIN_PASSWORD ?? "",
  };
}

export const CONFIG = "APP_CONFIG";
