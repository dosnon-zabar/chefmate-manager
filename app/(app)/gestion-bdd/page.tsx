"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"

interface DepInfo {
  name: string
  current: string
}

interface HealthData {
  admin?: {
    supabase_url?: string
    db_status?: string
    table_count?: number
    node_env?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
    error?: string
  }
  manager?: {
    node_env?: string
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
}

export default function SanteTechniquePage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole("Admin global")

  const [health, setHealth] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadHealth = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/health")
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setHealth(json.data ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) void loadHealth()
    else setLoading(false)
  }, [isAdmin, loadHealth])

  const adminDeps = health?.admin?.dependencies || {}
  const adminDevDeps = health?.admin?.devDependencies || {}
  const managerDeps = health?.manager?.dependencies || {}
  const managerDevDeps = health?.manager?.devDependencies || {}

  function depsToList(deps: Record<string, string>): DepInfo[] {
    return Object.entries(deps)
      .map(([name, version]) => ({ name, current: version }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brun">Santé technique</h1>
        <p className="text-sm text-brun-light mt-1">
          Informations techniques et dépendances des projets
        </p>
      </header>

      {!isAdmin && (
        <div className="bg-white rounded-2xl p-8 text-center">
          <p className="text-brun-light text-sm">
            Accès réservé aux Admin global.
          </p>
        </div>
      )}

      {loading && (
        <p className="text-sm text-brun-light italic">Chargement...</p>
      )}
      {error && (
        <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {isAdmin && health && (
        <div className="space-y-6">
          {/* Environnement */}
          <Section title="Environnement">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoCard
                label="Supabase"
                value={health.admin?.supabase_url || "—"}
              />
              <InfoCard
                label="Connexion DB"
                value={health.admin?.db_status || "—"}
                variant={
                  health.admin?.db_status === "connected"
                    ? "success"
                    : "error"
                }
              />
              <InfoCard
                label="Tables"
                value={String(health.admin?.table_count ?? "—")}
              />
              <InfoCard
                label="Env Admin"
                value={health.admin?.node_env || "—"}
              />
            </div>
          </Section>

          {/* Liens administration */}
          <Section title="Outils d'administration">
            <p className="text-sm text-brun-light mb-3">
              Les opérations de maintenance directe (backup, structure
              BDD, nettoyage CDN) nécessitent un accès direct à Supabase
              et sont disponibles dans le BO Admin.
            </p>
            <div className="flex flex-wrap gap-3">
              <ExternalLink
                href={
                  (health.admin?.supabase_url || "")
                    .replace("http://127.0.0.1:54321", "http://127.0.0.1:54323")
                    .replace(/\/$/,"") || "#"
                }
                label="Supabase Studio"
              />
              <ExternalLink
                href="/gestion-bdd"
                label="BO Admin — Gestion BDD"
                isInternal
              />
            </div>
          </Section>

          {/* Dépendances Admin */}
          <Section title="Dépendances — chefmate-admin">
            <DepsTable
              deps={depsToList(adminDeps)}
              label="Production"
            />
            <DepsTable
              deps={depsToList(adminDevDeps)}
              label="Développement"
              collapsed
            />
          </Section>

          {/* Dépendances Manager */}
          <Section title="Dépendances — chefmate-manager">
            <DepsTable
              deps={depsToList(managerDeps)}
              label="Production"
            />
            <DepsTable
              deps={depsToList(managerDevDeps)}
              label="Développement"
              collapsed
            />
          </Section>
        </div>
      )}
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl p-6">
      <h2 className="font-serif text-lg text-brun mb-4">{title}</h2>
      {children}
    </div>
  )
}

function InfoCard({
  label,
  value,
  variant,
}: {
  label: string
  value: string
  variant?: "success" | "error"
}) {
  return (
    <div className="bg-creme rounded-lg px-4 py-3">
      <div className="text-[10px] font-semibold text-brun-light uppercase tracking-wide mb-1">
        {label}
      </div>
      <div
        className={`text-sm font-medium truncate ${
          variant === "success"
            ? "text-vert-eau"
            : variant === "error"
              ? "text-rose"
              : "text-brun"
        }`}
      >
        {value}
      </div>
    </div>
  )
}

function ExternalLink({
  href,
  label,
  isInternal,
}: {
  href: string
  label: string
  isInternal?: boolean
}) {
  return (
    <a
      href={href}
      target={isInternal ? undefined : "_blank"}
      rel={isInternal ? undefined : "noopener noreferrer"}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-orange bg-orange/10 rounded-lg hover:bg-orange/20 transition-colors"
    >
      {label}
      {!isInternal && (
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      )}
    </a>
  )
}

function DepsTable({
  deps,
  label,
  collapsed,
}: {
  deps: DepInfo[]
  label: string
  collapsed?: boolean
}) {
  const [open, setOpen] = useState(!collapsed)

  if (deps.length === 0) return null

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-xs font-semibold text-brun-light uppercase tracking-wide mb-2 hover:text-brun transition-colors"
      >
        <svg
          className={`w-3 h-3 transition-transform ${
            open ? "rotate-90" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 5l7 7-7 7"
          />
        </svg>
        {label} ({deps.length})
      </button>
      {open && (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[10px] font-semibold text-brun-light uppercase tracking-wide">
              <th className="text-left px-3 py-1">Package</th>
              <th className="text-left px-3 py-1">Version</th>
            </tr>
          </thead>
          <tbody>
            {deps.map((dep, i) => (
              <tr
                key={dep.name}
                className={i % 2 === 0 ? "" : "bg-creme/30"}
              >
                <td className="px-3 py-1 text-brun font-mono text-xs">
                  {dep.name}
                </td>
                <td className="px-3 py-1 text-brun-light font-mono text-xs">
                  {dep.current}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
