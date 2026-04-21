import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { jwtVerify, decodeJwt } from "jose"
import { SESSION_COOKIE_NAME } from "@/lib/session"

const PUBLIC_PAGE_PATHS = ["/login", "/mot-de-passe-oublie", "/reset-password"]

const API_PUBLIC_PATHS = [
  "/api/session", // login / logout / me (reads cookie itself)
  "/api/auth/reset-password", // proxies vers admin (pas d'auth nécessaire)
]

function getSecret() {
  const secret = process.env.SESSION_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

/**
 * Validate the session cookie and the embedded admin apiToken.
 *
 * Checks performed (all Edge-safe, no DB):
 *  1. Cookie present
 *  2. Cookie JWT signature + exp valid (our own SESSION_SECRET)
 *  3. Embedded apiToken's `exp` claim not in the past (decoded without
 *     signature verification — only admin has the secret. If the embedded
 *     token is expired, admin would 401 anyway, so we preempt it here for
 *     a cleaner UX.)
 *
 * Server-side revocation (session_version bumped by admin) is NOT checked
 * here: detection happens on the next API call to admin, which returns 401
 * and cascades back to the client.
 */
async function isSessionValid(request: NextRequest): Promise<boolean> {
  const cookieValue = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!cookieValue) return false

  const secret = getSecret()
  if (!secret) return false

  try {
    const { payload } = await jwtVerify(cookieValue, secret)
    const apiToken = (payload as { apiToken?: string }).apiToken
    if (!apiToken) return false

    // Decode embedded admin token WITHOUT verifying signature (we don't have
    // admin's secret), just to read a few claims.
    const adminClaims = decodeJwt(apiToken)

    // Expired admin token → our session is de facto dead.
    if (typeof adminClaims.exp === "number") {
      const nowSec = Math.floor(Date.now() / 1000)
      if (adminClaims.exp < nowSec) return false
    }

    // Admin tokens signed before the session_version migration (2026-04-19)
    // are missing this claim and would be rejected by admin on every API
    // call. Treat them as invalid here too so the user gets a clean
    // redirect to /login instead of cascading 401s.
    if (typeof adminClaims.session_version !== "number") return false

    return true
  } catch {
    return false
  }
}

function clearedSessionHeaders() {
  // Same flags as lib/session.setSessionCookie, with maxAge: 0
  return {
    "Set-Cookie": `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`,
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Static assets always pass through
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".ico")
  ) {
    return NextResponse.next()
  }

  const hadCookie = !!request.cookies.get(SESSION_COOKIE_NAME)?.value
  const sessionValid = await isSessionValid(request)

  // API routes
  if (pathname.startsWith("/api/")) {
    if (API_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next()
    }
    if (!sessionValid) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401, headers: clearedSessionHeaders() }
      )
    }
    return NextResponse.next()
  }

  // BO pages
  if (PUBLIC_PAGE_PATHS.some((p) => pathname.startsWith(p))) {
    // If the user is already logged in and hits /login, redirect home.
    // Exception: `?expired=1` means the (app)/layout just rejected them
    // because admin revoked their apiToken. The cookie is still
    // locally-valid but server-revoked — Server Components can't clear
    // cookies, so we need to let them stay on /login long enough to
    // re-auth (which will replace the cookie). Without this exception,
    // the layout would redirect → middleware redirects back → infinite
    // loop.
    if (
      sessionValid &&
      pathname === "/login" &&
      request.nextUrl.searchParams.get("expired") !== "1"
    ) {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  if (!sessionValid) {
    // Differentiate "cookie was there but invalid" (session expired/revoked)
    // from "no cookie at all" (first visit): the first case deserves a
    // "session expirée" banner, the second is just a vanilla login prompt.
    const loginUrl = hadCookie
      ? new URL("/login?expired=1", request.url)
      : new URL("/login", request.url)
    const response = NextResponse.redirect(loginUrl)
    // Clear the cookie on the way so the user lands on a clean state
    // (no more ghost session).
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    })
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
