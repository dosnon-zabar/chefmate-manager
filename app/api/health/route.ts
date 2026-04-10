import { NextResponse } from "next/server"
import { apiFetchServer, ApiError } from "@/lib/api"
import { readFile } from "fs/promises"

/**
 * GET /api/health — Aggregates health info from admin + manager deps.
 */
export async function GET(request: Request) {
  try {
    // Fetch admin health — apiFetchServer unwraps the { data: ... }
    // envelope, so we get { admin: { ... } } directly.
    let adminHealth: Record<string, unknown> = {}
    try {
      const raw = (await apiFetchServer<Record<string, unknown>>("/health")) as Record<string, unknown>
      // Extract the inner admin object if wrapped
      adminHealth = (raw.admin as Record<string, unknown>) || raw
    } catch {
      adminHealth = { error: "Impossible de contacter l'admin" }
    }

    // Read manager package.json
    let managerDeps: Record<string, string> = {}
    let managerDevDeps: Record<string, string> = {}
    try {
      const pkg = JSON.parse(await readFile(process.cwd() + "/package.json", "utf-8"))
      managerDeps = pkg.dependencies || {}
      managerDevDeps = pkg.devDependencies || {}
    } catch {
      // skip
    }

    return NextResponse.json({
      data: {
        admin: adminHealth,
        manager: {
          node_env: process.env.NODE_ENV || "unknown",
          dependencies: managerDeps,
          devDependencies: managerDevDeps,
        },
      },
    })
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500
    const message = error instanceof Error ? error.message : "Erreur serveur"
    return NextResponse.json({ success: false, error: message }, { status })
  }
}
