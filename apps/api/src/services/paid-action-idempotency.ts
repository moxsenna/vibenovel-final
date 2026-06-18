import { AppError } from "../errors.js";

const IDEMPOTENCY_KEY_MAX = 180;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export function parsePaidActionIdempotencyKey(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) {
    throw AppError.badRequest("idempotencyKey is required");
  }

  const key = value.trim();
  if (key.length > IDEMPOTENCY_KEY_MAX) {
    throw AppError.badRequest(
      `idempotencyKey must be at most ${IDEMPOTENCY_KEY_MAX} characters`,
    );
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw AppError.badRequest("idempotencyKey contains invalid characters");
  }
  return key;
}
