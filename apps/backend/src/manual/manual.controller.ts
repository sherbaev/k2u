import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ManualService, type ReadingInput } from "./manual.service.js";
import { JwtAuthGuard } from "../auth/jwt.guard.js";

// Guard is config-gated: no-op unless AUTH_REQUIRED=true.
@Controller("api/readings")
@UseGuards(JwtAuthGuard)
export class ManualController {
  constructor(private readonly manual: ManualService) {}

  /** Single manual reading (phase or line voltages). */
  @Post()
  one(@Body() body: ReadingInput) {
    return this.manual.ingestOne(body);
  }

  /** Bulk import (e.g. parsed CSV). */
  @Post("bulk")
  bulk(@Body() body: { items: ReadingInput[] }) {
    return this.manual.ingestBulk(body?.items ?? []);
  }
}
