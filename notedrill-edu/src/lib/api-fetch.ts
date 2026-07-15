/**
 * Shared fetch helper for org-api.ts and student-api.ts, talking directly to
 * backend.notedrill.com (no /api/v1 prefix, no refresh-token flow — a single
 * JWT per session). On a 401, dispatches SESSION_EXPIRED_EVENT so
 * AuthContext can clear the relevant token and redirect to login.
 */

import { SESSION_EXPIRED_EVENT } from "@/context/AuthContext";

export const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://backend.notedrill.com";

export type ApiFetchOptions = RequestInit & {
  token?: string;
  /** Which session this token belongs to — used to target the right SESSION_EXPIRED_EVENT. */
  kind: "org" | "student";
};

/** Thrown on any non-2xx response. Carries the HTTP status so callers can special-case things like 504 (gateway timeout on a long-running request that may still complete server-side). */
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Fetch from backend.notedrill.com and unwrap the `.data` field from the `{success, message, data}` envelope. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const { token, kind, ...fetchOptions } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers ?? {}),
    },
  });

  if (res.status === 401 && token) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { kind } }));
  }

  if (!res.ok) {
    // A 504 from the gateway has no JSON body (it's the proxy's own error page, not ours).
    const body = await res.json().catch(() => ({}));
    throw new ApiError((body as { message?: string }).message ?? `API error ${res.status}`, res.status);
  }

  const json = await res.json();
  return (json?.data ?? json) as T;
}
