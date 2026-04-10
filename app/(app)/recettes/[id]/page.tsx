"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import { SortableTree, buildTreeFromFlat } from "@/components/SortableTree"
import ConfirmDialog from "@/components/ConfirmDialog"

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 bg-creme rounded-lg border border-brun/10 animate-pulse" />
  ),
})

// ---- Types ----

interface UnitRef { id: string; name: string; abbreviation: string }
interface AisleRef { id: string; name: string; color: string }
interface SeasonRef { id: string; name: string; icon: string }
interface TagRef { id: string; name: string; color: string }
interface TeamRef { id: string; name: string }

interface RecipeIngredient {
  id: string
  name: string
  quantity: number | null
  sort_order: number
  comment: string | null
  unit: UnitRef | null
  aisle: AisleRef | null
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
  is_public: boolean
  images: ImageObj[]
  creator: { id: string; first_name: string; last_name: string } | null
  recipe_teams: Array<{ team: TeamRef | null }>
  recipe_seasons: Array<{ season: SeasonRef | null }>
  recipe_tags: Array<{ tag: TagRef | null }>
  ingredients: RecipeIngredient[]
  recipe_steps: RecipeStep[]
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

function getAdminBase() {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "https://chefmate-admin.zabar.fr"
  }
  return "http://localhost:3000"
}

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
        fetch("/api/teams").then(r => r.json()).then(j => setAllTeams(j.data ?? [])).catch(() => {}),
        fetch("/api/seasons").then(r => r.json()).then(j => setAllSeasons(j.data ?? [])).catch(() => {}),
        fetch("/api/tags").then(r => r.json()).then(j => setAllTags(j.data ?? [])).catch(() => {}),
        fetch("/api/units").then(r => r.json()).then(j => setAllUnits(j.data ?? [])).catch(() => {}),
        fetch("/api/aisles").then(r => r.json()).then(j => setAllAisles(j.data ?? [])).catch(() => {}),
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
      {/* Back link */}
      <button
        onClick={() => router.push("/recettes")}
        className="text-sm text-brun-light hover:text-brun transition-colors flex items-center gap-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Retour aux recettes
      </button>

      {/* Section 1: Infos générales */}
      <InfoSection
        recipe={recipe}
        allTeams={allTeams}
        allSeasons={allSeasons}
        allTags={allTags}
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
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
        onPatch={patchRecipe}
        onRefresh={loadRecipe}
      />

      {/* Section 4: Étapes */}
      <StepSection
        recipe={recipe}
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
}: {
  recipe: Recipe
  allTeams: TeamRef[]
  allSeasons: SeasonRef[]
  allTags: TagRef[]
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
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

  async function toggleTag(tagId: string) {
    const next = new Set(tagIds)
    if (next.has(tagId)) next.delete(tagId)
    else next.add(tagId)
    if (await onPatch({ tag_ids: Array.from(next) })) void onRefresh()
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
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

      {/* Status + portions + public */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs text-brun-light">Statut</label>
          <select
            value={recipe.status}
            onChange={async (e) => {
              if (await onPatch({ status: e.target.value })) void onRefresh()
            }}
            className="filter-select text-xs"
          >
            <option value="brouillon">Brouillon</option>
            <option value="non_publiee">Non publiée</option>
            <option value="publiee">Publiée</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-brun-light">Portions</label>
          <input
            type="number"
            min={1}
            value={recipe.serving_count}
            onChange={async (e) => {
              const v = parseInt(e.target.value) || 1
              if (await onPatch({ serving_count: v })) void onRefresh()
            }}
            className="w-16 px-2 py-1 text-xs rounded border border-brun/10 bg-creme text-brun text-center"
          />
        </div>

        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={recipe.is_public}
            onChange={async (e) => {
              if (await onPatch({ is_public: e.target.checked })) void onRefresh()
            }}
          />
          <span className="text-brun-light">Publique</span>
        </label>
      </div>

      {/* Teams */}
      {allTeams.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Équipes</h3>
          <div className="flex flex-wrap gap-2">
            {allTeams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTeam(t.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  teamIds.has(t.id)
                    ? "bg-orange text-white border-orange"
                    : "bg-white text-brun border-brun/10 hover:border-orange/40"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

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
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
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

      {/* Tags */}
      {allTags.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {allTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors`}
                style={{
                  backgroundColor: tagIds.has(t.id) ? t.color + "20" : "white",
                  color: tagIds.has(t.id) ? t.color : undefined,
                  borderColor: tagIds.has(t.id) ? t.color : undefined,
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
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
  const fileRef = useRef<HTMLInputElement>(null)
  const adminBase = getAdminBase()

  const images = Array.isArray(recipe.images) ? recipe.images : []

  async function handleUpload(file: File) {
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("prefix", "recipes")
      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erreur upload")

      const newImage: ImageObj = {
        id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        nom: file.name,
        url: json.url,
        ordre: images.length,
        taille: file.size,
      }
      if (await onPatch({ images: [...images, newImage] })) {
        showToast("Image ajoutée")
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
    const next = images.filter((i) => i.id !== imgId)
    if (await onPatch({ images: next })) {
      showToast("Image retirée")
      void onRefresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <h2 className="font-serif text-lg text-brun mb-4">Images</h2>

      <div className="flex gap-3 flex-wrap">
        {images.map((img) => (
          <div
            key={img.id}
            className="relative w-32 h-24 rounded-lg overflow-hidden border border-brun/10 group"
          >
            <img
              src={`${adminBase}${img.url}`}
              alt={img.nom}
              className="w-full h-full object-cover"
            />
            <button
              type="button"
              onClick={() => removeImage(img.id)}
              className="absolute top-1 right-1 w-5 h-5 bg-rose text-white rounded-full flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Upload button */}
        {images.length < 5 && (
          <label className="w-32 h-24 rounded-lg border-2 border-dashed border-brun/20 flex items-center justify-center cursor-pointer hover:border-orange/40 transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void handleUpload(f)
              }}
            />
            {uploading ? (
              <span className="text-xs text-brun-light">Upload...</span>
            ) : (
              <svg className="w-6 h-6 text-brun-light/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            )}
          </label>
        )}
      </div>
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
  onPatch,
  onRefresh,
}: {
  recipe: Recipe
  allUnits: UnitRef[]
  allAisles: AisleRef[]
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setIngredients(
      [...(recipe.ingredients || [])].sort((a, b) => a.sort_order - b.sort_order)
    )
  }, [recipe])

  function addIngredient() {
    setIngredients((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        quantity: null,
        sort_order: prev.length,
        comment: null,
        unit: null,
        aisle: null,
      },
    ])
  }

  function updateIngredient(idx: number, field: string, value: unknown) {
    setIngredients((prev) =>
      prev.map((ing, i) => (i === idx ? { ...ing, [field]: value } : ing))
    )
  }

  function removeIngredient(idx: number) {
    setIngredients((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveIngredients() {
    setSaving(true)
    const payload = ingredients
      .filter((i) => i.name.trim())
      .map((i, idx) => ({
        name: i.name.trim(),
        quantity: i.quantity,
        unit_id: i.unit?.id || null,
        aisle_id: i.aisle?.id || null,
        comment: i.comment || null,
        sort_order: idx,
      }))
    if (await onPatch({ ingredients: payload })) {
      showToast("Ingrédients enregistrés")
      void onRefresh()
    }
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif text-lg text-brun">Ingrédients</h2>
        <div className="flex gap-2">
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
        <div className="space-y-2">
          {ingredients.map((ing, idx) => (
            <div key={ing.id} className="grid grid-cols-[1fr_80px_120px_auto] gap-2 items-center">
              <input
                type="text"
                value={ing.name}
                onChange={(e) => updateIngredient(idx, "name", e.target.value)}
                placeholder="Nom de l'ingrédient"
                className={INPUT_CLASS + " text-xs"}
              />
              <input
                type="number"
                step="any"
                value={ing.quantity ?? ""}
                onChange={(e) =>
                  updateIngredient(idx, "quantity", e.target.value ? parseFloat(e.target.value) : null)
                }
                placeholder="Qté"
                className={INPUT_CLASS + " text-xs text-center"}
              />
              <select
                value={ing.unit?.id || ""}
                onChange={(e) => {
                  const u = allUnits.find((u) => u.id === e.target.value) || null
                  updateIngredient(idx, "unit", u)
                }}
                className={INPUT_CLASS + " text-xs"}
              >
                <option value="">Unité</option>
                {allUnits.map((u) => (
                  <option key={u.id} value={u.id}>{u.abbreviation}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => removeIngredient(idx)}
                className="text-brun-light hover:text-rose transition-colors p-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
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
                value={step.title}
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
