"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"

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
  is_public: boolean
  images: string[]
  creator: { id: string; first_name: string; last_name: string } | null
  recipe_teams: Array<{ team: TeamRef | null }>
  recipe_seasons: Array<{ season: { id: string; name: string; icon: string } | null }>
  recipe_tags: Array<{ tag: { id: string; name: string; color: string } | null }>
  ingredients: Array<{ id: string; name: string }>
  created_at: string
  updated_at: string
}

/**
 * Extract image URL from the recipe images array.
 * Images are stored as objects { id, nom, url, ... } where url is
 * relative to the admin (/api/images/recipes/xxx.jpg). We construct
 * the full URL using the admin domain.
 */
function getRecipeImageUrl(images: unknown): string | null {
  if (!Array.isArray(images) || images.length === 0) return null
  const img = images[0]
  if (typeof img === "string") return img
  if (img && typeof img === "object" && "url" in img) {
    const url = (img as { url: string }).url
    // In prod, use the admin domain; in dev, localhost:3000
    const adminBase =
      typeof window !== "undefined" && window.location.hostname !== "localhost"
        ? "https://chefmate-admin.zabar.fr"
        : "http://localhost:3000"
    return `${adminBase}${url}`
  }
  return null
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  brouillon: { label: "Brouillon", bg: "bg-brun/10", text: "text-brun-light" },
  non_publiee: { label: "Non publiée", bg: "bg-jaune/20", text: "text-brun" },
  publiee: { label: "Publiée", bg: "bg-vert-eau/20", text: "text-brun" },
}

export default function RecettesPage() {
  const router = useRouter()
  const { hasRole } = useAuth()
  const isAdmin = hasRole("Admin global")

  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [teams, setTeams] = useState<TeamRef[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchName, setSearchName] = useState("")
  const [searchIngredient, setSearchIngredient] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [filterTeam, setFilterTeam] = useState("")

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchName.trim()) params.set("name", searchName.trim())
      params.set("limit", "100")
      const qs = params.toString()

      const [recipesRes, teamsRes] = await Promise.all([
        fetch(`/api/recipes${qs ? `?${qs}` : ""}`),
        fetch("/api/teams"),
      ])
      const [recipesJson, teamsJson] = await Promise.all([
        recipesRes.json(),
        teamsRes.json(),
      ])
      setRecipes(recipesJson.data ?? [])
      setTeams(teamsJson.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [searchName])

  useEffect(() => {
    const t = setTimeout(() => void loadData(), 300)
    return () => clearTimeout(t)
  }, [loadData])

  // Client-side filters (ingredient, status, team)
  const filteredRecipes = useMemo(() => {
    let filtered = recipes

    if (searchIngredient.trim()) {
      const s = searchIngredient.trim().toLowerCase()
      filtered = filtered.filter((r) =>
        r.ingredients?.some((ing) =>
          ing.name.toLowerCase().includes(s)
        )
      )
    }

    if (filterStatus) {
      filtered = filtered.filter((r) => r.status === filterStatus)
    }

    if (filterTeam) {
      filtered = filtered.filter((r) =>
        r.recipe_teams?.some((rt) => rt.team?.id === filterTeam)
      )
    }

    return filtered
  }, [recipes, searchIngredient, filterStatus, filterTeam])

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Recettes</h1>
          <p className="text-sm text-brun-light mt-1">
            {filteredRecipes.length} recette{filteredRecipes.length !== 1 ? "s" : ""}
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
              onChange={(e) => setSearchName(e.target.value)}
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
              onChange={(e) => setSearchIngredient(e.target.value)}
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
              onChange={(e) => setFilterStatus(e.target.value)}
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
              onChange={(e) => setFilterTeam(e.target.value)}
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
          {filteredRecipes.map((recipe) => {
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

                  {/* Public badge */}
                  {recipe.is_public && (
                    <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-medium rounded-full bg-orange/20 text-orange">
                      Public
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
                            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                            style={{
                              backgroundColor: rt.tag.color + "20",
                              color: rt.tag.color,
                            }}
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

      {!loading && filteredRecipes.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucune recette</p>
        </div>
      )}
    </div>
  )
}
