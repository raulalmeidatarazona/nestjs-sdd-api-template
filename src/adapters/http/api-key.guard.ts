import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly expected: Buffer;

  constructor() {
    const key = process.env.API_KEY;
    if (!key || key.length < 20)
      throw new Error("API_KEY of at least 20 characters is required");
    this.expected = createHash("sha256").update(key).digest();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    const candidate = header?.startsWith("Bearer ") ? header.slice(7) : "";
    const actual = createHash("sha256").update(candidate).digest();
    if (!candidate || !timingSafeEqual(this.expected, actual))
      throw new UnauthorizedException();
    return true;
  }
}
