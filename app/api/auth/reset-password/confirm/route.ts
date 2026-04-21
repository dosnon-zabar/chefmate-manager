import { NextResponse } from "next/server"

/**
 * POST /api/auth/reset-password/confirm — proxy vers admin.
 *
 * Forward direct, pas de modif du body. Admin valide + consomme.
 *
 * Route publique (déclarée dans middleware.ts API_PUBLIC_PATHS).
 */

const ADMIN_BASE =
  process.env.CHEFMATE_API_URL?.replace(/\/api\/v1\/?$/, "") ||
  "http://localhost:3000"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const res = await fetch(`${ADMIN_BASE}/api/auth/reset-password/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })

    const payload = await res.json().catch(() => ({}))
    return NextResponse.json(payload, { status: res.status })
  } catch (error) {
    console.error("reset-password/confirm proxy error:", error)
    return NextResponse.json(
      { success: false, error: "Erreur réseau" },
      { status: 502 },
    )
  }
}
