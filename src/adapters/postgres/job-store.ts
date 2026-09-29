import { Inject, Injectable } from "@nestjs/common";
import type { PoolClient } from "pg";
import { IdempotencyConflictError } from "../../application/create-job.js";
import type {
  EventPublisher,
  JobStore,
  OutboxStore,
} from "../../application/ports.js";
import type { Job } from "../../domain/job.js";
import { Database } from "./database.js";

type JobRow = {
  id: string;
  name: string;
  status: "pending";
  created_at: Date;
  request_hash: string;
};
type OutboxRow = {
  id: string;
  event_type: string;
  payload: unknown;
  attempts: number;
};

@Injectable()
export class PostgresJobStore implements JobStore, OutboxStore {
  constructor(@Inject(Database) private readonly database: Database) {}

  async create(
    job: Job,
    key: string,
    requestHash: string,
    eventId: string,
  ): Promise<{ job: Job; created: boolean }> {
    return this.transaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO jobs(id,name,status,idempotency_key,request_hash,created_at)
         VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT (idempotency_key) DO NOTHING RETURNING id`,
        [job.id, job.name, job.status, key, requestHash, job.createdAt],
      );
      if (inserted.rowCount === 0) {
        const result = await client.query<JobRow>(
          "SELECT id,name,status,created_at,request_hash FROM jobs WHERE idempotency_key=$1",
          [key],
        );
        const existing = result.rows[0];
        if (!existing || existing.request_hash !== requestHash) {
          throw new IdempotencyConflictError(
            "idempotency key already used for a different request",
          );
        }
        return { job: this.toJob(existing), created: false };
      }
      const payload = {
        eventId,
        version: 1,
        jobId: job.id,
        name: job.name,
        occurredAt: job.createdAt,
      };
      await client.query(
        "INSERT INTO outbox(id,event_type,payload) VALUES($1,$2,$3)",
        [eventId, "JobCreated.v1", JSON.stringify(payload)],
      );
      return { job, created: true };
    });
  }

  async get(id: string): Promise<Job | null> {
    const result = await this.database.pool.query<JobRow>(
      "SELECT id,name,status,created_at FROM jobs WHERE id=$1",
      [id],
    );
    return result.rows[0] ? this.toJob(result.rows[0]) : null;
  }

  async deliverNext(publisher: EventPublisher): Promise<boolean> {
    return this.transaction(async (client) => {
      const result = await client.query<OutboxRow>(
        `SELECT id,event_type,payload,attempts FROM outbox WHERE delivered_at IS NULL
         AND available_at <= now() ORDER BY available_at,id LIMIT 1 FOR UPDATE SKIP LOCKED`,
      );
      const event = result.rows[0];
      if (!event) return false;
      try {
        await publisher.publish(event.id, event.event_type, event.payload);
        await client.query(
          "UPDATE outbox SET delivered_at=now(),last_error=NULL WHERE id=$1",
          [event.id],
        );
      } catch {
        const delaySeconds = Math.min(2 ** Math.min(event.attempts, 8), 300);
        await client.query(
          `UPDATE outbox SET attempts=attempts+1,
           available_at=now()+($2::integer * interval '1 second'),last_error=$3 WHERE id=$1`,
          [event.id, delaySeconds, "receiver unavailable"],
        );
      }
      return true;
    });
  }

  private toJob(row: JobRow): Job {
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      createdAt: row.created_at,
    };
  }

  private async transaction<T>(
    action: (client: PoolClient) => Promise<T>,
  ): Promise<T> {
    const client = await this.database.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
