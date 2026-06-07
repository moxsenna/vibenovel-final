import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { jsonError } from "./response.js";
import type { AppEnv } from "./types.js";

export class AppError extends Error {
  readonly code: string;
  readonly status: ContentfulStatusCode;
  readonly details?: unknown;

  constructor(
    code: string,
    message: string,
    status: ContentfulStatusCode,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
  }

  static unauthorized(message = "Authentication required"): AppError {
    return new AppError("UNAUTHORIZED", message, 401);
  }

  static notFound(message = "Resource not found"): AppError {
    return new AppError("NOT_FOUND", message, 404);
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError("BAD_REQUEST", message, 400, details);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError("INTERNAL_ERROR", message, 500);
  }

  static serviceUnavailable(message = "Service unavailable"): AppError {
    return new AppError("SERVICE_UNAVAILABLE", message, 503);
  }
}

export function errorHandler(err: Error, c: Context<AppEnv>): Response {
  if (err instanceof AppError) {
    return jsonError(c, err.code, err.message, err.status, err.details as never);
  }

  console.error("Unhandled error:", err.message);
  return jsonError(c, "INTERNAL_ERROR", "Internal server error", 500);
}

export function notFoundHandler(c: Context<AppEnv>): Response {
  return jsonError(c, "NOT_FOUND", `Route not found: ${c.req.path}`, 404);
}