import type { Job } from "../domain/job.js";

export interface JobStore {
  create(
    job: Job,
    key: string,
    requestHash: string,
    eventId: string,
  ): Promise<{ job: Job; created: boolean }>;
  get(id: string): Promise<Job | null>;
}

export interface EventPublisher {
  publish(id: string, type: string, payload: unknown): Promise<void>;
}

export interface OutboxStore {
  deliverNext(publisher: EventPublisher): Promise<boolean>;
}

export interface Readiness {
  check(): Promise<boolean>;
}
