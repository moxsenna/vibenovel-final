import { getApiBaseUrl } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
  }
}

interface ApiSuccessBody<T> {
  ok: true;
  data: T;
}

interface ApiErrorBody {
  ok: false;
  error: {
    code: string;
    message: string;
  };
}

type ApiBody<T> = ApiSuccessBody<T> | ApiErrorBody;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
}

async function resolveAccessToken(explicit?: string | null): Promise<string | null> {
  if (explicit !== undefined) return explicit;
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = await resolveAccessToken(options.token);
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", "Unable to reach API", 0);
  }

  let payload: ApiBody<T>;
  try {
    payload = (await response.json()) as ApiBody<T>;
  } catch {
    throw new ApiClientError("PARSE_ERROR", "Invalid API response", response.status);
  }

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
    );
  }

  return payload.data;
}