"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { getAdminBase } from "@/lib/admin-url"
import { RecipeTiming } from "@/components/RecipeTiming"
import { stepToTiming, sumTimings, type Timing } from "@/lib/timing"

interface TeamRef {
  id: string
  name: string
}

interface Recipe {
  id: string
  name: string
  slug: string
  serving_count: number
  status: string
  is_private: boolean
  images: string[]
  creator: { id: string; first_name: string; last_name: string } | null
  recipe_teams: Array<{ team: TeamRef | null }>
  recipe_seasons: Array<{ season: { id: string; name: string; icon: string } | null }>
  recipe_tags: Array<{ tag: { id: string; name: string } | null }>
  ingredients: Array<{ id: string; name: string }>
  /** Steps with timing fields — we only need the timing cols for the
   *  compact display on cards, but the API returns the full set. */
  recipe_steps?: Array<Record<string, unknown>>
  created_at: string
  updated_at: string
}

/** Compute the aggregate timing of a recipe from its steps. Memoize
 *  locally per row — cheap enough even re-computed on each render. */
function recipeTiming(r: Recipe): Timing {
  const steps = Array.isArray(r.recipe_steps) ? r.recipe_steps : []
  return sumTimings(steps.map((s) => stepToTiming(s)))
}

/**
 * Extract image URL from the recipe images array.
 */
function getRecipeImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null
  const img = images[0]
  if (typeof img === "string") return img
  if (img && typeof img === "object" && "url" in img) {
    const url = (img as { url: string }).url
    return `${getAdminBase()}${url}`
  }
  return null
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  brouillon: { label: "Brouillon", bg: "bg-brun/10", text: "text-brun-light" },
  non_publiee: { label: "Non publiée", bg: "bg-jaune/20", text: "text-brun" },
  publiee: { label: "Publiée", bg: "bg-vert-eau/20", text: "text-brun" },
}

const PAGE_SIZE = 24

export default function RecettesPage() {
  const router = useRouter()
  const { hasRole } = useAuth()
  const isAdmin = hasRole("Admin global")

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [teams, setTeams] = useState<TeamRef[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0) // 0-indexed

  // Filters
  const [searchName, setSearchName] = useState("")
  const [searchIngredient, setSearchIngredient] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterTeam, setFilterTeam] = useState("")

  // Reset to page 0 when any filter changes
  const resetPage = useCallback(() => setPage(0), [])

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchName.trim()) params.set("name", searchName.trim())
      if (searchIngredient.trim()) params.set("ingredient", searchIngredient.trim())
      if (filterStatus) params.set("status", filterStatus)
      if (filterTeam) params.set("team_id", filterTeam)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(page * PAGE_SIZE))

      const qs = params.toString()
      const res = await fetch(`/api/recipes?${qs}`)
      const json = await res.json()

      setRecipes(json.data ?? [])
      setTotal(json.meta?.total ?? json.data?.length ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [searchName, searchIngredient, filterStatus, filterTeam, page])

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/teams?status=active")
      const json = await res.json()
      setTeams(json.data ?? [])
    } catch {
      // silent
    }
  }, [])

  // Debounced load on filter/page change
  useEffect(() => {
    const t = setTimeout(() => void loadRecipes(), 300)
    return () => clearTimeout(t)
  }, [loadRecipes])

  // Load teams once
  useEffect(() => {
    void loadTeams()
  }, [loadTeams])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Recettes</h1>
          <p className="text-sm text-brun-light mt-1">
            {total} recette{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => router.push("/recettes/new")}
          className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
        >
          + Nouvelle recette
        </button>
      </header>

      {/* Filters */}
      <div className="mb-6 space-y-3">
        <div className="flex gap-3">
          {/* Search by name */}
          <div className="relative flex-1">
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
              value={searchName}
              onChange={(e) => { setSearchName(e.target.value); resetPage() }}
              placeholder="Rechercher par nom..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
            />
          </div>

          {/* Search by ingredient */}
          <div className="relative flex-1">
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
              value={searchIngredient}
              onChange={(e) => { setSearchIngredient(e.target.value); resetPage() }}
              placeholder="Rechercher par ingrédient..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
            />
          </div>
        </div>

        <div className="flex gap-3">
          {/* Status filter */}
          <div className="relative flex-1">
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
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); resetPage() }}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
            >
              <option value="">Tous les statuts</option>
              <option value="brouillon">Brouillon</option>
              <option value="non_publiee">Non publiée</option>
              <option value="publiee">Publiée</option>
            </select>
          </div>

          {/* Team filter */}
          <div className="relative flex-1">
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
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            <select
              value={filterTeam}
              onChange={(e) => { setFilterTeam(e.target.value); resetPage() }}
              className="w-full pl-9 pr-8 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
            >
              <option value="">Toutes les équipes</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-brun-light italic">Chargement...</p>
      )}

      {/* Recipe cards grid */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {recipes.map((recipe) => {
            const statusInfo = STATUS_LABELS[recipe.status] || STATUS_LABELS.brouillon
            const firstImage = getRecipeImageUrl(recipe.images)

            return (
              <div
                key={recipe.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                onClick={() => router.push(`/recettes/${recipe.id}`)}
              >
                {/* Image */}
                <div className="aspect-[16/10] bg-creme relative">
                  {firstImage ? (
                    <img
                      src={firstImage}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-brun-light/20"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Status badge */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusInfo.bg} ${statusInfo.text}`}
                  >
                    {statusInfo.label}
                  </span>

                  {/* Private badge */}
                  {recipe.is_private && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-brun/10 text-brun-light">
                      Privée
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-serif text-base text-brun mb-1 line-clamp-1">
                    {recipe.name}
                  </h3>

                  {/* Teams */}
                  {recipe.recipe_teams?.length > 0 && (
                    <p className="text-[10px] text-brun-light mb-2">
                      {recipe.recipe_teams
                        .map((rt) => rt.team?.name)
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  )}

                  {/* Aggregated timing — hidden if all steps are empty */}
                  <RecipeTiming
                    timing={recipeTiming(recipe)}
                    variant="compact"
                    className="mb-1"
                  />

                  {/* Seasons + Tags */}
                  {((recipe.recipe_seasons?.length ?? 0) > 0 ||
                    (recipe.recipe_tags?.length ?? 0) > 0) && (
                    <div className="flex flex-wrap gap-1 pt-2 border-t border-brun/5">
                      {recipe.recipe_seasons?.map((rs) =>
                        rs.season ? (
                          <span
                            key={rs.season.id}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-creme text-brun-light"
                          >
                            {rs.season.icon} {rs.season.name}
                          </span>
                        ) : null
                      )}
                      {recipe.recipe_tags?.map((rt) =>
                        rt.tag ? (
                          <span
                            key={rt.tag.id}
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-brun/10 text-brun"
                          >
                            {rt.tag.name}
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && recipes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucune recette</p>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-brun/10 bg-white text-brun hover:bg-creme disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Précédent
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => {
                // Show first, last, and pages around current
                if (i === 0 || i === totalPages - 1) return true
                if (Math.abs(i - page) <= 1) return true
                return false
              })
              .reduce<(number | "ellipsis")[]>((acc, i, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && i - (arr[idx - 1] as number) > 1) {
                  acc.push("ellipsis")
                }
                acc.push(i)
                return acc
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-1 text-brun-light text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      item === page
                        ? "bg-orange text-white font-semibold"
                        : "bg-white border border-brun/10 text-brun hover:bg-creme"
                    }`}
                  >
                    {item + 1}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-brun/10 bg-white text-brun hover:bg-creme disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
