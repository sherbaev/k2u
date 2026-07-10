import { Global, Module } from "@nestjs/common";
import { LiveBus } from "./live-bus.js";
import { RealtimeGateway } from "./realtime.gateway.js";

@Global()
@Module({
  providers: [LiveBus, RealtimeGateway],
  exports: [LiveBus],
})
export class RealtimeModule {}
