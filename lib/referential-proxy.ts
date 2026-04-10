/**
 * Generic proxy factory for referential CRUD endpoints.
 * Each referential (units, aisles, tags, seasons) reuses the same pattern.
 */

import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"

function errorResponse(error: unknown) {
  const status = error instanceof ApiError ? error.status : 500
  const message = error instanceof Error ? error.message : "Erreur serveur"
  return NextResponse.json({ success: false, error: message }, { status })
}

export function createListHandler(apiPath: string) {
  return async function GET(request: Request) {
    try {
      const url = new URL(request.url)
      const data = await apiFetchServer<unknown>(`/${apiPath}${url.search}`)
      return NextResponse.json({ data })
    } catch (error) {
      return errorResponse(error)
    }
  }
}

export function createCreateHandler(apiPath: string) {
  return async function POST(request: Request) {
    try {
      const body = await request.json()
      const data = await apiFetchServer<unknown>(`/${apiPath}`, {
        method: "POST",
        body,
      })
      return NextResponse.json({ data }, { status: 201 })
    } catch (error) {
      return errorResponse(error)
    }
  }
}

export function createUpdateHandler(apiPath: string) {
  return async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params
      const body = await request.json()
      const data = await apiFetchServer<unknown>(`/${apiPath}/${id}`, {
        method: "PATCH",
        body,
      })
      return NextResponse.json({ data })
    } catch (error) {
      return errorResponse(error)
    }
  }
}

export function createDeleteHandler(apiPath: string) {
  return async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
  ) {
    try {
      const { id } = await params
      const data = await apiFetchServer<unknown>(`/${apiPath}/${id}`, {
        method: "DELETE",
      })
      return NextResponse.json({ data })
    } catch (error) {
      return errorResponse(error)
    }
  }
}
