"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import SidePanel from "@/components/SidePanel"
import ConfirmDialog from "@/components/ConfirmDialog"

// ----- Types -----

interface AisleRef {
  id: string
  name: string
  color: string
  sort_order: number
  parent_id: string | null
}

interface UnitRef {
  id: string
  name: string
  abbreviation: string
}

interface ConversionRef {
  id: string
  source_unit_id: string
  target_unit_id: string
  conversion_factor: number
  source_unit: UnitRef | null
  target_unit: UnitRef | null
}

interface Ingredient {
  id: string
  name: string
  name_en: string | null
  description: string | null
  image_url: string | null
  default_unit_id: string | null
  default_aisle_id: string | null
  lifecycle_status: string
  default_unit: UnitRef | null
  default_aisle: AisleRef | null
  ingredient_aisles: Array<{ id: string; aisle: AisleRef | null }>
  ingredient_units: Array<{ id: string; unit: UnitRef | null }>
  ingredient_conversions: ConversionRef[]
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

export default function IngredientsPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global") || hasRole("Admin contenu")
  const { showToast } = useToast()

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [aisles, setAisles] = useState<AisleRef[]>([])
  const [units, setUnits] = useState<UnitRef[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")

  // Toggle state for rayon sections
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  // Form panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null)
  const [formName, setFormName] = useState("")
  const [formNameEn, setFormNameEn] = useState("")
  const [formDescription, setFormDescription] = useState("")
  const [formDefaultUnitId, setFormDefaultUnitId] = useState("")
  const [formDefaultAisleId, setFormDefaultAisleId] = useState("")
  const [formAisleIds, setFormAisleIds] = useState<Set<string>>(new Set())
  const [formUnitIds, setFormUnitIds] = useState<Set<string>>(new Set())
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Conversions panel
  const [convPanelOpen, setConvPanelOpen] = useState(false)
  const [convIngredient, setConvIngredient] = useState<Ingredient | null>(null)
  const [convRows, setConvRows] = useState<
    Array<{ source_unit_id: string; target_unit_id: string; conversion_factor: number }>
  >([])
  const [savingConv, setSavingConv] = useState(false)

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingIngredient, setDeletingIngredient] = useState<Ingredient | null>(null)
  const [deleting, setDeleting] = useState(false)

