import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

/**
 * GET /api/teams/[id]/members — proxy to chefmate-admin
 * GET /api/v1/teams/[teamId]/members
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const data = await apiFetchServer<unknown>(`/teams/${id}/members`)
    return NextResponse.json({ data })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
