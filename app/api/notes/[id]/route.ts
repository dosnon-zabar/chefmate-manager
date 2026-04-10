import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"
import { createUpdateHandler, createDeleteHandler } from "@/lib/referential-proxy"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await apiFetchServer<unknown>(`/notes/${id}`)
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}

export const PATCH = createUpdateHandler("notes")
export const DELETE = createDeleteHandler("notes")
