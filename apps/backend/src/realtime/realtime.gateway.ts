import { Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
} from "@nestjs/websockets";
import type { Server, WebSocket } from "ws";
import { LiveBus } from "./live-bus.js";

/**
 * Raw WebSocket endpoint at /ws/live. Every ingested telemetry/event/prediction
 * message from the LiveBus is broadcast as JSON to all connected clients.
 * This replaces polling (thesis §3.2): sub-second dashboard updates.
 */
@WebSocketGateway({ path: "/ws/live" })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly log = new Logger(RealtimeGateway.name);
  private server?: Server;
  private clients = 0;

  constructor(private readonly bus: LiveBus) {}

  afterInit(server: Server): void {
    this.server = server;
    this.bus.stream$.subscribe((msg) => this.broadcast(msg));
    this.log.log("WebSocket gateway ready at /ws/live");
  }

  handleConnection(): void {
    this.clients += 1;
  }

  handleDisconnect(): void {
    this.clients = Math.max(0, this.clients - 1);
  }

  private broadcast(msg: unknown): void {
    if (!this.server) return;
    const payload = JSON.stringify(msg);
    for (const client of this.server.clients) {
      const ws = client as WebSocket;
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }
}
