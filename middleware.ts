import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SESSION_COOKIE_NAME } from "@/lib/session"

const PUBLIC_PAGE_PATHS = ["/login"]

const API_PUBLIC_PATHS = [
  "/api/session", // login / logout / me (reads cookie itself)
]

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

  const hasSession = !!request.cookies.get(SESSION_COOKIE_NAME)?.value

  // API routes
  if (pathname.startsWith("/api/")) {
    if (API_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return NextResponse.next()
    }
    if (!hasSession) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 }
      )
    }
    return NextResponse.next()
  }

  // BO pages
  if (PUBLIC_PAGE_PATHS.some((p) => pathname.startsWith(p))) {
    // If the user is already logged in and hits /login, redirect to the home.
    if (hasSession && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  if (!hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
