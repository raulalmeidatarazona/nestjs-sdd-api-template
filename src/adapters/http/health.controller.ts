import {
  Controller,
  Get,
  Inject,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { Readiness } from "../../application/ports.js";

@Controller()
export class HealthController {
  constructor(@Inject("READINESS") private readonly readiness: Readiness) {}

  @Get("live")
  live() {
    return { status: "live" };
  }

  @Get("ready")
  async ready() {
    if (!(await this.readiness.check()))
      throw new ServiceUnavailableException({ status: "unavailable" });
    return { status: "ready" };
  }
}
