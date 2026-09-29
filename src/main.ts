import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module.js";
import { DeliverEvents } from "./application/deliver-events.js";
import { HttpPublisher } from "./adapters/events/http-publisher.js";
import { PostgresJobStore } from "./adapters/postgres/job-store.js";

async function bootstrap(): Promise<void> {
  const webhookUrl = process.env.EVENT_WEBHOOK_URL || "";
  const webhookToken = process.env.EVENT_WEBHOOK_TOKEN || "";
  if (
    process.env.APP_ENV === "production" &&
    (!webhookUrl.startsWith("https://") || !webhookToken)
  ) {
    throw new Error(
      "production requires HTTPS EVENT_WEBHOOK_URL and EVENT_WEBHOOK_TOKEN",
    );
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be valid");
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.useBodyParser("json", { limit: "4kb", strict: true });
  app.enableShutdownHooks();
  if (webhookUrl) {
    const dispatcher = new DeliverEvents(
      app.get(PostgresJobStore),
      new HttpPublisher(webhookUrl, webhookToken),
    );
    let running = false;
    const timer = setInterval(async () => {
      if (running) return;
      running = true;
      try {
        await dispatcher.runOnce();
      } catch (error) {
        console.error("outbox worker failed", error);
      } finally {
        running = false;
      }
    }, 1000);
    app.enableShutdownHooks();
    process.once("SIGTERM", () => clearInterval(timer));
    process.once("SIGINT", () => clearInterval(timer));
  }
  await app.listen(port);
}

bootstrap().catch((error: unknown) => {
  console.error("service failed to start", error);
  process.exitCode = 1;
});
