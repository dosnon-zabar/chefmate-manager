import { NextResponse } from "next/server"
import { readSession } from "@/lib/session"
import { apiFetchServer, ApiError } from "@/lib/api"

const ADMIN_BASE =
  process.env.CHEFMATE_API_URL?.replace(/\/api\/v1\/?$/, "") ||
  "http://localhost:3000"

/**
 * POST /api/sites/[id]/favicon — Forward favicon upload to admin.
 *
 * Unlike the typical JSON proxies in this app, we pass through the
 * multipart body untouched (same pattern as /api/upload-image) —
 * admin validates the image, generates all sizes, stores them, and
 * returns the `favicon_urls` map.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await readSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 }
      )
    }

    const { id } = await params
    const formData = await request.formData()

    const res = await fetch(`${ADMIN_BASE}/api/v1/sites/${id}/favicon`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.apiToken}` },
      body: formData,
    })

    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: json.error || "Erreur upload favicon", code: json.code },
        { status: res.status }
      )
    }
    return NextResponse.json(json)
  } catch (error) {
    console.error("POST favicon proxy error:", error)
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 }
    )
  }
}

/** DELETE /api/sites/[id]/favicon — Remove a site's favicon. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await apiFetchServer<unknown>(`/sites/${id}/favicon`, {
      method: "DELETE",
    })
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
