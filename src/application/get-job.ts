import type { Job } from "../domain/job.js";
import type { JobStore } from "./ports.js";

export class JobNotFoundError extends Error {}

export class GetJob {
  constructor(private readonly store: JobStore) {}

  async execute(id: string): Promise<Job> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      )
    ) {
      throw new JobNotFoundError("job not found");
    }
    const job = await this.store.get(id);
    if (!job) throw new JobNotFoundError("job not found");
    return job;
  }
}
