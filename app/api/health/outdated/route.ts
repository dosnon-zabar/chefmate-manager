import { NextResponse } from "next/server"
import { readFile } from "fs/promises"
import { apiFetchServer, ApiError } from "@/lib/api"

interface OutdatedInfo {
  name: string
  current: string
  latest: string
  needsUpdate: boolean
}

/**
 * Clean a semver range to get the base version (strip ^, ~, >=, etc.)
 */
function cleanVersion(v: string): string {
  return v.replace(/^[\^~>=<]+/, "").trim()
}

/**
 * Fetch latest version from npm registry. Returns null on failure.
 */
async function getLatestVersion(pkg: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg)}/latest`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const json = await res.json()
    return json.version || null
  } catch {
    return null
  }
}

/**
 * Compare two semver strings. Returns true if latest > current.
 */
function isNewer(current: string, latest: string): boolean {
  const c = current.split(".").map(Number)
  const l = latest.split(".").map(Number)
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true
    if ((l[i] || 0) < (c[i] || 0)) return false
  }
  return false
}

/**
 * GET /api/health/outdated — Check for outdated dependencies.
 *
 * Fetches latest versions from npm registry and compares with
 * installed versions from both admin and manager package.json.
 */
export async function GET(request: Request) {
  try {
    // Gather all deps from admin + manager
    let adminDeps: Record<string, string> = {}
    try {
      const raw = (await apiFetchServer<Record<string, unknown>>(
        "/health"
      )) as Record<string, unknown>
      const admin = (raw.admin as Record<string, unknown>) || raw
      adminDeps = (admin.dependencies as Record<string, string>) || {}
    } catch {
      // skip
    }

    let managerDeps: Record<string, string> = {}
    try {
      const pkg = JSON.parse(
        await readFile(process.cwd() + "/package.json", "utf-8")
      )
      managerDeps = pkg.dependencies || {}
    } catch {
      // skip
    }

    // Deduplicate: merge all unique packages
    const allPackages = new Map<string, { current: string; project: string }>()
    for (const [name, version] of Object.entries(adminDeps)) {
      allPackages.set(name, { current: cleanVersion(version), project: "admin" })
    }
    for (const [name, version] of Object.entries(managerDeps)) {
      if (allPackages.has(name)) {
        // Package in both — keep both versions noted
        allPackages.set(name, {
          current: cleanVersion(version),
          project: "both",
        })
      } else {
        allPackages.set(name, {
          current: cleanVersion(version),
          project: "manager",
        })
      }
    }

    // Check latest versions (batch, max 10 concurrent)
    const entries = Array.from(allPackages.entries())
    const results: (OutdatedInfo & { project: string })[] = []

    // Process in batches of 10 to avoid hammering npm
    for (let i = 0; i < entries.length; i += 10) {
      const batch = entries.slice(i, i + 10)
      const latests = await Promise.all(
        batch.map(([name]) => getLatestVersion(name))
      )
      for (let j = 0; j < batch.length; j++) {
        const [name, info] = batch[j]
        const latest = latests[j]
        if (latest) {
          const needsUpdate = isNewer(info.current, latest)
          if (needsUpdate) {
            results.push({
              name,
              current: info.current,
              latest,
              needsUpdate,
              project: info.project,
            })
          }
        }
      }
    }

    // Sort by name
    results.sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json({
      data: {
        outdated: results,
        total_checked: allPackages.size,
        total_outdated: results.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Erreur lors de la vérification" },
      { status: 500 }
    )
  }
}
