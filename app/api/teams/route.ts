import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

export async function GET() {
  try {
    const data = await apiFetchServer<unknown>("/teams")
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
