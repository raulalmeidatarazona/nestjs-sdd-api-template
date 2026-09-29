import type { EventPublisher, OutboxStore } from "./ports.js";

export class DeliverEvents {
  constructor(
    private readonly outbox: OutboxStore,
    private readonly publisher: EventPublisher,
  ) {}

  runOnce(): Promise<boolean> {
    return this.outbox.deliverNext(this.publisher);
  }
}
