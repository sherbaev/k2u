import { Body, Controller, Delete, Post } from "@nestjs/common";
import { SeedService } from "./seed.service.js";

@Controller("api/seed")
export class SeedController {
  constructor(private readonly seed: SeedService) {}

  /** Seed the 2 demo ESP32 nodes with ~2 months of physics-based history. */
  @Post("demo")
  demo(@Body() body: { days?: number }) {
    return this.seed.seed(body?.days ?? 60);
  }

  /** Remove the demo devices and their data. */
  @Delete("demo")
  async clear() {
    await this.seed.clear();
    return { ok: true };
  }
}
