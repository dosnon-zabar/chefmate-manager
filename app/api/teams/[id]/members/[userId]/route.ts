import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

/**
 * DELETE /api/teams/[id]/members/[userId] — proxy to chefmate-admin
 * DELETE /api/v1/teams/[teamId]/members/[userId]
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const { id, userId } = await params
    const data = await apiFetchServer<unknown>(
      `/teams/${id}/members/${userId}`,
      { method: "DELETE" }
    )
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
