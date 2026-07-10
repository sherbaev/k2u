import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import mqtt, { type MqttClient } from "mqtt";
import { CONFIG, type AppConfig } from "../config/configuration.js";

type MessageHandler = (topic: string, payload: Buffer) => void;

/**
 * Thin MQTT connection provider. Connects to Mosquitto, exposes subscribe()
 * and publish() to the rest of the app. TLS is configured via the MQTT_URL
 * scheme (mqtts://) + broker certs in production.
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(MqttService.name);
  private client?: MqttClient;
  private readonly handlers: MessageHandler[] = [];

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  onModuleInit(): void {
    this.client = mqtt.connect(this.config.mqttUrl, {
      reconnectPeriod: 2000,
      clean: false,
      clientId: `k2u-backend-${Math.random().toString(16).slice(2, 8)}`,
    });

    this.client.on("connect", () => this.log.log(`MQTT connected: ${this.config.mqttUrl}`));
    this.client.on("reconnect", () => this.log.warn("MQTT reconnecting..."));
    this.client.on("error", (err) => this.log.error(`MQTT error: ${err.message}`));
    this.client.on("message", (topic, payload) => {
      for (const h of this.handlers) h(topic, payload);
    });
  }

  onModuleDestroy(): void {
    this.client?.end(true);
  }

  subscribe(filter: string, qos: 0 | 1 | 2 = 0): void {
    this.client?.subscribe(filter, { qos }, (err) => {
      if (err) this.log.error(`subscribe ${filter} failed: ${err.message}`);
      else this.log.log(`subscribed ${filter} (qos ${qos})`);
    });
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  publish(topic: string, message: string, qos: 0 | 1 | 2 = 1): void {
    this.client?.publish(topic, message, { qos });
  }
}
