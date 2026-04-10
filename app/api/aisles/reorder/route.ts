import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await apiFetchServer<unknown>("/aisles/reorder", {
      method: "POST",
      body,
    })
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
