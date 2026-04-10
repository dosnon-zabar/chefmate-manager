import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; keyId: string }> }
) {
  try {
    const { id, keyId } = await params
    const body = await request.json()
    const data = await apiFetchServer<unknown>(
      `/teams/${id}/api-keys/${keyId}`,
      { method: "DELETE", body }
    )
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
