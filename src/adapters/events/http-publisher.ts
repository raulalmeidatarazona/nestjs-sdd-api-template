import type { EventPublisher } from "../../application/ports.js";

export class HttpPublisher implements EventPublisher {
  constructor(
    private readonly endpoint: string,
    private readonly token: string,
  ) {
    const url = new URL(endpoint);
    if (!["http:", "https:"].includes(url.protocol))
      throw new Error("invalid event webhook URL");
  }

  async publish(id: string, type: string, payload: unknown): Promise<void> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Event-Id": id,
        "X-Event-Type": type,
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`receiver returned ${response.status}`);
  }
}
