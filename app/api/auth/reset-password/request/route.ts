import { NextResponse } from "next/server"

/**
 * POST /api/auth/reset-password/request — proxy vers admin.
 *
 * Manager forward le body à admin + rajoute `app: "manager"` pour que
 * le lien dans l'email pointe vers manager/reset-password (résolu par
 * admin via son env MANAGER_URL, pas par une URL passée par le client).
 *
 * Route publique (déclarée dans middleware.ts API_PUBLIC_PATHS).
 */

const ADMIN_BASE =
  process.env.CHEFMATE_API_URL?.replace(/\/api\/v1\/?$/, "") ||
  "http://localhost:3000"

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))

    const res = await fetch(`${ADMIN_BASE}/api/auth/reset-password/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, app: "manager" }),
    })

    const payload = await res.json().catch(() => ({}))
    return NextResponse.json(payload, { status: res.status })
  } catch (error) {
    console.error("reset-password/request proxy error:", error)
    // Toujours renvoyer un succès neutre, comme l'admin — pas de leak.
    return NextResponse.json({
      success: true,
      message:
        "Si cette adresse est enregistrée, un email avec les instructions de réinitialisation vient d'être envoyé.",
    })
  }
}
