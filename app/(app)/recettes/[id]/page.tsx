"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import SeoBlock from "@/components/SeoBlock"
import { SortableTree, buildTreeFromFlat } from "@/components/SortableTree"
import ConfirmDialog from "@/components/ConfirmDialog"
import HelpBubble from "@/components/HelpBubble"
import RecipePdfModal from "@/components/RecipePdfModal"

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 bg-creme rounded-lg border border-brun/10 animate-pulse" />
  ),
})

// ---- Types ----

interface UnitRef { id: string; name: string; abbreviation: string; abbreviation_plural?: string | null }
interface AisleRef { id: string; name: string; color: string }
interface SeasonRef { id: string; name: string; icon: string }
interface TagRef { id: string; name: string }
interface TeamRef { id: string; name: string }

interface MasterIngredient {
  id: string
  name: string
  name_en: string | null
  image_url: string | null
  default_unit_id: string | null
  default_aisle_id: string | null
  unit_ids: string[]
  aisle_ids: string[]
}

interface RecipeIngredient {
  id: string
  name: string
  quantity: number | null
  sort_order: number
  comment: string | null
  ingredient_master_id: string | null
  unit: UnitRef | null
  aisle: AisleRef | null
  master: MasterIngredient | null
  _availableUnitIds?: string[]
  _availableAisleIds?: string[]
}

interface RecipeStep {
  id: string
  sort_order: number
  title: string
  text: string
  image_url: string | null
}

interface ImageObj {
  id: string
  nom: string
  url: string
  ordre: number
  taille: number
}

interface Recipe {
  id: string
  name: string
  slug: string
  serving_count: number
  status: string
  is_private: boolean
  is_duplicable: boolean
  price_range: number | null
  difficulty: number | null
  presentation: string | null
  seo_title: string | null
  seo_desc: string | null
  seo_image: string | null
  images: ImageObj[]
  portion_type_id: string | null
  portion_type: { id: string; name: string } | null
  creator: { id: string; first_name: string; last_name: string } | null
  recipe_teams: Array<{ team: TeamRef | null }>
  recipe_seasons: Array<{ season: SeasonRef | null }>
  recipe_tags: Array<{ tag: TagRef | null }>
  ingredients: RecipeIngredient[]
  recipe_steps: RecipeStep[]
}

import { formatIngredientNatural } from "@/lib/format-ingredient"
import { getAdminBase } from "@/lib/admin-url"

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

// =====================================================================
// MAIN PAGE
// =====================================================================

