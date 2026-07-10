import { Inject, Injectable, Logger } from "@nestjs/common";
import { CONFIG, type AppConfig } from "../config/configuration.js";

/** Sends alert notifications to Telegram. No-op if not configured. */
@Injectable()
export class TelegramService {
  private readonly log = new Logger(TelegramService.name);

  constructor(@Inject(CONFIG) private readonly config: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.telegramToken && this.config.telegramChatId);
  }

  async send(text: string): Promise<void> {
    if (!this.enabled) return;
    try {
      const url = `https://api.telegram.org/bot${this.config.telegramToken}/sendMessage`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: this.config.telegramChatId,
          text,
          parse_mode: "HTML",
        }),
      });
      if (!res.ok) this.log.warn(`Telegram send failed: ${res.status}`);
    } catch (e) {
      this.log.warn(`Telegram error: ${(e as Error).message}`);
    }
  }
}
