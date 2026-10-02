import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Test, type TestingModule } from "@nestjs/testing";
import {
  CreateJob,
  IdempotencyConflictError,
} from "../src/application/create-job.js";
import { Database } from "../src/adapters/postgres/database.js";
import { PostgresJobStore } from "../src/adapters/postgres/job-store.js";
import { AppModule } from "../src/app.module.js";

const enabled = Boolean(process.env.TEST_DATABASE_URL);
describe.skipIf(!enabled)("PostgreSQL transaction and outbox", () => {
  let database: Database;
  let store: PostgresJobStore;
  let module: TestingModule;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error("TEST_DATABASE_URL is required");
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    process.env.API_KEY = ["test", "integration", "key", "change", "me"].join(
      "-",
    );
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();
    database = module.get(Database);
    await database.pool.query("TRUNCATE outbox,jobs");
    store = module.get(PostgresJobStore);
  });

  afterAll(async () => {
    await module?.close();
  });

  it("stores one job and event and recovers an idempotent retry", async () => {
    const command = new CreateJob(store);
    const first = await command.execute("test", "integration-key");
    const second = await command.execute("test", "integration-key");
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.job.id).toBe(first.job.id);
    await expect(
      command.execute("different", "integration-key"),
    ).rejects.toThrow(IdempotencyConflictError);
    const jobs = await database.pool.query(
      "SELECT count(*)::integer AS count FROM jobs",
    );
    const events = await database.pool.query(
      "SELECT count(*)::integer AS count FROM outbox",
    );
    expect(jobs.rows[0].count).toBe(1);
    expect(events.rows[0].count).toBe(1);
  });

  it("retries failed delivery and restores readiness after success", async () => {
    const pending = await database.pool.query<{ id: string }>(
      "SELECT id FROM outbox WHERE delivered_at IS NULL LIMIT 1",
    );
    const eventId = pending.rows[0].id;
    await database.pool.query(
      "UPDATE outbox SET created_at=now()-interval '1 hour' WHERE id=$1",
      [eventId],
    );
    expect(await database.check()).toBe(false);
    let calls = 0;
    await store.deliverNext({
      publish: async () => {
        calls++;
        throw new Error("receiver unavailable");
      },
    });
    const retry = await database.pool.query<{ attempts: number }>(
      "SELECT attempts FROM outbox WHERE id=$1",
      [eventId],
    );
    expect(retry.rows[0].attempts).toBe(1);
    await database.pool.query(
      "UPDATE outbox SET available_at=now() WHERE id=$1",
      [eventId],
    );
    await store.deliverNext({
      publish: async () => {
        calls++;
      },
    });
    const delivered = await database.pool.query<{ delivered: boolean }>(
      "SELECT delivered_at IS NOT NULL AS delivered FROM outbox WHERE id=$1",
      [eventId],
    );
    expect(delivered.rows[0].delivered).toBe(true);
    expect(calls).toBe(2);
    expect(await database.check()).toBe(true);
  });
});
