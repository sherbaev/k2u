import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";

export interface LiveMessage {
  kind: "telemetry" | "event" | "prediction";
  data: unknown;
}

/** In-process pub/sub used to fan out ingested data to WebSocket clients. */
@Injectable()
export class LiveBus {
  private readonly subject = new Subject<LiveMessage>();
  readonly stream$ = this.subject.asObservable();

  emit(msg: LiveMessage): void {
    this.subject.next(msg);
  }
}
