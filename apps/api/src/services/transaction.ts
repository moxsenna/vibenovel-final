import { AppError } from "../errors.js";

/** Failure code for audit metadata and logs. */
export function classifyTransactionFailure(err: unknown): string {
  if (err instanceof AppError) return err.code;
  return "internal_error";
}

export type CompensationFn = () => Promise<void>;

/**
 * Transaction-like runner for Cloudflare Worker + Supabase JS.
 * True Postgres BEGIN/COMMIT is not available via PostgREST; use this for
 * ordered writes + reverse-order compensation on failure.
 */
export async function runWithCompensation<T>(
  execute: () => Promise<T>,
  compensations: CompensationFn[] = [],
): Promise<T> {
  try {
    return await execute();
  } catch (err) {
    for (let i = compensations.length - 1; i >= 0; i--) {
      try {
        await compensations[i]();
      } catch (compErr) {
        console.error("transaction compensation step failed");
        if (compErr instanceof Error) {
          console.error(compErr.message);
        }
      }
    }
    throw err;
  }
}

export class TransactionPlan {
  private readonly compensations: CompensationFn[] = [];

  registerCompensation(fn: CompensationFn): void {
    this.compensations.push(fn);
  }

  async run<T>(execute: () => Promise<T>): Promise<T> {
    return runWithCompensation(execute, this.compensations);
  }
}