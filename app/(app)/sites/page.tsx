"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import SiteFormPanel, {
  type SiteLifecycleStatus,
  type SiteRow,
} from "@/components/SiteFormPanel"
import ConfirmDialog from "@/components/ConfirmDialog"

const STATUS_LABEL: Record<SiteLifecycleStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  deleted: "Supprimé",
}

const STATUS_BADGE_CLASS: Record<SiteLifecycleStatus, string> = {
  active: "bg-vert-eau/20 text-brun",
  inactive: "bg-brun/10 text-brun-light",
  deleted: "bg-rose/10 text-rose",
}

type StatusFilter = SiteLifecycleStatus | "all"

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Inactifs" },
  { value: "deleted", label: "Supprimés" },
  { value: "all", label: "Tous" },
]

export default function SitesPage() {
  const router = useRouter()
  const { hasRole, can } = useAuth()
  const isAdminGlobal = hasRole("Admin global")
  const canCreate =
    isAdminGlobal ||
    can("create", "site")
  const { showToast } = useToast()

  const [sites, setSites] = useState<SiteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const [pendingStatus, setPendingStatus] = useState<Set<string>>(new Set())

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<SiteRow | null>(null)

  // Confirm dialog for destructive status changes
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    siteId: string
    siteName: string
    newStatus: SiteLifecycleStatus
  } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadSites = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const effectiveStatus: StatusFilter = isAdminGlobal
        ? statusFilter
        : "active"
      const params = new URLSearchParams()
      if (effectiveStatus !== "all") params.set("status", effectiveStatus)
      if (searchTerm) params.set("search", searchTerm)
      const qs = params.toString()
      const res = await fetch(`/api/sites${qs ? `?${qs}` : ""}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setSites(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [isAdminGlobal, statusFilter, searchTerm])

  useEffect(() => {
    void loadSites()
  }, [loadSites])

  function requestStatusChange(
    siteId: string,
    siteName: string,
    newStatus: SiteLifecycleStatus
  ) {
    if (newStatus === "deleted" || newStatus === "inactive") {
      setPendingStatusChange({ siteId, siteName, newStatus })
      setStatusConfirmOpen(true)
      return
    }
    void executeStatusChange(siteId, newStatus)
  }

  async function executeStatusChange(
    siteId: string,
    newStatus: SiteLifecycleStatus
  ) {
    setPendingStatus((prev) => new Set(prev).add(siteId))
    try {
      const res = await fetch(`/api/sites/${siteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycle_status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur de mise à jour")
      }
      setSites((prev) => {
        if (statusFilter !== "all" && statusFilter !== newStatus) {
          return prev.filter((s) => s.id !== siteId)
        }
        return prev.map((s) =>
          s.id === siteId ? { ...s, lifecycle_status: newStatus } : s
        )
      })
      showToast(`Statut mis à jour : ${STATUS_LABEL[newStatus]}.`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
      void loadSites()
    } finally {
      setPendingStatus((prev) => {
        const next = new Set(prev)
        next.delete(siteId)
        return next
      })
    }
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Sites</h1>
          <p className="text-sm text-brun-light mt-1">
            Gérez les sites web de vos équipes
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => {
              setEditingSite(null)
              setPanelOpen(true)
            }}
            className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
          >
            + Nouveau site
          </button>
        )}
      </header>

      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
          <svg
            className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brun-light pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Rechercher par titre ou domaine..."
            className="w-full pl-9 pr-9 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brun-light hover:text-brun text-sm px-1"
            >
              ✕
            </button>
          )}
        </div>

        {isAdminGlobal && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-brun-light uppercase tracking-wide mr-1">
              Statut
            </span>
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-orange text-white border-orange"
                      : "bg-white text-brun border-brun/10 hover:border-orange/40"
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {loading && (
        <p className="text-sm text-brun-light italic">Chargement...</p>
      )}
      {error && (
        <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sites.map((site) => {
          const isPending = pendingStatus.has(site.id)
          return (
            <div
              key={site.id}
              className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col overflow-hidden"
              onClick={() => router.push(`/sites/${site.id}`)}
            >
              {(() => {
                const heroUrl = site.home_hero_image
                  ? site.home_hero_image.startsWith("http")
                    ? site.home_hero_image
                    : `${typeof window !== "undefined" && window.location.hostname !== "localhost" ? "https://chefmate-admin.zabar.fr" : "http://localhost:3000"}${site.home_hero_image}`
                  : null
                return heroUrl ? (
                  <div className="h-28 overflow-hidden">
                    <img src={heroUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                ) : null
              })()}
              <div className="p-5 flex flex-col flex-1">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg text-brun truncate">
                    {site.title}
                  </h3>
                  <a
                    href={site.domain}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-orange hover:text-orange-light truncate block"
                  >
                    {site.domain}
                  </a>
                  {site.team && (
                    <p className="text-xs text-brun-light mt-1">
                      {site.team.name}
                    </p>
                  )}
                </div>

                {isAdminGlobal && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                    <select
                      value={site.lifecycle_status}
                      disabled={isPending}
                      onChange={(e) =>
                        requestStatusChange(
                          site.id,
                          site.title,
                          e.target.value as SiteLifecycleStatus
                        )
                      }
                      aria-label={`Statut de ${site.title}`}
                      className={`status-pill-select ${STATUS_BADGE_CLASS[site.lifecycle_status]}`}
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                      <option value="deleted">Supprimé</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Features + social indicators */}
              <div className="pt-2 border-t border-brun/10 flex-1">
                <div className="flex flex-wrap gap-1.5">
                  {site.events_page_enabled && (
                    <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-vert-eau/20 text-brun">
                      Événements
                    </span>
                  )}
                  {site.about_page_enabled && (
                    <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-vert-eau/20 text-brun">
                      À propos
                    </span>
                  )}
                  {(site.facebook_url ||
                    site.instagram_url ||
                    site.linkedin_url ||
                    site.youtube_url ||
                    site.tiktok_url) && (
                    <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-bleu-gris/10 text-bleu-gris">
                      Réseaux sociaux
                    </span>
                  )}
                </div>
              </div>

              </div>{/* close p-5 wrapper */}
            </div>
          )
        })}
      </div>

      {sites.length === 0 && !loading && !error && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucun site</p>
        </div>
      )}

      <SiteFormPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        site={editingSite}
        onSaved={(message) => {
          setPanelOpen(false)
          if (message) showToast(message)
          void loadSites()
        }}
      />

      <ConfirmDialog
        open={statusConfirmOpen}
        title={
          pendingStatusChange?.newStatus === "deleted"
            ? "Supprimer le site"
            : "Désactiver le site"
        }
        message={
          pendingStatusChange?.newStatus === "deleted"
            ? `Êtes-vous sûr de vouloir supprimer "${pendingStatusChange?.siteName}" ? Le domaine sera libéré mais les données conservées.`
            : `Êtes-vous sûr de vouloir désactiver "${pendingStatusChange?.siteName}" ?`
        }
        confirmLabel={
          pendingStatusChange?.newStatus === "deleted"
            ? "Supprimer"
            : "Désactiver"
        }
        variant={
          pendingStatusChange?.newStatus === "deleted" ? "danger" : "warning"
        }
        onConfirm={() => {
          if (pendingStatusChange) {
            setStatusConfirmOpen(false)
            void executeStatusChange(
              pendingStatusChange.siteId,
              pendingStatusChange.newStatus
            )
            setPendingStatusChange(null)
          }
        }}
        onCancel={() => {
          setStatusConfirmOpen(false)
          setPendingStatusChange(null)
        }}
      />
    </div>
  )
}
