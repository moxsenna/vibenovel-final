import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JsonValue } from "@vibenovel/shared";

export interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}

export interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: JsonValue;
  };
}

export type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export function jsonSuccess<T>(
  c: Context,
  data: T,
  status: ContentfulStatusCode = 200,
): Response {
  const body: ApiSuccessBody<T> = { ok: true, data };
  return c.json(body, status);
}

export function jsonError(
  c: Context,
  code: string,
  message: string,
  status: ContentfulStatusCode,
  details?: JsonValue,
): Response {
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
  return c.json(body, status);
}