  // ----- Loading -----

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ingRes, aislesRes, unitsRes] = await Promise.all([
        fetch("/api/ingredients"),
        fetch("/api/aisles"),
        fetch("/api/units"),
      ])
      const [ingJson, aislesJson, unitsJson] = await Promise.all([
        ingRes.json(),
        aislesRes.json(),
        unitsRes.json(),
      ])
      setIngredients(ingJson.data ?? [])
      const loadedAisles = aislesJson.data ?? []
      setAisles(loadedAisles)
      setUnits(unitsJson.data ?? [])
      // Start with all rayons collapsed
      setCollapsedIds(new Set(loadedAisles.map((a: AisleRef) => a.id)))
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // ----- Derived: organize by rayons -----

  const searchLower = searchInput.trim().toLowerCase()

  const filteredIngredients = useMemo(() => {
    if (!searchLower) return ingredients
    return ingredients.filter((i) =>
      i.name.toLowerCase().includes(searchLower)
    )
  }, [ingredients, searchLower])

  // Root aisles (parent_id null) sorted
  const rootAisles = useMemo(
    () =>
      aisles
        .filter((a) => a.parent_id === null)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [aisles]
  )

  // Sub-aisles grouped by parent
  const subAislesByParent = useMemo(() => {
    const map = new Map<string, AisleRef[]>()
    for (const a of aisles) {
      if (a.parent_id) {
        const list = map.get(a.parent_id) || []
        list.push(a)
        map.set(a.parent_id, list)
      }
    }
    return map
  }, [aisles])

  // Ingredients grouped by aisle id (an ingredient can appear in multiple)
  const ingredientsByAisle = useMemo(() => {
    const map = new Map<string, Ingredient[]>()
    for (const ing of filteredIngredients) {
      const aisleIds =
        ing.ingredient_aisles?.map((ia) => ia.aisle?.id).filter(Boolean) ?? []
      if (aisleIds.length === 0) {
        // No aisle — put in "unclassified"
        const list = map.get("__none__") || []
        list.push(ing)
        map.set("__none__", list)
      } else {
        for (const aid of aisleIds) {
          const list = map.get(aid!) || []
          list.push(ing)
          map.set(aid!, list)
        }
      }
    }
    return map
  }, [filteredIngredients])

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ----- CRUD -----

  function openCreate(preselectedAisleId?: string) {
    setEditingIngredient(null)
    setFormName("")
    setFormNameEn("")
    setFormDescription("")
    setFormDefaultUnitId("")
    setFormDefaultAisleId(preselectedAisleId || "")
    setFormAisleIds(preselectedAisleId ? new Set([preselectedAisleId]) : new Set())
    setFormUnitIds(new Set())
    setFormImageUrl(null)
    setFormError(null)
    setPanelOpen(true)
  }

  function openEdit(ing: Ingredient) {
    setEditingIngredient(ing)
    setFormName(ing.name)
    setFormNameEn(ing.name_en || "")
    setFormDescription(ing.description || "")
    setFormDefaultUnitId(ing.default_unit_id || "")
    setFormDefaultAisleId(ing.default_aisle_id || "")
    setFormImageUrl(ing.image_url || null)
    setFormAisleIds(
      new Set(
        ing.ingredient_aisles?.map((ia) => ia.aisle?.id).filter(Boolean) as string[]
      )
    )
    setFormUnitIds(
      new Set(
        ing.ingredient_units?.map((iu) => iu.unit?.id).filter(Boolean) as string[]
      )
    )
    setFormError(null)
    setPanelOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    if (!formName.trim()) {
      setFormError("Le nom est obligatoire")
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        name: formName.trim(),
        name_en: formNameEn.trim() || null,
        description: formDescription.trim() || null,
        image_url: formImageUrl || null,
        default_unit_id: formDefaultUnitId || null,
        default_aisle_id: formDefaultAisleId || null,
        aisle_ids: Array.from(formAisleIds),
        unit_ids: Array.from(formUnitIds),
      }

      if (editingIngredient) {
        const res = await fetch(`/api/ingredients/${editingIngredient.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formName.trim()}" mis à jour.`)
      } else {
        const res = await fetch("/api/ingredients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formName.trim()}" créé.`)
      }
      setPanelOpen(false)
      void loadData()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingIngredient) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/ingredients/${deletingIngredient.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      showToast(`"${deletingIngredient.name}" supprimé.`)
      setDeleteConfirmOpen(false)
      setDeletingIngredient(null)
      void loadData()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setDeleting(false)
    }
  }

  // ----- Conversions -----

  function openConversions(ing: Ingredient) {
    setConvIngredient(ing)
    setConvRows(
      (ing.ingredient_conversions || []).map((c) => ({
        source_unit_id: c.source_unit_id,
        target_unit_id: c.target_unit_id,
        conversion_factor: c.conversion_factor,
      }))
    )
    setConvPanelOpen(true)
  }

  function addConvRow() {
    setConvRows((prev) => [
      ...prev,
      { source_unit_id: "", target_unit_id: "", conversion_factor: 1 },
    ])
  }

  function removeConvRow(idx: number) {
    setConvRows((prev) => prev.filter((_, i) => i !== idx))
  }

  async function saveConversions() {
    if (!convIngredient) return
    setSavingConv(true)
    try {
      const validRows = convRows.filter(
        (r) => r.source_unit_id && r.target_unit_id && r.conversion_factor > 0
      )
      const res = await fetch(`/api/ingredients/${convIngredient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversions: validRows }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur")
      showToast("Conversions enregistrées.")
      setConvPanelOpen(false)
      void loadData()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setSavingConv(false)
    }
  }

  // ----- Render helpers -----

  function renderIngredientRow(ing: Ingredient) {
    return (
      <div
        key={ing.id}
        className="flex items-center gap-3 py-1.5 px-3 rounded hover:bg-creme/50 group"
      >
        {(() => {
          const adminBase = typeof window !== "undefined" && window.location.hostname !== "localhost"
            ? "https://chefmate-admin.zabar.fr" : "http://localhost:3000"
          const imgSrc = ing.image_url
            ? (ing.image_url.startsWith("http") ? ing.image_url : `${adminBase}${ing.image_url}`)
            : ing.name_en
              ? `https://www.themealdb.com/images/ingredients/${encodeURIComponent(ing.name_en)}-Small.png`
              : null
          return imgSrc ? (
            <img
              src={imgSrc}
              alt=""
              className="w-6 h-6 object-contain flex-shrink-0 rounded"
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          ) : (
            <span className="w-6 h-6 flex-shrink-0" />
          )
        })()}
        <span className="text-sm text-brun flex-1">{ing.name}</span>
        {ing.default_unit && (
          <span className="text-[10px] text-brun-light bg-creme px-1.5 py-0.5 rounded">
            {ing.default_unit.abbreviation}
          </span>
        )}
        {/* Conversion button — visible when 2+ units linked */}
        {canWrite &&
          (ing.ingredient_units?.length ?? 0) >= 2 && (
            <button
              type="button"
              onClick={() => openConversions(ing)}
              title="Conversions d'unités"
              className="text-brun-light/40 hover:text-orange transition-colors p-0.5"
            >
              {/* Scale / balance icon */}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1.5M12 19.5V21M3 12h1.5M19.5 12H21M5.636 5.636l1.06 1.06M17.303 17.303l1.06 1.06M5.636 18.364l1.06-1.06M17.303 6.697l1.06-1.06" />
                <circle cx="12" cy="12" r="4" />
              </svg>
            </button>
          )}
        {canWrite && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => openEdit(ing)}
              title="Modifier"
              className="text-brun-light hover:text-orange transition-colors p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setDeletingIngredient(ing)
                setDeleteConfirmOpen(true)
              }}
              title="Supprimer"
              className="text-brun-light hover:text-rose transition-colors p-0.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        )}
      </div>
    )
  }

  function renderAisleSection(aisle: AisleRef, depth: number) {
    const subs = subAislesByParent.get(aisle.id) || []
    const ingsHere = ingredientsByAisle.get(aisle.id) || []
    const isCollapsed = collapsedIds.has(aisle.id)
    const hasSubs = subs.length > 0
    const hasIngs = ingsHere.length > 0
    const totalCount =
      ingsHere.length +
      subs.reduce(
        (acc, s) => acc + (ingredientsByAisle.get(s.id)?.length ?? 0),
        0
      )

    // In search mode, skip empty sections
    if (searchLower && totalCount === 0 && !hasIngs) return null

    return (
      <div key={aisle.id} className={depth > 0 ? "ml-4" : ""}>
        <div
          className={`flex items-center gap-2 py-2 px-3 rounded cursor-pointer select-none ${
            depth === 0
              ? "bg-creme/60 hover:bg-creme font-semibold"
              : "bg-creme/30 hover:bg-creme/50"
          }`}
          onClick={() => toggleCollapse(aisle.id)}
        >
          {/* Toggle chevron */}
          <svg
            className={`w-3.5 h-3.5 text-brun-light transition-transform flex-shrink-0 ${
              isCollapsed && !searchLower ? "" : "rotate-90"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span
            className="w-3 h-3 rounded-full flex-shrink-0 border border-brun/10"
            style={{ backgroundColor: aisle.color || "#ccc" }}
          />
          <span className={`text-sm flex-1 ${depth === 0 ? "text-brun" : "text-brun-light"}`}>
            {aisle.name}
          </span>
          <span className="text-[10px] text-brun-light">
            {totalCount}
          </span>
          {canWrite && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                openCreate(aisle.id)
              }}
              className="px-2 py-0.5 text-[10px] font-medium rounded bg-orange/10 text-orange hover:bg-orange/20 transition-colors"
            >
              + Ajouter
            </button>
          )}
        </div>

        {(!isCollapsed || searchLower) && (
          <div className="ml-2">
            {/* Ingredients directly in this aisle */}
            {ingsHere
              .sort((a, b) => a.name.localeCompare(b.name))
              .map(renderIngredientRow)}

            {/* Sub-aisles */}
            {subs
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((sub) => renderAisleSection(sub, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  // ----- Main render -----

  const isCreation = !editingIngredient
  const unclassified = ingredientsByAisle.get("__none__") || []

  const footer = (
    <>
      <button
        type="button"
        onClick={() => setPanelOpen(false)}
        disabled={saving}
        className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !formName.trim()}
        className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Enregistrement..." : isCreation ? "Créer" : "Enregistrer"}
      </button>
    </>
  )

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Ingrédients</h1>
          <p className="text-sm text-brun-light mt-1">
            Catalogue des ingrédients organisé par rayons
          </p>
        </div>
        {canWrite && (
          <button
            onClick={() => openCreate()}
            className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
          >
            + Ajouter
          </button>
        )}
      </header>

      {/* Search */}
      <div className="mb-6 relative max-w-md">
        <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-brun-light pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
        </svg>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Rechercher un ingrédient..."
          className="w-full pl-9 pr-9 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
        />
        {searchInput && (
          <button type="button" onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-brun-light hover:text-brun text-sm px-1">
            ✕
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-brun-light italic">Chargement...</p>}

      {!loading && (
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-1">
          {rootAisles.map((aisle) => renderAisleSection(aisle, 0))}

          {/* Unclassified ingredients */}
          {unclassified.length > 0 && (
            <div>
              <div
                className="flex items-center gap-2 py-2 px-3 rounded cursor-pointer select-none bg-creme/30 hover:bg-creme/50"
                onClick={() => toggleCollapse("__none__")}
              >
                <svg
                  className={`w-3.5 h-3.5 text-brun-light transition-transform flex-shrink-0 ${
                    collapsedIds.has("__none__") && !searchLower ? "" : "rotate-90"
                  }`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="text-sm text-brun-light italic flex-1">
                  Sans rayon
                </span>
                <span className="text-[10px] text-brun-light">
                  {unclassified.length}
                </span>
              </div>
              {(!collapsedIds.has("__none__") || searchLower) && (
                <div className="ml-2">
                  {unclassified
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map(renderIngredientRow)}
                </div>
              )}
            </div>
          )}

          {filteredIngredients.length === 0 && (
            <p className="text-center text-brun-light text-sm py-8">
              Aucun ingrédient
            </p>
          )}
        </div>
      )}

      {/* Create/Edit Panel */}
      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={isCreation ? "Nouvel ingrédient" : "Modifier l'ingrédient"}
        subtitle="Ingrédients"
        footer={footer}
        width="md"
      >
        <div className="space-y-5">
          {formError && (
            <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brun mb-1">Nom *</label>
            <input type="text" value={formName} onChange={(e) => setFormName(e.target.value)} className={INPUT_CLASS} autoFocus />
          </div>

          {/* Image */}
          <div>
            <label className="block text-sm font-medium text-brun mb-2">Image</label>
            {(() => {
              const adminBase = typeof window !== "undefined" && window.location.hostname !== "localhost"
                ? "https://chefmate-admin.zabar.fr" : "http://localhost:3000"
              const displayUrl = formImageUrl
                ? (formImageUrl.startsWith("http") ? formImageUrl : `${adminBase}${formImageUrl}`)
                : formNameEn
                  ? `https://www.themealdb.com/images/ingredients/${encodeURIComponent(formNameEn.trim())}-Small.png`
                  : null

              return (
                <div className="flex items-start gap-3">
                  {/* Preview */}
                  <div className="w-16 h-16 rounded-lg border border-brun/10 bg-white flex items-center justify-center overflow-hidden shrink-0">
                    {displayUrl ? (
                      <img
                        src={displayUrl}
                        alt=""
                        className="w-full h-full object-contain p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
                      />
                    ) : (
                      <svg className="w-6 h-6 text-brun-light/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    {/* Upload button */}
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1.5 text-xs bg-orange text-white rounded-lg hover:bg-orange-light transition-colors cursor-pointer">
                        {uploading ? "Upload..." : "Uploader une image"}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            setUploading(true)
                            try {
                              const formData = new FormData()
                              formData.append("file", file)
                              formData.append("prefix", "ingredients")
                              const res = await fetch("/api/upload-image", { method: "POST", body: formData })
                              const json = await res.json()
                              const url = json.data?.url ?? json.url
                              if (url) {
                                setFormImageUrl(url)
                                showToast("Image uploadée")
                              }
                            } catch {
                              showToast("Erreur upload", "error")
                            } finally {
                              setUploading(false)
                              e.target.value = ""
                            }
                          }}
                        />
                      </label>
                      {formImageUrl && (
                        <button
                          type="button"
                          onClick={() => setFormImageUrl(null)}
                          className="text-xs text-rose hover:text-rose/80 transition-colors"
                        >
                          Retirer
                        </button>
                      )}
                    </div>

                    {/* Source info */}
                    <p className="text-[10px] text-brun-light">
                      {formImageUrl
                        ? "Image uploadée"
                        : formNameEn
                          ? "Image TheMealDB (via nom anglais)"
                          : "Aucune image"}
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>

          <div>
            <label className="block text-sm font-medium text-brun mb-1">
              Nom anglais
              <span className="font-normal text-brun-light ml-1">(fallback TheMealDB)</span>
            </label>
            <input
              type="text"
              value={formNameEn}
              onChange={(e) => setFormNameEn(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Tomato, Onion, Carrot..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brun mb-1">Description</label>
            <textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} rows={2} className={INPUT_CLASS} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brun mb-1">Unité par défaut</label>
              <select value={formDefaultUnitId} onChange={(e) => setFormDefaultUnitId(e.target.value)} className={INPUT_CLASS}>
                <option value="">Aucune</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brun mb-1">Rayon par défaut</label>
              <select value={formDefaultAisleId} onChange={(e) => setFormDefaultAisleId(e.target.value)} className={INPUT_CLASS}>
                <option value="">Aucun</option>
                {rootAisles.map((root) => {
                  const subs = (subAislesByParent.get(root.id) || []).sort(
                    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
                  )
                  if (subs.length === 0) {
                    return (
                      <option key={root.id} value={root.id}>
                        {root.name}
                      </option>
                    )
                  }
                  return (
                    <optgroup key={root.id} label={root.name}>
                      <option value={root.id}>{root.name} (racine)</option>
                      {subs.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  )
                })}
              </select>
            </div>
          </div>

          {/* Multi-rayon checkboxes */}
          <div className="border-t border-brun/10 pt-4">
            <label className="block text-sm font-medium text-brun mb-2">Rayons</label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {rootAisles.map((root) => {
                const subs = subAislesByParent.get(root.id) || []
                return (
                  <div key={root.id}>
                    <label className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                      <input
                        type="checkbox"
                        checked={formAisleIds.has(root.id)}
                        onChange={() => {
                          setFormAisleIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(root.id)) next.delete(root.id)
                            else next.add(root.id)
                            return next
                          })
                        }}
                      />
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: root.color }}
                      />
                      <span className="font-medium">{root.name}</span>
                    </label>
                    {subs.map((sub) => (
                      <label key={sub.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5 ml-5">
                        <input
                          type="checkbox"
                          checked={formAisleIds.has(sub.id)}
                          onChange={() => {
                            setFormAisleIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(sub.id)) next.delete(sub.id)
                              else next.add(sub.id)
                              return next
                            })
                          }}
                        />
                        <span className="text-brun-light">{sub.name}</span>
                      </label>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Multi-unit checkboxes */}
          <div className="border-t border-brun/10 pt-4">
            <label className="block text-sm font-medium text-brun mb-2">Unités possibles</label>
            <div className="flex flex-wrap gap-3">
              {units.map((u) => (
                <label key={u.id} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formUnitIds.has(u.id)}
                    onChange={() => {
                      setFormUnitIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(u.id)) next.delete(u.id)
                        else next.add(u.id)
                        return next
                      })
                    }}
                  />
                  <span>{u.abbreviation}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer l'ingrédient"
        message={`Êtes-vous sûr de vouloir supprimer "${deletingIngredient?.name}" ? L'ingrédient sera masqué mais conservé en base.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteConfirmOpen(false); setDeletingIngredient(null) }}
      />

      {/* Conversions Panel */}
      <SidePanel
        open={convPanelOpen}
        onClose={() => setConvPanelOpen(false)}
        title={convIngredient ? `Conversions — ${convIngredient.name}` : "Conversions"}
        subtitle="Équivalences entre unités"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConvPanelOpen(false)}
              disabled={savingConv}
              className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveConversions}
              disabled={savingConv}
              className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
            >
              {savingConv ? "Enregistrement..." : "Enregistrer"}
            </button>
          </>
        }
        width="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-brun-light">
            Définissez les équivalences entre les unités liées à cet
            ingrédient. Ex : 1 c.c. = 5 g.
          </p>

          {convRows.length === 0 && (
            <p className="text-xs text-brun-light italic py-4 text-center">
              Aucune conversion définie.
            </p>
          )}

          {convRows.map((row, idx) => {
            const ingUnits =
              convIngredient?.ingredient_units
                ?.map((iu) => iu.unit)
                .filter(Boolean) ?? []
            return (
              <div
                key={idx}
                className="bg-creme rounded-lg p-3"
              >
                <div className="grid grid-cols-[1fr_auto_auto_1fr_auto] items-center gap-2">
                  <select
                    value={row.source_unit_id}
                    onChange={(e) =>
                      setConvRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? { ...r, source_unit_id: e.target.value }
                            : r
                        )
                      )
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Source</option>
                    {ingUnits.map((u) => (
                      <option key={u!.id} value={u!.id}>
                        {u!.abbreviation}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-brun-light">=</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={row.conversion_factor}
                    onChange={(e) =>
                      setConvRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? {
                                ...r,
                                conversion_factor:
                                  parseFloat(e.target.value) || 0,
                              }
                            : r
                        )
                      )
                    }
                    className={INPUT_CLASS + " w-24 text-center"}
                  />
                  <select
                    value={row.target_unit_id}
                    onChange={(e) =>
                      setConvRows((prev) =>
                        prev.map((r, i) =>
                          i === idx
                            ? { ...r, target_unit_id: e.target.value }
                            : r
                        )
                      )
                    }
                    className={INPUT_CLASS}
                  >
                    <option value="">Cible</option>
                    {ingUnits.map((u) => (
                      <option key={u!.id} value={u!.id}>
                        {u!.abbreviation}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeConvRow(idx)}
                    className="text-brun-light hover:text-rose transition-colors p-1"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.75}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}

          <button
            type="button"
            onClick={addConvRow}
            className="text-xs text-orange hover:text-orange-light font-medium transition-colors"
          >
            + Ajouter une conversion
          </button>
        </div>
      </SidePanel>
    </div>
  )
}
