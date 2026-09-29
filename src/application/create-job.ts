import { createHash, randomUUID } from "node:crypto";
import { normalizeName, type Job } from "../domain/job.js";
import type { JobStore } from "./ports.js";

export class InvalidIdempotencyKeyError extends Error {}
export class IdempotencyConflictError extends Error {}

export class CreateJob {
  constructor(private readonly store: JobStore) {}

  async execute(
    nameInput: unknown,
    keyInput: unknown,
  ): Promise<{ job: Job; created: boolean }> {
    const name = normalizeName(nameInput);
    if (
      typeof keyInput !== "string" ||
      keyInput.trim().length < 1 ||
      keyInput.length > 128
    ) {
      throw new InvalidIdempotencyKeyError(
        "idempotency key must contain 1 to 128 characters",
      );
    }
    const key = keyInput.trim();
    const requestHash = createHash("sha256").update(name).digest("hex");
    const job: Job = {
      id: randomUUID(),
      name,
      status: "pending",
      createdAt: new Date(),
    };
    return this.store.create(job, key, requestHash, randomUUID());
  }
}
