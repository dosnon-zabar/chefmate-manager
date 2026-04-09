import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

/**
 * GET /api/users/by-email?email=... — proxy to chefmate-admin
 * GET /api/v1/users/by-email. Used by the creation wizard to decide
 * whether to collect name/password or jump straight to roles.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const email = url.searchParams.get("email")?.trim()
    if (!email) {
      return NextResponse.json(
        { success: false, error: "email est obligatoire" },
        { status: 400 }
      )
    }
    const data = await apiFetchServer<unknown>(
      `/users/by-email?email=${encodeURIComponent(email)}`
    )
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
