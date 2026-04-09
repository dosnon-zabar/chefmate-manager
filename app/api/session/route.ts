import { NextResponse } from "next/server"
import { apiFetchAnon } from "@/lib/api"
import {
  encodeSession,
  setSessionCookie,
  clearSessionCookie,
  readSession,
  type SessionPayload,
  type SessionUser,
} from "@/lib/session"
import { ROLE_NAMES, type RoleAssignment, type RoleName } from "@/lib/auth/permissions"

interface LoginResponse {
  token: string
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    roles: string[]
  }
}

interface MeResponse {
  user: {
    id: string
    email: string
    first_name: string
    last_name: string
    roles: string[]
    role_assignments: { role: string; teamId: string | null }[]
  }
}

/**
 * POST /api/session — login.
 *
 * Body: { email, password }
 * Flow: call chefmate-admin /api/v1/auth/login with the credentials, then
 * immediately call /api/v1/auth/me with the returned bearer to pull the
 * full role_assignments. Both infos are encoded into an httpOnly cookie.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === "string" ? body.email.trim() : ""
    const password = typeof body.password === "string" ? body.password : ""

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email et mot de passe requis" },
        { status: 400 }
      )
    }

    // Step 1: login
    const login = await apiFetchAnon<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    })

    // Step 2: pull the full user profile (with role_assignments)
    const me = await apiFetchAnon<MeResponse>("/auth/me", {
      bearer: login.token,
    })

    const validRoleNames = new Set<string>(ROLE_NAMES)
    const assignments: RoleAssignment[] = (me.user.role_assignments ?? [])
      .filter((a) => validRoleNames.has(a.role))
      .map((a) => ({ role: a.role as RoleName, teamId: a.teamId }))

    const sessionUser: SessionUser = {
      id: me.user.id,
      email: me.user.email,
      first_name: me.user.first_name,
      last_name: me.user.last_name,
      roles: me.user.roles,
      role_assignments: assignments,
    }

    const payload: SessionPayload = {
      user: sessionUser,
      apiToken: login.token,
    }

    const cookieToken = await encodeSession(payload)
    const response = NextResponse.json({ user: sessionUser })
    setSessionCookie(response, cookieToken)
    return response
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Email ou mot de passe incorrect"
    console.error("POST /api/session error:", error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    )
  }
}

/**
 * GET /api/session — return the currently authenticated user (or 401).
 */
export async function GET() {
  const session = await readSession()
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Non authentifié" },
      { status: 401 }
    )
  }
  return NextResponse.json({ user: session.user })
}

/**
 * DELETE /api/session — logout (clear the cookie).
 */
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  clearSessionCookie(response)
  return response
}
