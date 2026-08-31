"use client";

import type { ApiErrorPayload } from "./types";

export class ApiError extends Error {
  readonly code?: number;
  readonly reason?: string;
  readonly status: number;

  constructor(status: number, payload?: ApiErrorPayload) {
    super(payload?.message || `请求失败（${status}）`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code;
    this.reason = payload?.reason;
  }
}

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  query?: Record<string, boolean | number | string | null | undefined>;
};

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const url = new URL(
    `/api/backend${normalizePath(path)}`,
    window.location.origin,
  );
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set("content-type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(url, {
    ...options,
    body,
    cache: "no-store",
    credentials: "same-origin",
    headers,
  });
  if (!response.ok) {
    throw new ApiError(response.status, await readError(response));
  }
  if (
    response.status === 204 ||
    response.headers.get("content-length") === "0"
  ) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

async function readError(response: Response): Promise<ApiErrorPayload> {
  try {
    return (await response.json()) as ApiErrorPayload;
  } catch {
    return { message: response.statusText };
  }
}

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}
