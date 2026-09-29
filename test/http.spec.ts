import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  CreateJob,
  IdempotencyConflictError,
} from "../src/application/create-job.js";
import { GetJob, JobNotFoundError } from "../src/application/get-job.js";
import { ApiKeyGuard } from "../src/adapters/http/api-key.guard.js";
import { HealthController } from "../src/adapters/http/health.controller.js";
import { JobsController } from "../src/adapters/http/jobs.controller.js";

const key = "a-valid-local-test-key";
const id = "123e4567-e89b-12d3-a456-426614174000";
const job = { id, name: "test", status: "pending", createdAt: new Date() };
const create = {
  execute: async (name: unknown) => ({ job: { ...job, name }, created: true }),
};
const get = { execute: async () => job };
const readiness = { check: async () => true };
let app: INestApplication;

beforeAll(async () => {
  process.env.API_KEY = key;
  const module = await Test.createTestingModule({
    controllers: [HealthController, JobsController],
    providers: [
      ApiKeyGuard,
      { provide: "CREATE_JOB", useValue: create },
      { provide: "GET_JOB", useValue: get },
      { provide: "READINESS", useValue: readiness },
    ],
  }).compile();
  app = module.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app?.close();
});

describe("HTTP contract", () => {
  it("separates liveness and readiness", async () => {
    await request(app.getHttpServer()).get("/live").expect(200);
    readiness.check = async () => false;
    await request(app.getHttpServer()).get("/ready").expect(503);
    readiness.check = async () => true;
    await request(app.getHttpServer()).get("/ready").expect(200);
  });

  it("requires a key for business routes", async () => {
    await request(app.getHttpServer()).get(`/v1/jobs/${id}`).expect(401);
    await request(app.getHttpServer())
      .get(`/v1/jobs/${id}`)
      .set("Authorization", "Bearer wrong")
      .expect(401);
  });

  it("creates, retries and reads", async () => {
    await request(app.getHttpServer())
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${key}`)
      .set("Idempotency-Key", "one")
      .send({ name: "test" })
      .expect(201);
    create.execute = async (name: unknown) => ({
      job: { ...job, name },
      created: false,
    });
    await request(app.getHttpServer())
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${key}`)
      .set("Idempotency-Key", "one")
      .send({ name: "test" })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/v1/jobs/${id}`)
      .set("Authorization", `Bearer ${key}`)
      .expect(200);
  });

  it("rejects unknown fields and maps domain errors", async () => {
    await request(app.getHttpServer())
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${key}`)
      .send({ name: "test", extra: true })
      .expect(400);
    create.execute = async () => {
      throw new IdempotencyConflictError("conflict");
    };
    await request(app.getHttpServer())
      .post("/v1/jobs")
      .set("Authorization", `Bearer ${key}`)
      .send({ name: "test" })
      .expect(409);
    get.execute = async () => {
      throw new JobNotFoundError("missing");
    };
    await request(app.getHttpServer())
      .get(`/v1/jobs/${id}`)
      .set("Authorization", `Bearer ${key}`)
      .expect(404);
  });
});
