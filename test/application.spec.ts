import { describe, expect, it } from "vitest";
import {
  CreateJob,
  IdempotencyConflictError,
  InvalidIdempotencyKeyError,
} from "../src/application/create-job.js";
import { GetJob, JobNotFoundError } from "../src/application/get-job.js";
import type { JobStore } from "../src/application/ports.js";
import type { Job } from "../src/domain/job.js";
import { InvalidNameError, normalizeName } from "../src/domain/job.js";

class MemoryStore implements JobStore {
  jobs = new Map<string, { job: Job; hash: string }>();
  events = 0;

  async create(
    job: Job,
    key: string,
    hash: string,
  ): Promise<{ job: Job; created: boolean }> {
    const existing = this.jobs.get(key);
    if (existing) {
      if (existing.hash !== hash)
        throw new IdempotencyConflictError("conflict");
      return { job: existing.job, created: false };
    }
    this.jobs.set(key, { job, hash });
    this.events++;
    return { job, created: true };
  }

  async get(id: string): Promise<Job | null> {
    return (
      [...this.jobs.values()].find(({ job }) => job.id === id)?.job || null
    );
  }
}

describe("Job command and query", () => {
  it("normalizes names and rejects invalid inputs", () => {
    expect(normalizeName("  hello  ")).toBe("hello");
    expect(() => normalizeName("")).toThrow(InvalidNameError);
    expect(() => normalizeName("x".repeat(121))).toThrow(InvalidNameError);
    expect(() => normalizeName(123)).toThrow(InvalidNameError);
  });

  it("keeps one job and one event across retries", async () => {
    const store = new MemoryStore();
    const create = new CreateJob(store);
    const first = await create.execute("  hello  ", "key-1");
    const retry = await create.execute("hello", "key-1");
    expect(first.created).toBe(true);
    expect(retry.created).toBe(false);
    expect(retry.job.id).toBe(first.job.id);
    expect(store.events).toBe(1);
    await expect(create.execute("other", "key-1")).rejects.toThrow(
      IdempotencyConflictError,
    );
    await expect(create.execute("test", "")).rejects.toThrow(
      InvalidIdempotencyKeyError,
    );
    expect((await new GetJob(store).execute(first.job.id)).id).toBe(
      first.job.id,
    );
    await expect(new GetJob(store).execute("bad")).rejects.toThrow(
      JobNotFoundError,
    );
    await expect(
      new GetJob(store).execute("123e4567-e89b-12d3-a456-426614174000"),
    ).rejects.toThrow(JobNotFoundError);
  });
});