export default function RecipeEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { hasRole } = useAuth()
  const { showToast } = useToast()

  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)

  // Reference data
  const [allTeams, setAllTeams] = useState<TeamRef[]>([])
  const [allSeasons, setAllSeasons] = useState<SeasonRef[]>([])
  const [allTags, setAllTags] = useState<TagRef[]>([])
  const [allUnits, setAllUnits] = useState<UnitRef[]>([])
  const [allAisles, setAllAisles] = useState<AisleRef[]>([])

  // Portion types
  const [allPortionTypes, setAllPortionTypes] = useState<Array<{ id: string; name: string }>>([])

  // Catalog ingredients for autocomplete
  const [catalogIngredients, setCatalogIngredients] = useState<MasterIngredient[]>([])

  // PDF
  const [pdfOpen, setPdfOpen] = useState(false)

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ---- Load ----

  const loadRecipe = useCallback(async () => {
    try {
      const res = await fetch(`/api/recipes/${id}`)
      const json = await res.json()
      if (json.data) setRecipe(json.data)
    } catch { /* silent */ }
  }, [id])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        loadRecipe(),
        fetch("/api/teams?status=active").then(r => r.json()).then(j => setAllTeams(j.data ?? [])).catch(() => {}),
        fetch("/api/seasons").then(r => r.json()).then(j => setAllSeasons(j.data ?? [])).catch(() => {}),
        fetch("/api/tags").then(r => r.json()).then(j => setAllTags(j.data ?? [])).catch(() => {}),
        fetch("/api/units").then(r => r.json()).then(j => setAllUnits(j.data ?? [])).catch(() => {}),
        fetch("/api/aisles").then(r => r.json()).then(j => setAllAisles(j.data ?? [])).catch(() => {}),
        fetch("/api/portion-types").then(r => r.json()).then(j => setAllPortionTypes(j.data ?? [])).catch(() => {}),
        fetch("/api/ingredients").then(r => r.json()).then(j => setCatalogIngredients(
          (j.data ?? []).map((i: Record<string, unknown>) => ({
            id: i.id, name: i.name, name_en: i.name_en, image_url: i.image_url ?? null,
            default_unit_id: i.default_unit_id, default_aisle_id: i.default_aisle_id,
            unit_ids: ((i.ingredient_units as Array<{ unit: { id: string } | null }>) ?? [])
              .map((iu) => iu.unit?.id)
              .filter(Boolean) as string[],
            aisle_ids: ((i.ingredient_aisles as Array<{ aisle: { id: string } | null }>) ?? [])
              .map((ia) => ia.aisle?.id)
              .filter(Boolean) as string[],
          }))
        )).catch(() => {}),
      ])
      setLoading(false)
    }
    void init()
  }, [loadRecipe])

  // ---- Auto-save helper ----

  async function patchRecipe(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/recipes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
      return false
    }
  }

  // ---- Delete ----

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/recipes/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur")
      showToast("Recette supprimée.")
      router.push("/recettes")
    } catch {
      showToast("Erreur lors de la suppression", "error")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-brun-light italic">Chargement...</p>
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="text-center py-20">
        <p className="text-brun-light">Recette non trouvée</p>
        <button
          onClick={() => router.push("/recettes")}
          className="mt-4 text-orange text-sm hover:text-orange-light"
        >
          Retour à la liste
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header with back link + PDF button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/recettes")}
          className="text-sm text-brun-light hover:text-brun transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux recettes
        </button>
        <button
          type="button"
          onClick={() => setPdfOpen(true)}
          className="px-3 py-1.5 text-xs font-medium text-brun-light border border-brun/10 rounded-lg hover:border-orange/40 hover:text-orange transition-colors flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Télécharger PDF
        </button>
      </div>

      {/* Section 1: Infos générales */}
      <InfoSection
        recipe={recipe}
        allTeams={allTeams}
        allSeasons={allSeasons}
        allTags={allTags}
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
        onRefreshTags={() => fetch("/api/tags").then(r => r.json()).then(j => setAllTags(j.data ?? [])).catch(() => {})}
      />

      {/* Section 2: Images */}
      <ImageSection
        recipe={recipe}
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
      />

      {/* Section 3: Ingrédients */}
      <IngredientSection
        recipe={recipe}
        allUnits={allUnits}
        allAisles={allAisles}
        allPortionTypes={allPortionTypes}
        catalogIngredients={catalogIngredients}
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
      />

      {/* Section 4: Étapes */}
      <StepSection
        recipe={recipe}
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
      />

      {/* SEO & Partage */}
      <SeoBlock
        seoTitle={recipe.seo_title}
        seoDesc={recipe.seo_desc}
        seoImage={recipe.seo_image}
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
      />

      {/* Danger zone */}
      <div className="bg-white rounded-2xl p-6 border border-rose/20">
        <h2 className="text-sm font-semibold text-rose mb-2">Zone danger</h2>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="px-4 py-2 text-sm text-rose border border-rose/30 rounded-lg hover:bg-rose/10 transition-colors"
        >
          Supprimer cette recette
        </button>
      </div>

      {/* PDF Modal */}
      <RecipePdfModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        recipe={recipe}
      />

      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer la recette"
        message={`Êtes-vous sûr de vouloir supprimer "${recipe.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
      />
    </div>
  )
}

// =====================================================================
// SECTION 1: INFOS GÉNÉRALES
// =====================================================================

function InfoSection({
  recipe,
  allTeams,
  allSeasons,
  allTags,
  onPatch,
  onRefresh,
  onRefreshTags,
}: {
  recipe: Recipe
  allTeams: TeamRef[]
  allSeasons: SeasonRef[]
  allTags: TagRef[]
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
  onRefreshTags: () => void
}) {
  const [name, setName] = useState(recipe.name)
  const { showToast } = useToast()

  const teamIds = useMemo(
    () => new Set(recipe.recipe_teams?.map((rt) => rt.team?.id).filter(Boolean) as string[]),
    [recipe]
  )
  const seasonIds = useMemo(
    () => new Set(recipe.recipe_seasons?.map((rs) => rs.season?.id).filter(Boolean) as string[]),
    [recipe]
  )
  const tagIds = useMemo(
    () => new Set(recipe.recipe_tags?.map((rt) => rt.tag?.id).filter(Boolean) as string[]),
    [recipe]
  )

  async function saveName() {
    if (name.trim() && name.trim() !== recipe.name) {
      if (await onPatch({ name: name.trim() })) {
        showToast("Nom enregistré")
        void onRefresh()
      }
    }
  }

  async function toggleTeam(teamId: string) {
    const next = new Set(teamIds)
    if (next.has(teamId)) next.delete(teamId)
    else next.add(teamId)
    if (await onPatch({ team_ids: Array.from(next) })) void onRefresh()
  }

  async function toggleSeason(seasonId: string) {
    const next = new Set(seasonIds)
    if (next.has(seasonId)) next.delete(seasonId)
    else next.add(seasonId)
    if (await onPatch({ season_ids: Array.from(next) })) void onRefresh()
  }

  // Presentation text state
  const [presentationText, setPresentationText] = useState(recipe.presentation ?? "")

  async function savePresentation(html: string) {
    if (html !== (recipe.presentation ?? "")) {
      if (await onPatch({ presentation: html || null })) void onRefresh()
    }
  }

  // Tag autocomplete state
  const [tagInput, setTagInput] = useState("")
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const tagBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const selectedTags = useMemo(
    () => recipe.recipe_tags?.map((rt) => rt.tag).filter(Boolean) as TagRef[],
    [recipe]
  )

  const filteredTagOptions = useMemo(() => {
    if (!tagInput.trim()) return allTags.filter((t) => !tagIds.has(t.id))
    const q = tagInput.trim().toLowerCase()
    return allTags.filter((t) => !tagIds.has(t.id) && t.name.toLowerCase().includes(q))
  }, [allTags, tagIds, tagInput])

  const exactTagMatch = useMemo(
    () => allTags.some((t) => t.name.toLowerCase() === tagInput.trim().toLowerCase()),
    [allTags, tagInput]
  )

  async function addTag(tagId: string) {
    const next = new Set(tagIds)
    next.add(tagId)
    if (await onPatch({ tag_ids: Array.from(next) })) void onRefresh()
    setTagInput("")
    setTagDropdownOpen(false)
  }

  async function removeTag(tagId: string) {
    const next = new Set(tagIds)
    next.delete(tagId)
    if (await onPatch({ tag_ids: Array.from(next) })) void onRefresh()
  }

  async function createAndAddTag() {
    const trimmed = tagInput.trim()
    if (!trimmed || creatingTag) return
    setCreatingTag(true)
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const json = await res.json()
      if (json.data?.id) {
        await addTag(json.data.id)
        onRefreshTags()
        showToast(`Tag « ${trimmed} » créé`)
      } else {
        showToast("Erreur lors de la création du tag", "error")
      }
    } catch {
      showToast("Erreur lors de la création du tag", "error")
    } finally {
      setCreatingTag(false)
    }
  }

  function handleTagKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault()
      if (filteredTagOptions.length === 1) {
        void addTag(filteredTagOptions[0].id)
      } else if (tagInput.trim() && !exactTagMatch) {
        void createAndAddTag()
      }
    }
    if (e.key === "Escape") {
      setTagDropdownOpen(false)
      setTagInput("")
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left 2/3 — Infos recette */}
      <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm space-y-4">
        {/* Name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => e.key === "Enter" && saveName()}
          className="font-serif text-2xl text-brun bg-transparent border-0 focus:outline-none focus:ring-0 w-full placeholder:text-brun-light/40"
          placeholder="Nom de la recette"
        />

        {/* Seasons */}
        {allSeasons.length > 0 && (
          <div>
            <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Saisons</h3>
            <div className="flex flex-wrap gap-2">
              {allSeasons.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSeason(s.id)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    seasonIds.has(s.id)
                      ? "bg-vert-eau/20 text-brun border-vert-eau"
                      : "bg-white text-brun-light border-brun/10 hover:border-vert-eau/40"
                  }`}
                >
                  {s.icon} {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tags — autocomplete + create */}
        <div>
          <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Tags</h3>

          {/* Selected tags as pills */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedTags.map((t) => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-full bg-brun/10 text-brun"
                >
                  {t.name}
                  <button
                    type="button"
                    onClick={() => removeTag(t.id)}
                    className="hover:text-rose transition-colors"
                    aria-label={`Retirer ${t.name}`}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input with dropdown */}
          <div className="relative">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => { setTagInput(e.target.value); setTagDropdownOpen(true) }}
              onFocus={() => setTagDropdownOpen(true)}
              onBlur={() => {
                // Delay to allow click on dropdown items
                if (tagBlurTimeout.current) clearTimeout(tagBlurTimeout.current)
                tagBlurTimeout.current = setTimeout(() => setTagDropdownOpen(false), 200)
              }}
              onKeyDown={handleTagKeyDown}
              placeholder="Ajouter un tag..."
              className="w-full px-3 py-1.5 rounded-lg border border-brun/10 bg-creme text-sm text-brun placeholder:text-brun-light/50 focus:outline-none focus:ring-2 focus:ring-orange/30"
            />

            {tagDropdownOpen && (tagInput.trim() || filteredTagOptions.length > 0) && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brun/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredTagOptions.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addTag(t.id)}
                    className="w-full text-left px-3 py-2 text-sm text-brun hover:bg-creme transition-colors"
                  >
                    {t.name}
                  </button>
                ))}

                {/* Create option — shown when input doesn't match an existing tag */}
                {tagInput.trim() && !exactTagMatch && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={createAndAddTag}
                    disabled={creatingTag}
                    className="w-full text-left px-3 py-2 text-sm text-orange hover:bg-orange/5 transition-colors border-t border-brun/5 flex items-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                    </svg>
                    {creatingTag ? "Création..." : `Créer « ${tagInput.trim()} »`}
                  </button>
                )}

                {filteredTagOptions.length === 0 && !(tagInput.trim() && !exactTagMatch) && (
                  <p className="px-3 py-2 text-xs text-brun-light italic">Aucun tag trouvé</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Price + Difficulty */}
        <div className="flex gap-4">
          {/* Price range */}
          <div className="flex-1">
            <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Prix</h3>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={async () => {
                    const value = recipe.price_range === level ? null : level
                    if (await onPatch({ price_range: value })) void onRefresh()
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer ${
                    (recipe.price_range ?? 0) >= level
                      ? "bg-orange text-white border-orange"
                      : "bg-white text-brun-light border-brun/10 hover:border-orange/40"
                  }`}
                >
                  {"€".repeat(level)}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="flex-1">
            <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Difficulté</h3>
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={async () => {
                    const value = recipe.difficulty === level ? null : level
                    if (await onPatch({ difficulty: value })) void onRefresh()
                  }}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors cursor-pointer flex items-center gap-0.5 ${
                    (recipe.difficulty ?? 0) >= level
                      ? "bg-orange text-white border-orange"
                      : "bg-white text-brun-light border-brun/10 hover:border-orange/40"
                  }`}
                  title={`Difficulté ${level}/3`}
                >
                  {Array.from({ length: level }).map((_, i) => (
                    <svg key={i} className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C9.24 2 7 4.24 7 7c0 1.62.78 3.06 2 3.97V12h6v-1.03c1.22-.91 2-2.35 2-3.97 0-2.76-2.24-5-5-5zM9 16v2h6v-2H9zm3 6c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z" />
                    </svg>
                  ))}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Presentation text */}
        <div>
          <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Présentation de la recette</h3>
          <RichTextEditor
            value={presentationText}
            onChange={(html) => { setPresentationText(html); savePresentation(html) }}
          />
        </div>
      </div>

      {/* Right 1/3 — Publication */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide">Publication</h3>

        {/* Status */}
        <div>
          <label className="text-xs text-brun-light mb-1 block">Statut</label>
          <select
            value={recipe.status}
            onChange={async (e) => {
              if (await onPatch({ status: e.target.value })) void onRefresh()
            }}
            className="w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
          >
            <option value="brouillon">Brouillon</option>
            <option value="non_publiee">Non publiée</option>
            <option value="publiee">Publiée</option>
          </select>
        </div>

        {/* Private toggle */}
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={recipe.is_private ?? false}
              onChange={async (e) => {
                const body: Record<string, unknown> = { is_private: e.target.checked }
                // Force duplicable off when going private
                if (e.target.checked && recipe.is_duplicable) body.is_duplicable = false
                if (await onPatch(body)) void onRefresh()
              }}
              className="rounded border-brun/20 text-orange focus:ring-orange/30"
            />
            <span className="text-sm text-brun">Recette privée</span>
            <HelpBubble text="Une recette privée n'apparaîtra sur aucun site et ne sera pas partagée à la communauté." />
          </label>
        </div>

        {/* Duplicable toggle — hidden when private */}
        {!(recipe.is_private ?? false) && (
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={recipe.is_duplicable ?? false}
                onChange={async (e) => {
                  if (await onPatch({ is_duplicable: e.target.checked })) void onRefresh()
                }}
                className="rounded border-brun/20 text-orange focus:ring-orange/30"
              />
              <span className="text-sm text-brun">Duplicable</span>
            </label>
            <p className="text-[10px] text-brun-light mt-1">Permet à la communauté de dupliquer cette recette</p>
          </div>
        )}

        {/* Teams */}
        {(allTeams.length > 0 || recipe.recipe_teams?.length > 0) && (
          <div>
            <label className="text-xs text-brun-light mb-2 block">Équipes</label>
            <div className="flex flex-wrap gap-2">
              {/* Active teams — toggleable */}
              {allTeams.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTeam(t.id)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                    teamIds.has(t.id)
                      ? "bg-orange text-white border-orange"
                      : "bg-white text-brun border-brun/10 hover:border-orange/40"
                  }`}
                >
                  {t.name}
                </button>
              ))}
              {/* Inactive/deleted teams linked to the recipe — read-only */}
              {recipe.recipe_teams
                ?.filter((rt) => rt.team && !allTeams.some((at) => at.id === rt.team?.id))
                .map((rt) => (
                  <span
                    key={rt.team!.id}
                    className="px-2.5 py-1 text-xs rounded-full border border-brun/10 bg-brun/5 text-brun-light italic"
                    title="Équipe inactive ou inaccessible"
                  >
                    {rt.team!.name}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// =====================================================================
// SECTION 2: IMAGES
// =====================================================================

function ImageSection({
  recipe,
  onPatch,
  onRefresh,
}: {
  recipe: Recipe
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const adminBase = getAdminBase()

  const images = Array.isArray(recipe.images) ? recipe.images : []

  async function handleUploadMulti(files: File[]) {
    if (files.length === 0) return
    setUploading(true)
    try {
      const newImages: ImageObj[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("prefix", "recipes")
        const res = await fetch("/api/upload-image", { method: "POST", body: formData })
        const json = await res.json()
        if (!res.ok) continue
        newImages.push({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          nom: file.name,
          url: json.url,
          ordre: images.length + newImages.length,
          taille: file.size,
        })
      }
      if (newImages.length > 0 && await onPatch({ images: [...images, ...newImages] })) {
        showToast(`${newImages.length} image${newImages.length > 1 ? "s" : ""} ajoutée${newImages.length > 1 ? "s" : ""}`)
        void onRefresh()
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }

  async function removeImage(imgId: string) {
    const next = images.filter((i) => i.id !== imgId).map((img, idx) => ({ ...img, ordre: idx }))
    if (await onPatch({ images: next })) {
      showToast("Image retirée")
      void onRefresh()
    }
  }

  async function moveImage(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return
    const next = [...images]
    const [moved] = next.splice(fromIdx, 1)
    const insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx
    next.splice(insertAt, 0, moved)
    const reordered = next.map((img, idx) => ({ ...img, ordre: idx }))
    if (await onPatch({ images: reordered })) {
      showToast("Ordre mis à jour")
      void onRefresh()
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    // Si on drag une image interne, on ne montre pas la zone de drop fichier
    if (dragIdx !== null) return
    setDragging(true)
  }
  function handleDragLeave() { setDragging(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (dragIdx !== null) return // géré par le drop sur les images
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))
    if (files.length > 0) void handleUploadMulti(files)
  }

  return (
    <div
      className={`bg-white rounded-2xl p-6 shadow-sm transition-colors ${dragging ? "ring-2 ring-orange/40 bg-orange/5" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-brun">Images</h2>
        <span className="text-[10px] text-brun-light">{images.length > 1 ? "Glisser pour réordonner" : ""}</span>
      </div>

      <div className="flex flex-wrap items-start">
        {images.map((img, idx) => {
          const url = img.url.startsWith("http") ? img.url : `${adminBase}${img.url}`
          return (
            <div key={img.id} className="flex items-center">
              {/* Drop indicator before this image */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) setDropTarget(idx) }}
                onDragLeave={() => { if (dropTarget === idx) setDropTarget(null) }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) { void moveImage(dragIdx, idx) } setDragIdx(null); setDropTarget(null) }}
                className={`h-24 transition-all duration-200 ${dropTarget === idx && dragIdx !== null ? "w-4 bg-orange/30 rounded mx-1" : "w-1.5"}`}
              />
              <div
                draggable
                onDragStart={() => setDragIdx(idx)}
                onDragEnd={() => { setDragIdx(null); setDropTarget(null) }}
                className={`relative w-32 h-24 rounded-lg overflow-hidden border group cursor-grab active:cursor-grabbing transition-all ${
                  dragIdx === idx ? "opacity-40 scale-95" : "opacity-100"
                } ${idx === 0 ? "ring-2 ring-vert-eau/40" : "border-brun/10"}`}
              >
                <img src={url} alt={img.nom} className="w-full h-full object-cover" />
                {idx === 0 && (
                  <span className="absolute bottom-1 left-1 text-[8px] bg-vert-eau text-white px-1 py-0.5 rounded">Principale</span>
                )}
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-rose text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </div>
              {/* Drop indicator after last image */}
              {idx === images.length - 1 && (
                <div
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null && dragIdx !== idx) setDropTarget(images.length) }}
                  onDragLeave={() => { if (dropTarget === images.length) setDropTarget(null) }}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); if (dragIdx !== null) { void moveImage(dragIdx, images.length - 1) } setDragIdx(null); setDropTarget(null) }}
                  className={`h-24 transition-all duration-200 ${dropTarget === images.length && dragIdx !== null ? "w-4 bg-orange/30 rounded mx-1" : "w-1.5"}`}
                />
              )}
            </div>
          )
        })}

        {/* Upload zone */}
        <label className="w-32 h-24 rounded-lg border-2 border-dashed border-brun/20 flex flex-col items-center justify-center cursor-pointer hover:border-orange/40 transition-colors">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? [])
              if (files.length > 0) void handleUploadMulti(files)
            }}
          />
          {uploading ? (
            <span className="text-xs text-brun-light">Upload...</span>
          ) : (
            <>
              <svg className="w-6 h-6 text-brun-light/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-[9px] text-brun-light/40 mt-1">Multi-images</span>
            </>
          )}
        </label>
      </div>

      {dragging && dragIdx === null && (
        <p className="text-center text-xs text-orange mt-3 animate-pulse">Déposer les images ici</p>
      )}
    </div>
  )
}

