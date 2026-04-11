import { NextResponse } from "next/server"
import { readSession } from "@/lib/session"
import { createCreateHandler } from "@/lib/referential-proxy"

const BASE_URL = process.env.CHEFMATE_API_URL || "http://localhost:3000/api/v1"

/**
 * Custom GET handler for recipes that preserves pagination meta
 * (total, limit, offset) from the admin API response.
 */
export async function GET(request: Request) {
  try {
    const session = await readSession()
    if (!session?.apiToken) {
      return NextResponse.json({ success: false, error: "Non authentifié" }, { status: 401 })
    }

    const url = new URL(request.url)

    const res = await fetch(`${BASE_URL}/recipes${url.search}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.apiToken}`,
      },
      cache: "no-store",
    })

    const json = await res.json()

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: json.error || `HTTP ${res.status}` },
        { status: res.status }
      )
    }

    // Forward data + meta (total, limit, offset)
    return NextResponse.json({
      data: json.data,
      meta: json.meta ?? null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

export const POST = createCreateHandler("recipes")
