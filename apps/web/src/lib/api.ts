import { getApiBaseUrl } from "@/lib/env";
import { supabase } from "@/lib/supabase";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    this.details = details;
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
    details?: unknown;
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

async function refreshAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.refreshSession();
  if (error) return null;
  return data.session?.access_token ?? null;
}

async function clearLocalSession(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut({ scope: "local" });
}

async function sendRequest<T>(
  path: string,
  options: ApiRequestOptions,
  token: string | null,
): Promise<{ response: Response; payload: ApiBody<T> }> {
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

  return { response, payload };
}

function isExpiredTokenError<T>(response: Response, payload: ApiBody<T>): boolean {
  return (
    response.status === 401 &&
    !payload.ok &&
    payload.error.code === "UNAUTHORIZED" &&
    /invalid|expired/i.test(payload.error.message)
  );
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const token = await resolveAccessToken(options.token);
  let { response, payload } = await sendRequest<T>(path, options, token);

  if (token && isExpiredTokenError(response, payload)) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken && refreshedToken !== token) {
      const retry = await sendRequest<T>(path, options, refreshedToken);
      response = retry.response;
      payload = retry.payload;
    } else {
      await clearLocalSession();
    }
  }

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.error.details,
    );
  }

  return payload.data;
}
