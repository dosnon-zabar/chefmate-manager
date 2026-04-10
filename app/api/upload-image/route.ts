import { NextResponse } from "next/server"
import { readSession } from "@/lib/session"

const ADMIN_BASE =
  process.env.CHEFMATE_API_URL?.replace("/api/v1", "") ||
  "http://localhost:3000"

/**
 * POST /api/upload-image — Proxy FormData to admin's upload endpoint.
 *
 * The admin endpoint expects multipart/form-data with:
 *  - file: File
 *  - prefix: string (e.g. "recipes")
 *
 * We forward the raw body + content-type header, adding the Bearer
 * token from the session.
 */
export async function POST(request: Request) {
  try {
    const session = await readSession()
    if (!session) {
      return NextResponse.json(
        { success: false, error: "Non authentifié" },
        { status: 401 }
      )
    }

    const formData = await request.formData()

    const res = await fetch(`${ADMIN_BASE}/api/upload-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.apiToken}`,
      },
      body: formData,
    })

    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: json.error || "Erreur upload" },
        { status: res.status }
      )
    }

    return NextResponse.json(json)
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Erreur serveur" },
      { status: 500 }
    )
  }
}
