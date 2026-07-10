import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiService, type RangeQuery } from "./api.service.js";
import { JwtAuthGuard } from "../auth/jwt.guard.js";
import { AlertsService } from "../alerts/alerts.service.js";
import { ComplianceService } from "../compliance/compliance.service.js";
import { PredictionsService } from "../predictions/predictions.service.js";

@Controller("api")
export class ApiController {
  constructor(
    private readonly api: ApiService,
    private readonly alerts: AlertsService,
    private readonly compliance: ComplianceService,
    private readonly predictions: PredictionsService,
  ) {}

  @Get("health")
  health() {
    return { status: "ok", ts: new Date().toISOString() };
  }

  @Get("sites")
  sites() {
    return this.api.listSites();
  }

  @Post("sites")
  @UseGuards(JwtAuthGuard)
  createSite(@Body() body: Record<string, unknown>) {
    return this.api.upsertSite(body);
  }

  @Get("devices")
  devices(@Query("siteId") siteId?: string) {
    return this.api.listDevices(siteId);
  }

  @Post("devices")
  @UseGuards(JwtAuthGuard)
  createDevice(@Body() body: Record<string, unknown>) {
    return this.api.upsertDevice(body);
  }

  @Delete("devices/:devId")
  @UseGuards(JwtAuthGuard)
  deleteDevice(@Param("devId") devId: string) {
    return this.api.deleteDevice(devId);
  }

  @Get("latest")
  latest(@Query("devId") devId?: string) {
    return this.api.latest(devId);
  }

  @Get("history")
  history(@Query() q: RangeQuery) {
    return this.api.history(q);
  }

  @Get("aggregates")
  aggregates(@Query() q: RangeQuery) {
    return this.api.aggregates(q);
  }

  @Get("events")
  events(@Query() q: RangeQuery) {
    return this.api.listEvents(q);
  }

  @Get("predictions")
  listPredictions(@Query() q: RangeQuery) {
    return this.api.listPredictions(q);
  }

  @Get("compliance")
  listCompliance(@Query("devId") devId?: string, @Query("siteId") siteId?: string) {
    return this.compliance.list(devId, siteId);
  }

  @Post("events/:id/ack")
  async ackEvent(@Param("id") id: string, @Body() body: { by?: string }) {
    await this.alerts.ack(id, body?.by ?? "operator");
    return { ok: true };
  }

  @Post("predictions/refresh")
  async refresh(@Body() body: { devId: string; siteId: string; deviceType?: string; serviceAge?: number; ratedPower?: number }) {
    const pred = await this.predictions.refreshDevice(body.devId, body.siteId, {
      device_type: body.deviceType ?? "pv_inverter",
      service_age: body.serviceAge ?? 3,
      rated_power: body.ratedPower ?? 5,
    });
    return pred ?? { ok: false };
  }
}
