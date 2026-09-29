import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  CreateJob,
  IdempotencyConflictError,
  InvalidIdempotencyKeyError,
} from "../../application/create-job.js";
import { GetJob, JobNotFoundError } from "../../application/get-job.js";
import { InvalidNameError } from "../../domain/job.js";
import { ApiKeyGuard } from "./api-key.guard.js";

@Controller("v1/jobs")
@UseGuards(ApiKeyGuard)
export class JobsController {
  constructor(
    @Inject("CREATE_JOB") private readonly createJob: CreateJob,
    @Inject("GET_JOB") private readonly getJob: GetJob,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: unknown,
    @Headers("idempotency-key") key: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).some((field) => field !== "name")
    ) {
      throw new BadRequestException("body must contain only name");
    }
    try {
      const { job, created } = await this.createJob.execute(
        (body as { name?: unknown }).name,
        key,
      );
      response.status(created ? HttpStatus.CREATED : HttpStatus.OK);
      return job;
    } catch (error) {
      if (
        error instanceof InvalidNameError ||
        error instanceof InvalidIdempotencyKeyError
      )
        throw new BadRequestException(error.message);
      if (error instanceof IdempotencyConflictError)
        throw new ConflictException(error.message);
      throw new InternalServerErrorException("internal error");
    }
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    try {
      return await this.getJob.execute(id);
    } catch (error) {
      if (error instanceof JobNotFoundError)
        throw new NotFoundException(error.message);
      throw new InternalServerErrorException("internal error");
    }
  }
}
