/**
 * Typed fetch wrapper that talks to the Chefmate API (chefmate-admin v1).
 *
 * Server-side usage (Server Components, Server Actions, API routes):
 *   import { apiFetchServer } from "@/lib/api"
 *   const teams = await apiFetchServer<Team[]>("/teams")
 *
 * The server-side helper automatically reads the session cookie via
 * readSession() and attaches the Bearer token to the outgoing request.
 *
 * Client-side components should always go through a route in /api/* on the
 * chefmate-manager domain rather than calling the Chefmate API directly,
 * so that the session cookie never leaves the server side.
 */

import { readSession } from "./session"

const BASE_URL = process.env.CHEFMATE_API_URL || "http://localhost:3000/api/v1"

export interface ApiErrorPayload {
  success?: false
  error?: string
  code?: string
}

export class ApiError extends Error {
  status: number
  code?: string
  constructor(message: string, status: number, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export interface FetchOptions extends Omit<RequestInit, "body"> {
  /** JSON body will be stringified automatically. */
  body?: unknown
  /** Explicit bearer token (overrides the session cookie, useful at login). */
  bearer?: string
}

async function baseFetch<T>(
  path: string,
  defaultBearer: string | null,
  options: FetchOptions = {}
): Promise<T> {
  const { body, headers, bearer: explicitBearer, ...rest } = options
  const bearer = explicitBearer ?? defaultBearer

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...(headers as Record<string, string> | undefined),
  }
  if (bearer) finalHeaders["Authorization"] = `Bearer ${bearer}`

  const serializedBody = body !== undefined ? JSON.stringify(body) : undefined

  const res = await fetch(BASE_URL + path, {
    ...rest,
    headers: finalHeaders,
    body: serializedBody,
    cache: "no-store",
  })

  const text = await res.text()
  let parsed: unknown = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = text
  }

  if (!res.ok) {
    const payload = (parsed || {}) as ApiErrorPayload
    throw new ApiError(
      payload.error || `HTTP ${res.status}`,
      res.status,
      payload.code
    )
  }

  // The API wraps success responses in { data: ..., meta?: ... }.
  if (parsed && typeof parsed === "object" && "data" in (parsed as object)) {
    return (parsed as { data: T }).data
  }
  return parsed as T
}

/** Server-side fetch: reads the session cookie and attaches the bearer. */
export async function apiFetchServer<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const session = await readSession()
  const bearer = options.bearer ?? session?.apiToken ?? null
  return baseFetch<T>(path, bearer, options)
}

/** Anonymous fetch: no auth attached. Use at login time. */
export async function apiFetchAnon<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  return baseFetch<T>(path, null, options)
}
