import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const qs = url.search
    const data = await apiFetchServer<unknown>(`/sites${qs}`)
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await apiFetchServer<unknown>("/sites", {
      method: "POST",
      body,
    })
    return NextResponse.json({ data }, { status: 201 })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