// =====================================================================
// SECTION 3: INGRÉDIENTS
// =====================================================================

function IngredientSection({
  recipe,
  allUnits,
  allAisles,
  allPortionTypes,
  catalogIngredients,
  onPatch,
  onRefresh,
}: {
  recipe: Recipe
  allUnits: UnitRef[]
  allAisles: AisleRef[]
  allPortionTypes: Array<{ id: string; name: string }>
  catalogIngredients: MasterIngredient[]
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [saving, setSaving] = useState(false)

  // Autocomplete state per row
  const [acOpen, setAcOpen] = useState<number | null>(null)
  const [acFilter, setAcFilter] = useState("")

  useEffect(() => {
    setIngredients(
      [...(recipe.ingredients || [])]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((ing) => {
          // Look up available units from catalog if linked
          const cat = ing.ingredient_master_id
            ? catalogIngredients.find((c) => c.id === ing.ingredient_master_id)
            : null
          return {
            ...ing,
            _availableUnitIds: cat?.unit_ids,
            _availableAisleIds: cat?.aisle_ids,
          }
        })
    )
  }, [recipe, catalogIngredients])

  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        quantity: null,
        sort_order: prev.length,
        comment: null,
        ingredient_master_id: null,
        unit: null,
        aisle: null,
        master: null,
      },
    ])
  }

  function updateIngredient(idx: number, updates: Partial<RecipeIngredient>) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, ...updates } : ing))
    )
  }

  function selectFromCatalog(idx: number, master: MasterIngredient) {
    const defaultUnit = allUnits.find((u) => u.id === master.default_unit_id) || null
    const defaultAisle = allAisles.find((a) => a.id === master.default_aisle_id) || null
    updateIngredient(idx, {
      name: master.name,
      ingredient_master_id: master.id,
      master,
      unit: defaultUnit,
      aisle: defaultAisle,
      _availableUnitIds: master.unit_ids,
      _availableAisleIds: master.aisle_ids,
    })
    setAcOpen(null)
    setAcFilter("")
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  // Drag and drop reorder
  function handleDragStart(e: React.DragEvent, idx: number) {
    e.dataTransfer.setData("text/plain", String(idx))
  }

  function handleDrop(e: React.DragEvent, targetIdx: number) {
    e.preventDefault()
    const fromIdx = parseInt(e.dataTransfer.getData("text/plain"))
    if (isNaN(fromIdx) || fromIdx === targetIdx) return
    setIngredients((prev) => {
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
  }

  async function saveIngredients() {
    // Validate before saving
    const named = ingredients.filter((i) => i.name.trim())
    for (const ing of named) {
      if (ing.quantity === null || ing.quantity === undefined) {
        showToast(`"${ing.name}" : la quantité est obligatoire`, "error")
        return
      }
      if (!ing.unit?.id) {
        showToast(`"${ing.name}" : l'unité est obligatoire`, "error")
        return
      }
    }

    setSaving(true)
    const payload = named.map((i, idx) => ({
      name: i.name.trim(),
      quantity: i.quantity,
      unit_id: i.unit?.id || null,
      aisle_id: i.aisle?.id || null,
      ingredient_master_id: i.ingredient_master_id || null,
      comment: i.comment || null,
      sort_order: idx,
    }))
    if (await onPatch({ ingredients: payload })) {
      showToast("Ingrédients enregistrés")
      void onRefresh()
    }
    setSaving(false)
  }

  // Comment toggle per row
  const [commentOpenIdx, setCommentOpenIdx] = useState<Set<number>>(new Set())

  // Auto-open comment rows that already have a comment
  useEffect(() => {
    const withComment = new Set<number>()
    ingredients.forEach((ing, idx) => {
      if (ing.comment) withComment.add(idx)
    })
    setCommentOpenIdx(withComment)
  }, []) // only on mount

  function toggleComment(idx: number) {
    setCommentOpenIdx((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false)

  // Filtered catalog for autocomplete
  const acResults = acFilter.length >= 2
    ? catalogIngredients
        .filter((c) => c.name.toLowerCase().includes(acFilter.toLowerCase()))
        .slice(0, 8)
    : []

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="font-serif text-lg text-brun">Ingrédients pour</h2>
          <input
            type="number"
            min={1}
            value={recipe.serving_count}
            onChange={async (e) => {
              const v = parseInt(e.target.value) || 1
              if (await onPatch({ serving_count: v })) void onRefresh()
            }}
            className="w-14 px-2 py-0.5 text-sm font-semibold rounded border border-brun/10 bg-creme text-brun text-center"
          />
          <select
            value={recipe.portion_type_id || ""}
            onChange={async (e) => {
              if (await onPatch({ portion_type_id: e.target.value || null })) void onRefresh()
            }}
            className="px-2 py-0.5 text-sm rounded border border-brun/10 bg-creme text-brun"
          >
            <option value="">personnes</option>
            {allPortionTypes.map((pt) => (
              <option key={pt.id} value={pt.id}>{pt.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            title="Aperçu de l'affichage"
            className="px-2 py-1 text-xs text-brun-light hover:text-orange transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={addIngredient}
            className="px-3 py-1 text-xs font-medium text-orange bg-orange/10 rounded-lg hover:bg-orange/20 transition-colors"
          >
            + Ajouter
          </button>
          <button
            type="button"
            onClick={saveIngredients}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium text-white bg-orange rounded-lg hover:bg-orange-light transition-colors disabled:opacity-50"
          >
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>

      {ingredients.length === 0 ? (
        <p className="text-xs text-brun-light italic py-4 text-center">
          Aucun ingrédient. Cliquez sur + Ajouter.
        </p>
      ) : (
        <div className="space-y-1">
          {ingredients.map((ing, idx) => {
            const nameEn = ing.master?.name_en
            return (
              <div key={ing.id}>
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, idx)}
                className="grid grid-cols-[auto_24px_3fr_80px_100px_2fr_auto] items-center gap-2 py-1.5 px-2 rounded hover:bg-creme/30 group"
              >
                {/* Drag handle */}
                <svg className="w-3.5 h-3.5 text-brun-light cursor-grab active:cursor-grabbing flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
                  <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
                  <circle cx="9" cy="19" r="1.5" /><circle cx="15" cy="19" r="1.5" />
                </svg>

                {/* Ingredient image: uploaded > TheMealDB > empty */}
                {(() => {
                  const adminBase = getAdminBase()
                  const masterImg = ing.master?.image_url
                  const imgSrc = masterImg
                    ? (masterImg.startsWith("http") ? masterImg : `${adminBase}${masterImg}`)
                    : nameEn
                      ? `https://www.themealdb.com/images/ingredients/${encodeURIComponent(nameEn)}-Small.png`
                      : null
                  return imgSrc ? (
                    <img src={imgSrc} alt="" className="w-6 h-6 object-contain flex-shrink-0 rounded" loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                  ) : (
                    <span className="w-6 h-6 flex-shrink-0" />
                  )
                })()}

                {/* Name with autocomplete */}
                <div className="relative">
                  <input
                    type="text"
                    value={ing.name}
                    onChange={(e) => {
                      updateIngredient(idx, { name: e.target.value, ingredient_master_id: null, master: null })
                      setAcOpen(idx)
                      setAcFilter(e.target.value)
                    }}
                    onFocus={() => { setAcOpen(idx); setAcFilter(ing.name) }}
                    onBlur={() => setTimeout(() => setAcOpen(null), 200)}
                    placeholder="Nom de l'ingrédient"
                    className={INPUT_CLASS + " text-xs"}
                  />
                  {acOpen === idx && acResults.length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white border border-brun/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {acResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={() => selectFromCatalog(idx, c)}
                          className="w-full text-left px-3 py-1.5 text-xs text-brun hover:bg-creme flex items-center gap-2"
                        >
                          {(() => {
                            const aBase = getAdminBase()
                            const iSrc = c.image_url
                              ? (c.image_url.startsWith("http") ? c.image_url : `${aBase}${c.image_url}`)
                              : c.name_en
                                ? `https://www.themealdb.com/images/ingredients/${encodeURIComponent(c.name_en)}-Small.png`
                                : null
                            return iSrc ? (
                              <img src={iSrc} alt="" className="w-5 h-5 object-contain rounded"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
                            ) : null
                          })()}
                          <span>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={ing.quantity ?? ""}
                  onChange={(e) => {
                    const v = e.target.value ? parseFloat(e.target.value) : null
                    updateIngredient(idx, { quantity: v !== null && v < 0 ? 0 : v })
                  }}
                  placeholder="Qté"
                  className={INPUT_CLASS + " text-xs text-center"}
                />

                {/* Unit */}
                <select
                  value={ing.unit?.id || ""}
                  onChange={(e) => {
                    const u = allUnits.find((u) => u.id === e.target.value) || null
                    updateIngredient(idx, { unit: u })
                  }}
                  className={INPUT_CLASS + " text-xs"}
                >
                  <option value="">Unité</option>
                  {(ing._availableUnitIds && ing._availableUnitIds.length > 0
                    ? allUnits.filter((u) => ing._availableUnitIds!.includes(u.id))
                    : allUnits
                  ).map((u) => (
                    <option key={u.id} value={u.id}>{u.abbreviation}</option>
                  ))}
                </select>

                {/* Aisle (rayon) */}
                <select
                  value={ing.aisle?.id || ""}
                  onChange={(e) => {
                    const a = allAisles.find((a) => a.id === e.target.value) || null
                    updateIngredient(idx, { aisle: a })
                  }}
                  className={INPUT_CLASS + " text-xs"}
                >
                  <option value="">Rayon</option>
                  {(ing._availableAisleIds && ing._availableAisleIds.length > 0
                    ? allAisles.filter((a) => ing._availableAisleIds!.includes(a.id))
                    : allAisles
                  ).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>

                {/* Actions: comment toggle + remove */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleComment(idx)}
                    title="Commentaire"
                    className={`transition-colors p-0.5 ${
                      ing.comment || commentOpenIdx.has(idx)
                        ? "text-orange"
                        : "text-brun-light/30 hover:text-orange opacity-0 group-hover:opacity-100"
                    }`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    className="text-brun-light hover:text-rose transition-colors p-0.5 opacity-0 group-hover:opacity-100"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Comment row */}
              {commentOpenIdx.has(idx) && (
                <div className="ml-12 mb-1">
                  <input
                    type="text"
                    value={ing.comment ?? ""}
                    onChange={(e) => updateIngredient(idx, { comment: e.target.value || null })}
                    placeholder="Commentaire (ex: coupé en dés, à température ambiante...)"
                    className={INPUT_CLASS + " text-xs text-brun-light italic"}
                  />
                </div>
              )}
              </div>
            )
          })}
        </div>
      )}

      {/* Preview overlay */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-brun/40 backdrop-blur-sm"
            onClick={() => setPreviewOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6 animate-slide-in">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-lg text-brun">
                Aperçu des ingrédients
              </h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="text-brun-light hover:text-brun"
              >
                ✕
              </button>
            </div>
            <ul className="space-y-1.5">
              {ingredients
                .filter((i) => i.name.trim())
                .map((ing, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-brun">
                    <span className="text-brun-light mt-0.5">•</span>
                    <span>
                      {formatIngredientNatural(
                        ing.name,
                        ing.quantity,
                        ing.unit?.abbreviation,
                        ing.unit?.abbreviation_plural
                      )}
                      {ing.comment && (
                        <span className="text-brun-light italic ml-1">
                          ({ing.comment})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
            </ul>
            {ingredients.filter((i) => i.name.trim()).length === 0 && (
              <p className="text-xs text-brun-light italic text-center py-4">
                Aucun ingrédient
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// =====================================================================
// SECTION 4: ÉTAPES
// =====================================================================

function StepSection({
  recipe,
  onPatch,
  onRefresh,
}: {
  recipe: Recipe
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [steps, setSteps] = useState<RecipeStep[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setSteps(
      [...(recipe.recipe_steps || [])].sort((a, b) => a.sort_order - b.sort_order)
    )
  }, [recipe])

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        sort_order: prev.length,
        title: "",
        text: "",
        image_url: null,
      },
    ])
  }

  function updateStep(idx: number, field: string, value: unknown) {
    setSteps((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    )
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveSteps() {
    setSaving(true)
    const payload = steps.map((s, idx) => ({
      title: s.title,
      text: s.text,
      image_url: s.image_url,
      sort_order: idx,
    }))
    if (await onPatch({ steps: payload })) {
      showToast("Étapes enregistrées")
      void onRefresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-brun">Étapes</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addStep}
            className="px-3 py-1 text-xs font-medium text-orange bg-orange/10 rounded-lg hover:bg-orange/20 transition-colors"
          >
            + Ajouter
          </button>
          <button
            type="button"
            onClick={saveSteps}
            disabled={saving}
            className="px-3 py-1 text-xs font-medium text-white bg-orange rounded-lg hover:bg-orange-light transition-colors disabled:opacity-50"
          >
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>

      {steps.length === 0 ? (
        <p className="text-xs text-brun-light italic py-4 text-center">
          Aucune étape. Cliquez sur + Ajouter.
        </p>
      ) : (
        <div className="space-y-4">
          {steps.map((step, idx) => (
            <div key={step.id} className="bg-creme/50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="w-7 h-7 rounded-full bg-orange text-white flex items-center justify-center text-xs font-semibold">
                  {idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="text-brun-light hover:text-rose transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                type="text"
                value={step.title ?? ""}
                onChange={(e) => updateStep(idx, "title", e.target.value)}
                placeholder="Titre de l'étape (optionnel)"
                className={INPUT_CLASS + " mb-2 text-sm font-medium"}
              />
              <RichTextEditor
                key={step.id}
                value={step.text}
                onChange={(html) => updateStep(idx, "text", html)}
                placeholder="Décrivez cette étape..."
                rows={4}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
