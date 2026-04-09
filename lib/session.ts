/**
 * Session cookie management for chefmate-manager.
 *
 * The pattern: the user authenticates against chefmate-admin's /api/v1/auth/login
 * via a local proxy route (app/api/session/route.ts). That proxy receives the
 * JWT bearer token from the API and stores it in an httpOnly cookie on the
 * chefmate-manager domain. Subsequent API calls go through the same proxy,
 * which reads the cookie and attaches the bearer to outgoing requests.
 *
 * The cookie itself is a signed JWT (separate from the API's JWT) whose
 * payload carries the API bearer token plus a snapshot of the user identity.
 * Signing prevents tampering; httpOnly prevents JS access.
 */

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import type { NextResponse } from "next/server"
import type { RoleAssignment } from "./auth/permissions"

export const SESSION_COOKIE_NAME = "cm_session"
const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 days

export interface SessionUser {
  id: string
  email: string
  first_name: string
  last_name: string
  roles: string[]
  role_assignments: RoleAssignment[]
}

export interface SessionPayload {
  user: SessionUser
  /** The JWT bearer token returned by chefmate-admin /api/v1/auth/login. */
  apiToken: string
}

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      "SESSION_SECRET is not set — add it to .env.local (any 32+ chars will do for dev)"
    )
  }
  return new TextEncoder().encode(secret)
}

/** Sign a session cookie value with the payload. */
export async function encodeSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret())
}

/** Decode and verify a session cookie value. Returns null on failure. */
export async function decodeSession(cookieValue: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(cookieValue, getSecret())
    // We stored the whole SessionPayload as the JWT body. Cast through unknown
    // because the jose types don't know the shape.
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

/** Read the current session from the request cookies. Null if missing/invalid. */
export async function readSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!raw) return null
  return decodeSession(raw)
}

/** Write the session cookie on a NextResponse. */
export function setSessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  })
}

/** Clear the session cookie (logout). */
export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}
