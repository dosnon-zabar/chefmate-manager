import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

/**
 * GET /api/users — proxy to chefmate-admin /api/v1/users
 * Supports ?status=xxx & ?search=xxx.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const qs = url.search
    const data = await apiFetchServer<unknown>(`/users${qs}`)
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

/**
 * POST /api/users — proxy to chefmate-admin POST /api/v1/users
 * (Admin global only, handled by the API itself)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await apiFetchServer<unknown>("/users", { method: "POST", body })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
