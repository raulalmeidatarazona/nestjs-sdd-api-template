import { Module } from "@nestjs/common";
import { CreateJob } from "./application/create-job.js";
import { GetJob } from "./application/get-job.js";
import { HealthController } from "./adapters/http/health.controller.js";
import { JobsController } from "./adapters/http/jobs.controller.js";
import { ApiKeyGuard } from "./adapters/http/api-key.guard.js";
import { Database } from "./adapters/postgres/database.js";
import { PostgresJobStore } from "./adapters/postgres/job-store.js";

@Module({
  controllers: [HealthController, JobsController],
  providers: [
    Database,
    PostgresJobStore,
    ApiKeyGuard,
    { provide: "READINESS", useExisting: Database },
    {
      provide: "CREATE_JOB",
      useFactory: (store: PostgresJobStore) => new CreateJob(store),
      inject: [PostgresJobStore],
    },
    {
      provide: "GET_JOB",
      useFactory: (store: PostgresJobStore) => new GetJob(store),
      inject: [PostgresJobStore],
    },
  ],
})
export class AppModule {}
