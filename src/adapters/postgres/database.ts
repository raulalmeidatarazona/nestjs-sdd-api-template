import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Pool } from "pg";
import type { Readiness } from "../../application/ports.js";

@Injectable()
export class Database implements OnModuleInit, OnModuleDestroy, Readiness {
  readonly pool: Pool;
  private readonly maxLagSeconds: number;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL is required");
    this.maxLagSeconds = Number(process.env.OUTBOX_MAX_LAG_SECONDS || 300);
    if (!Number.isInteger(this.maxLagSeconds) || this.maxLagSeconds < 1) {
      throw new Error("OUTBOX_MAX_LAG_SECONDS must be positive");
    }
    this.pool = new Pool({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 3000,
      max: 10,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  async check(): Promise<boolean> {
    try {
      const result = await this.pool.query<{ stale: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM outbox WHERE delivered_at IS NULL
         AND created_at < now() - ($1::integer * interval '1 second')) AS stale`,
        [this.maxLagSeconds],
      );
      return !result.rows[0].stale;
    } catch {
      return false;
    }
  }
}
