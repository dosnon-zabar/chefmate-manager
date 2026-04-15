"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import ConfirmDialog from "@/components/ConfirmDialog"
import SeoBlock from "@/components/SeoBlock"
import { generateShoppingListPdf } from "@/components/EventShoppingListPdf"
import { formatIngredientNatural } from "@/lib/format-ingredient"

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 bg-creme rounded-lg border border-brun/10 animate-pulse" />
  ),
})

// ---- Types ----

interface TeamRef { id: string; name: string }
interface UnitRef { id: string; name: string; abbreviation: string; abbreviation_plural?: string | null }
interface AisleRef { id: string; name: string; color: string; parent_id?: string | null; sort_order?: number }

interface EventDate {
  id: string
  start_datetime: string
  duration_minutes: number | null
  guest_count: number
  location: string | null
  reservation_open: boolean
  reservation_url: string | null
  sort_order: number
}

interface EventRecipe {
  id: string
  serving_count: number
  recette: {
    id: string
    name: string
    serving_count: number
    ingredients?: Array<{
      name: string
      quantity: number | null
      ingredient_master_id: string | null
      unite: UnitRef | null
      rayon: AisleRef | null
    }>
  } | null
}

interface EventIngredient {
  id: string
  name: string
  quantity: number
  unite: UnitRef | null
  rayon: AisleRef | null
}

interface EventImage {
  id: string
  image_type: "cover" | "report"
  image_url: string
  caption: string | null
  copyright: string | null
  sort_order: number
}

interface EventTestimonial {
  id: string
  author_name: string
  author_role: string | null
  text: string
  sort_order: number
}

interface EventStep {
  id: string
  title: string | null
  text: string | null
  image_url: string | null
  sort_order: number
}

interface Event {
  id: string
  name: string
  slug: string | null
  description: string | null
  event_date: string | null
  guest_count: number
  presentation_text: string | null
  report_text: string | null
  report_title: string | null
  notes: string | null
  seo_title: string | null
  seo_desc: string | null
  seo_image: string | null
  steps_title: string | null
  steps_text: string | null
  team_id: string | null
  team: TeamRef | null
  status: string
  event_recipes: EventRecipe[]
  event_ingredients: EventIngredient[]
  event_images: EventImage[]
  event_testimonials: EventTestimonial[]
  event_steps: EventStep[]
  event_dates: EventDate[]
  created_at: string
  updated_at: string
}

interface RecipeOption {
  id: string
  name: string
  serving_count: number
  portion_type_name: string | null
}

function getAdminBase() {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return "https://chefmate-admin.zabar.fr"
  }
  return "http://localhost:3000"
}

function toDatetimeLocal(iso: string): string {
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch {
    return ""
  }
}

// =====================================================================
// MAIN PAGE
// =====================================================================

export default function EventEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { showToast } = useToast()

  const [event, setEvent] = useState<Event | null>(null)
  const [loading, setLoading] = useState(true)

  // Reference data
  const [allTeams, setAllTeams] = useState<TeamRef[]>([])
  const [allUnits, setAllUnits] = useState<UnitRef[]>([])
  const [allAisles, setAllAisles] = useState<AisleRef[]>([])
  const [allRecipes, setAllRecipes] = useState<RecipeOption[]>([])
  interface IngredientConversion { source_unit_id: string; target_unit_id: string; conversion_factor: number }
  interface CatalogIngredient {
    id: string; name: string
    default_unit_id: string | null; default_aisle_id: string | null
    unit_ids: string[]; aisle_ids: string[]
    conversions: IngredientConversion[]
  }
  const [catalogIngredients, setCatalogIngredients] = useState<CatalogIngredient[]>([])

  // Tabs
  const [activeTab, setActiveTab] = useState<"infos" | "recettes" | "organisation" | "compte-rendu" | "parcours" | "temoignages">("infos")

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ---- Load ----

  const loadEvent = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}`)
      const json = await res.json()
      if (json.data) setEvent(json.data)
    } catch { /* silent */ }
  }, [id])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        loadEvent(),
        fetch("/api/teams?status=active").then(r => r.json()).then(j => setAllTeams(j.data ?? [])).catch(() => {}),
        fetch("/api/units").then(r => r.json()).then(j => setAllUnits(j.data ?? [])).catch(() => {}),
        fetch("/api/aisles").then(r => r.json()).then(j => setAllAisles(j.data ?? [])).catch(() => {}),
        fetch("/api/recipes?limit=500").then(r => r.json()).then(j =>
          setAllRecipes((j.data ?? []).map((r: any) => ({ id: r.id, name: r.name, serving_count: r.serving_count ?? 1, portion_type_name: r.portion_type?.name ?? null })))
        ).catch(() => {}),
        fetch("/api/ingredients?limit=500").then(r => r.json()).then(j =>
          setCatalogIngredients((j.data ?? []).map((i: any) => ({
            id: i.id, name: i.name,
            default_unit_id: i.default_unit_id, default_aisle_id: i.default_aisle_id,
            unit_ids: ((i.ingredient_units as Array<{ unit: { id: string } | null }>) ?? []).map((iu) => iu.unit?.id).filter(Boolean) as string[],
            aisle_ids: ((i.ingredient_aisles as Array<{ aisle: { id: string } | null }>) ?? []).map((ia) => ia.aisle?.id).filter(Boolean) as string[],
            conversions: ((i.ingredient_conversions ?? []) as Array<{ source_unit_id: string; target_unit_id: string; conversion_factor: number }>)
              .map((c) => ({ source_unit_id: c.source_unit_id, target_unit_id: c.target_unit_id, conversion_factor: c.conversion_factor })),
          })))
        ).catch(() => {}),
      ])
      setLoading(false)
    }
    void init()
  }, [loadEvent])

  // ---- Patch helper ----

  async function patchEvent(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/events/${id}`, {
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
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Erreur")
      showToast("Événement supprimé.")
      router.push("/evenements")
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

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-brun-light">Événement non trouvé</p>
        <button
          onClick={() => router.push("/evenements")}
          className="mt-4 text-orange text-sm hover:text-orange-light"
        >
          Retour à la liste
        </button>
      </div>
    )
  }

  const TABS = [
    { key: "infos" as const, label: "Infos générales" },
    { key: "recettes" as const, label: "Recettes & Ingrédients" },
    { key: "organisation" as const, label: "Liste des ingrédients" },
    { key: "compte-rendu" as const, label: "Compte rendu" },
    { key: "parcours" as const, label: "Parcours" },
    { key: "temoignages" as const, label: "Témoignages" },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header: back + title */}
      <div>
        <button
          onClick={() => router.push("/evenements")}
          className="text-sm text-brun-light hover:text-brun transition-colors flex items-center gap-1 mb-3"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour aux événements
        </button>
        <h1 className="font-serif text-3xl text-brun">{event.name}</h1>
      </div>

      {/* Tabs */}
      <div className="border-b border-brun/10">
        <nav className="flex gap-0 -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "border-orange text-orange"
                  : "border-transparent text-brun-light hover:text-brun hover:border-brun/20"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "infos" && (
        <InfoSection
          event={event}
          allTeams={allTeams}
          onPatch={patchEvent}
          onRefresh={loadEvent}
        />
      )}

      {activeTab === "recettes" && (
        <RecipesSection
          event={event}
          allRecipes={allRecipes}
          allUnits={allUnits}
          allAisles={allAisles}
          catalogIngredients={catalogIngredients}
          onPatch={patchEvent}
          onRefresh={loadEvent}
        />
      )}

      {activeTab === "organisation" && (
        <OrganisationSection event={event} allAisles={allAisles} allUnits={allUnits} catalogIngredients={catalogIngredients} />
      )}

      {activeTab === "compte-rendu" && (
        <ReportSection
          event={event}
          onPatch={patchEvent}
          onRefresh={loadEvent}
        />
      )}

      {activeTab === "parcours" && (
        <StepsSection
          event={event}
          onPatch={patchEvent}
          onRefresh={loadEvent}
        />
      )}

      {activeTab === "temoignages" && (
        <TestimonialsSection
          event={event}
          onPatch={patchEvent}
          onRefresh={loadEvent}
        />
      )}

      {/* SEO & Partage */}
      <SeoBlock
        seoTitle={event.seo_title}
        seoDesc={event.seo_desc}
        seoImage={event.seo_image}
        onPatch={patchEvent}
        onRefresh={loadEvent}
      />

      {/* Danger zone — always visible below tab content */}
      <div className="bg-white rounded-2xl p-6 border border-rose/20">
        <h2 className="text-sm font-semibold text-rose mb-2">Zone danger</h2>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="px-4 py-2 text-sm text-rose border border-rose/30 rounded-lg hover:bg-rose/10 transition-colors"
        >
          Supprimer cet événement
        </button>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer l'événement"
        message={`Êtes-vous sûr de vouloir supprimer "${event.name}" ?`}
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
  event,
  allTeams,
  onPatch,
  onRefresh,
}: {
  event: Event
  allTeams: TeamRef[]
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const [name, setName] = useState(event.name)
  const [guestCount, setGuestCount] = useState(String(event.guest_count || ""))
  const [description, setDescription] = useState(event.description ?? "")
  const [dates, setDates] = useState<EventDate[]>(event.event_dates ?? [])
  const [presentationText, setPresentationText] = useState(event.presentation_text ?? "")
  const { showToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  // Sync dates from event prop
  useEffect(() => { setDates(event.event_dates ?? []) }, [event.event_dates])

  const coverImages = useMemo(
    () => (event.event_images ?? []).filter((img) => img.image_type === "cover").sort((a, b) => a.sort_order - b.sort_order),
    [event.event_images]
  )

  async function saveName() {
    if (name.trim() && name.trim() !== event.name) {
      if (await onPatch({ name: name.trim() })) {
        showToast("Nom enregistré")
        void onRefresh()
      }
    }
  }

  async function saveDescription(html?: string) {
    const val = html ?? description
    if (val !== (event.description ?? "")) {
      if (await onPatch({ description: val || null })) void onRefresh()
    }
  }

  async function savePresentationText(html: string) {
    if (html !== (event.presentation_text ?? "")) {
      if (await onPatch({ presentation_text: html || null })) void onRefresh()
    }
  }

  // ---- Dates ----

  function addDate() {
    setDates([...dates, {
      id: `temp-${Date.now()}`,
      start_datetime: new Date().toISOString(),
      duration_minutes: null,
      guest_count: 0,
      location: null,
      reservation_open: false,
      reservation_url: null,
      sort_order: dates.length,
    }])
  }

  function updateDate(index: number, field: string, value: unknown) {
    setDates(dates.map((d, i) => i === index ? { ...d, [field]: value } : d))
  }

  function removeDate(index: number) {
    setDates(dates.filter((_, i) => i !== index))
  }

  async function saveDates() {
    const payload = dates.map((d, i) => ({
      start_datetime: d.start_datetime,
      duration_minutes: d.duration_minutes,
      guest_count: d.guest_count,
      location: d.location,
      reservation_open: d.reservation_open,
      reservation_url: d.reservation_url,
      sort_order: i,
    }))
    if (await onPatch({ dates: payload })) {
      showToast("Dates enregistrées")
      void onRefresh()
    }
  }

  // ---- Cover images ----

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    await uploadCoverFiles(files)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function removeCoverImage(imageUrl: string) {
    const allImages = [
      ...coverImages.filter((img) => img.image_url !== imageUrl).map((img, i) => ({
        image_type: "cover" as const, image_url: img.image_url,
        caption: img.caption, copyright: img.copyright, sort_order: i,
      })),
      ...(event.event_images ?? []).filter((img) => img.image_type === "report").map((img) => ({
        image_type: "report" as const, image_url: img.image_url,
        caption: img.caption, copyright: img.copyright, sort_order: img.sort_order,
      })),
    ]
    if (await onPatch({ images: allImages })) {
      showToast("Image retirée")
      void onRefresh()
    }
  }

  // ---- Cover image caption/copyright ----

  async function updateCoverImageMeta(imageUrl: string, field: "caption" | "copyright", value: string) {
    const allImages = [
      ...coverImages.map((img) => ({
        image_type: "cover" as const, image_url: img.image_url,
        caption: img.image_url === imageUrl && field === "caption" ? (value || null) : img.caption,
        copyright: img.image_url === imageUrl && field === "copyright" ? (value || null) : img.copyright,
        sort_order: img.sort_order,
      })),
      ...(event.event_images ?? []).filter((img) => img.image_type === "report").map((img) => ({
        image_type: "report" as const, image_url: img.image_url,
        caption: img.caption, copyright: img.copyright, sort_order: img.sort_order,
      })),
    ]
    if (await onPatch({ images: allImages })) void onRefresh()
  }

  // ---- Drag & drop upload ----

  const [dragging, setDragging] = useState(false)

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
    if (files.length === 0) return
    await uploadCoverFiles(files)
  }

  async function uploadCoverFiles(files: File[]) {
    setUploading(true)
    try {
      // Upload files sequentially to avoid overwhelming the server
      const newUrls: string[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("prefix", "events")
        const res = await fetch("/api/upload-image", { method: "POST", body: formData })
        const json = await res.json()
        const url = json.data?.url ?? json.url
        if (url) {
          newUrls.push(url)
        } else {
          console.error("Upload failed for", file.name, json)
        }
      }
      if (newUrls.length === 0) throw new Error("Aucun upload n'a réussi")

      const allImages = [
        ...coverImages.map((img) => ({
          image_type: "cover" as const, image_url: img.image_url,
          caption: img.caption, copyright: img.copyright, sort_order: img.sort_order,
        })),
        ...newUrls.map((url, i) => ({
          image_type: "cover" as const, image_url: url,
          caption: null, copyright: null, sort_order: coverImages.length + i,
        })),
        ...(event.event_images ?? []).filter((img) => img.image_type === "report").map((img) => ({
          image_type: "report" as const, image_url: img.image_url,
          caption: img.caption, copyright: img.copyright, sort_order: img.sort_order,
        })),
      ]
      if (await onPatch({ images: allImages })) {
        showToast(`${newUrls.length} image${newUrls.length > 1 ? "s" : ""} ajoutée${newUrls.length > 1 ? "s" : ""}`)
        void onRefresh()
      }
    } catch {
      showToast("Erreur lors de l'upload", "error")
    } finally {
      setUploading(false)
    }
  }

  const adminBase = getAdminBase()

  return (
    <div className="space-y-4">
      {/* Bloc 1: Infos + Publication (2/3 + 1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left 2/3 — Infos */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm space-y-4">
          {/* Name */}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === "Enter" && saveName()}
            className="font-serif text-2xl text-brun bg-transparent border-0 focus:outline-none focus:ring-0 w-full placeholder:text-brun-light/40"
            placeholder="Nom de l'événement"
          />

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Description</label>
            <RichTextEditor
              value={description}
              onChange={(html) => { setDescription(html); saveDescription(html) }}
            />
          </div>

          {/* Guest count */}
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Nombre de convives</label>
            <input
              type="number"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              onBlur={async () => {
                const v = parseInt(guestCount) || 0
                if (v !== event.guest_count) {
                  if (await onPatch({ guest_count: v })) void onRefresh()
                }
              }}
              className="w-40 px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
              min="0"
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
              value={event.status}
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

          {/* Team */}
          <div>
            <label className="text-xs text-brun-light mb-1 block">Équipe</label>
            <select
              value={event.team_id ?? ""}
              onChange={async (e) => {
                if (await onPatch({ team_id: e.target.value || null })) void onRefresh()
              }}
              className="w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
            >
              <option value="">Aucune équipe</option>
              {allTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Bloc 2: Dates */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide">Dates</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addDate}
              className="text-xs text-orange hover:text-orange-light transition-colors"
            >
              + Ajouter une date
            </button>
            {dates.length > 0 && (
              <button
                type="button"
                onClick={saveDates}
                className="text-xs px-2 py-0.5 bg-orange text-white rounded hover:bg-orange-light transition-colors"
              >
                Enregistrer
              </button>
            )}
          </div>
        </div>

        {dates.length === 0 && (
          <p className="text-xs text-brun-light italic">Aucune date définie</p>
        )}

        <div className="space-y-3">
          {dates.map((d, i) => (
            <div key={d.id} className="border border-brun/10 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-brun">Date {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeDate(i)}
                  className="text-xs text-rose hover:text-rose/80 transition-colors"
                >
                  Supprimer
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <div>
                  <label className="text-[10px] text-brun-light block mb-0.5">Date et heure</label>
                  <input
                    type="datetime-local"
                    value={toDatetimeLocal(d.start_datetime)}
                    onChange={(e) => updateDate(i, "start_datetime", new Date(e.target.value).toISOString())}
                    className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-brun-light block mb-0.5">Durée (min)</label>
                  <input
                    type="number"
                    value={d.duration_minutes ?? ""}
                    onChange={(e) => updateDate(i, "duration_minutes", e.target.value ? parseInt(e.target.value) : null)}
                    className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                    placeholder="Ex: 120"
                    min="0"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-brun-light block mb-0.5">Lieu</label>
                  <input
                    type="text"
                    value={d.location ?? ""}
                    onChange={(e) => updateDate(i, "location", e.target.value || null)}
                    className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                    placeholder="Adresse ou lieu"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-brun-light block mb-0.5">Convives</label>
                  <input
                    type="number"
                    value={d.guest_count || ""}
                    onChange={(e) => updateDate(i, "guest_count", parseInt(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                    min="0"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={d.reservation_open}
                    onChange={(e) => updateDate(i, "reservation_open", e.target.checked)}
                    className="rounded border-brun/20 text-orange focus:ring-orange/30"
                  />
                  <span className="text-brun-light">Réservation ouverte</span>
                </label>
                {d.reservation_open && (
                  <input
                    type="url"
                    value={d.reservation_url ?? ""}
                    onChange={(e) => updateDate(i, "reservation_url", e.target.value || null)}
                    className="flex-1 px-2 py-1 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                    placeholder="URL de réservation"
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bloc 3: Présentation (images + texte) */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
        <h3 className="font-serif text-lg text-brun">Présentation</h3>

        {/* Cover images — drag & drop zone */}
        <div>
          <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2 block">Images de couverture</label>

          {/* Drop zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-4 transition-colors mb-3 ${
              dragging
                ? "border-orange bg-orange/5"
                : "border-brun/10 hover:border-brun/20"
            }`}
          >
            {coverImages.length === 0 && !uploading && (
              <p className="text-center text-xs text-brun-light py-4">
                Glissez-déposez des images ici ou{" "}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-orange hover:text-orange-light underline"
                >
                  parcourir
                </button>
              </p>
            )}

            {uploading && (
              <p className="text-center text-xs text-orange py-2">Upload en cours...</p>
            )}

            {/* Image cards with caption/copyright */}
            <div className="space-y-3">
              {coverImages.map((img, i) => {
                const url = img.image_url.startsWith("http") ? img.image_url : `${adminBase}${img.image_url}`
                return (
                  <div key={img.id} className="flex gap-3 items-start p-2 bg-creme/50 rounded-lg">
                    <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-brun/10 shrink-0">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 text-[9px] font-semibold bg-orange text-white rounded">
                          Couverture
                        </span>
                      )}
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        defaultValue={img.caption ?? ""}
                        onBlur={(e) => updateCoverImageMeta(img.image_url, "caption", e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-brun/10 bg-white text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                        placeholder="Légende"
                      />
                      <input
                        type="text"
                        defaultValue={img.copyright ?? ""}
                        onBlur={(e) => updateCoverImageMeta(img.image_url, "copyright", e.target.value)}
                        className="w-full px-2 py-1.5 rounded border border-brun/10 bg-white text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                        placeholder="Copyright (ex: © Photo Dupont)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCoverImage(img.image_url)}
                      className="text-rose hover:text-rose/80 transition-colors shrink-0 mt-1"
                      title="Supprimer"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>

            {coverImages.length > 0 && (
              <div className="text-center mt-3">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-xs text-orange hover:text-orange-light transition-colors"
                >
                  + Ajouter une image
                </button>
              </div>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleCoverUpload}
            className="hidden"
          />
        </div>

        {/* Presentation text */}
        <div>
          <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2 block">Texte de présentation</label>
          <RichTextEditor
            value={presentationText}
            onChange={(html) => { setPresentationText(html); savePresentationText(html) }}
          />
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// SECTION 2: RECETTES & INGRÉDIENTS
// =====================================================================

function RecipesSection({
  event,
  allRecipes,
  allUnits,
  allAisles,
  catalogIngredients,
  onPatch,
  onRefresh,
}: {
  event: Event
  allRecipes: RecipeOption[]
  allUnits: UnitRef[]
  allAisles: AisleRef[]
  catalogIngredients: Array<{ id: string; name: string; default_unit_id: string | null; default_aisle_id: string | null; unit_ids: string[]; aisle_ids: string[] }>
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [recipes, setRecipes] = useState(event.event_recipes ?? [])
  const [ingredients, setIngredients] = useState(event.event_ingredients ?? [])
  const [addRecipeId, setAddRecipeId] = useState("")
  const [recipeSearch, setRecipeSearch] = useState("")
  const [recipeDropdownOpen, setRecipeDropdownOpen] = useState(false)
  const recipeBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from event
  useEffect(() => { setRecipes(event.event_recipes ?? []) }, [event.event_recipes])
  useEffect(() => { setIngredients(event.event_ingredients ?? []) }, [event.event_ingredients])

  const availableRecipes = useMemo(
    () => allRecipes.filter((r) => !recipes.some((er) => er.recette?.id === r.id)),
    [allRecipes, recipes]
  )

  const filteredRecipeOptions = useMemo(() => {
    if (!recipeSearch.trim()) return availableRecipes
    const q = recipeSearch.trim().toLowerCase()
    return availableRecipes.filter((r) => r.name.toLowerCase().includes(q))
  }, [availableRecipes, recipeSearch])

  // ---- Recipes ----

  async function removeRecipe(recipeId: string) {
    const payload = recipes
      .filter((er) => er.recette?.id !== recipeId)
      .map((er) => ({ recipe_id: er.recette?.id, serving_count: er.serving_count }))
    if (await onPatch({ recettes: payload })) {
      showToast("Recette retirée")
      void onRefresh()
    }
  }

  // ---- Ingredients ----

  const [newIng, setNewIng] = useState({ name: "", quantity: "", unit_id: "", aisle_id: "", _unitIds: [] as string[], _aisleIds: [] as string[] })
  const [ingDropdownOpen, setIngDropdownOpen] = useState(false)
  const ingBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingIngIdx, setEditingIngIdx] = useState<number | null>(null)
  const [editIng, setEditIng] = useState({ name: "", quantity: "", unit_id: "", aisle_id: "", _unitIds: [] as string[], _aisleIds: [] as string[] })

  const filteredCatalogIng = useMemo(() => {
    if (!newIng.name.trim() || newIng.name.trim().length < 2) return []
    const q = newIng.name.trim().toLowerCase()
    return catalogIngredients.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 10)
  }, [catalogIngredients, newIng.name])

  function selectCatalogIng(cat: typeof catalogIngredients[0]) {
    setNewIng({
      name: cat.name,
      quantity: newIng.quantity,
      unit_id: cat.default_unit_id ?? "",
      aisle_id: cat.default_aisle_id ?? "",
      _unitIds: cat.unit_ids,
      _aisleIds: cat.aisle_ids,
    })
    setIngDropdownOpen(false)
  }

  // Filtered units/aisles for new ingredient form
  const newIngUnits = useMemo(
    () => newIng._unitIds.length > 0 ? allUnits.filter((u) => newIng._unitIds.includes(u.id)) : allUnits,
    [allUnits, newIng._unitIds]
  )
  const newIngAisles = useMemo(
    () => newIng._aisleIds.length > 0 ? allAisles.filter((a) => newIng._aisleIds.includes(a.id)) : allAisles,
    [allAisles, newIng._aisleIds]
  )

  // Filtered units/aisles for editing ingredient
  const editIngUnits = useMemo(
    () => editIng._unitIds.length > 0 ? allUnits.filter((u) => editIng._unitIds.includes(u.id)) : allUnits,
    [allUnits, editIng._unitIds]
  )
  const editIngAisles = useMemo(
    () => editIng._aisleIds.length > 0 ? allAisles.filter((a) => editIng._aisleIds.includes(a.id)) : allAisles,
    [allAisles, editIng._aisleIds]
  )

  function startEditIng(index: number) {
    const ing = ingredients[index]
    const cat = catalogIngredients.find((c) => c.name.toLowerCase() === ing.name.toLowerCase())
    setEditingIngIdx(index)
    setEditIng({
      name: ing.name,
      quantity: String(ing.quantity),
      unit_id: ing.unite?.id ?? "",
      aisle_id: ing.rayon?.id ?? "",
      _unitIds: cat?.unit_ids ?? [],
      _aisleIds: cat?.aisle_ids ?? [],
    })
  }

  async function addIngredient() {
    if (!newIng.name.trim() || !newIng.unit_id) return
    const payload = [
      ...ingredients.map((i) => ({
        name: i.name, quantity: i.quantity,
        unit_id: i.unite?.id, aisle_id: i.rayon?.id,
      })),
      { name: newIng.name.trim(), quantity: parseFloat(newIng.quantity) || 0, unit_id: newIng.unit_id, aisle_id: newIng.aisle_id || null },
    ]
    if (await onPatch({ ingredients: payload })) {
      showToast("Ingrédient ajouté")
      setNewIng({ name: "", quantity: "", unit_id: "", aisle_id: "", _unitIds: [], _aisleIds: [] })
      void onRefresh()
    }
  }

  async function saveEditIng() {
    if (editingIngIdx === null || !editIng.name.trim() || !editIng.unit_id) return
    const payload = ingredients.map((ing, i) => {
      if (i === editingIngIdx) {
        return { name: editIng.name.trim(), quantity: parseFloat(editIng.quantity) || 0, unit_id: editIng.unit_id, aisle_id: editIng.aisle_id || null }
      }
      return { name: ing.name, quantity: ing.quantity, unit_id: ing.unite?.id, aisle_id: ing.rayon?.id }
    })
    if (await onPatch({ ingredients: payload })) {
      showToast("Ingrédient modifié")
      setEditingIngIdx(null)
      void onRefresh()
    }
  }

  async function removeIngredient(index: number) {
    const payload = ingredients
      .filter((_, i) => i !== index)
      .map((i) => ({
        name: i.name, quantity: i.quantity,
        unit_id: i.unite?.id, aisle_id: i.rayon?.id,
      }))
    if (await onPatch({ ingredients: payload })) {
      showToast("Ingrédient retiré")
      void onRefresh()
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Left — Recettes */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg text-brun flex items-center gap-2">
          <svg className="w-5 h-5 text-brun-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
          Ajouter des recettes
        </h2>

        {/* Add recipe — autocomplete only, no portions */}
        <div className="relative border border-brun/10 rounded-lg p-3 bg-creme/30">
          <input
            type="text"
            value={recipeSearch}
            onChange={(e) => { setRecipeSearch(e.target.value); setRecipeDropdownOpen(true); setAddRecipeId("") }}
            onFocus={() => setRecipeDropdownOpen(true)}
            onBlur={() => {
              if (recipeBlurRef.current) clearTimeout(recipeBlurRef.current)
              recipeBlurRef.current = setTimeout(() => setRecipeDropdownOpen(false), 200)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && addRecipeId) {
                e.preventDefault()
                const recipe = allRecipes.find((r) => r.id === addRecipeId)
                if (!recipe) return
                const payload = [
                  ...recipes.map((er) => ({ recipe_id: er.recette?.id, serving_count: er.serving_count })),
                  { recipe_id: recipe.id, serving_count: recipe.serving_count },
                ]
                onPatch({ recettes: payload }).then((ok) => {
                  if (ok) { showToast("Recette ajoutée"); setAddRecipeId(""); setRecipeSearch(""); void onRefresh() }
                })
              }
            }}
            className="w-full px-3 py-2 rounded-lg border border-brun/10 bg-white text-sm text-brun placeholder:text-brun-light/50 focus:outline-none focus:ring-2 focus:ring-orange/30"
            placeholder="Rechercher une recette..."
          />
          {recipeDropdownOpen && filteredRecipeOptions.length > 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brun/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredRecipeOptions.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    // Add immediately on click
                    const payload = [
                      ...recipes.map((er) => ({ recipe_id: er.recette?.id, serving_count: er.serving_count })),
                      { recipe_id: r.id, serving_count: r.serving_count },
                    ]
                    onPatch({ recettes: payload }).then((ok) => {
                      if (ok) { showToast("Recette ajoutée"); setAddRecipeId(""); setRecipeSearch(""); setRecipeDropdownOpen(false); void onRefresh() }
                    })
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-brun hover:bg-creme transition-colors"
                >
                  {r.name}
                </button>
              ))}
            </div>
          )}
          {recipeDropdownOpen && recipeSearch.trim() && filteredRecipeOptions.length === 0 && (
            <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brun/10 rounded-lg shadow-lg">
              <p className="px-3 py-2 text-xs text-brun-light italic">Aucune recette trouvée</p>
            </div>
          )}
        </div>

        {/* Recipe list — sorted alphabetically */}
        <div className="space-y-2">
          {[...recipes]
            .filter((er) => er.recette)
            .sort((a, b) => (a.recette?.name ?? "").localeCompare(b.recette?.name ?? ""))
            .map((er) => {
              const portionLabel = allRecipes.find((r) => r.id === er.recette?.id)?.portion_type_name ?? "portions"
              return (
                <div key={er.id} className="flex items-start gap-3 p-3 border border-brun/5 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-brun font-medium truncate">{er.recette!.name}</span>
                      <a
                        href={`/recettes/${er.recette!.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brun-light hover:text-orange transition-colors shrink-0"
                        title="Ouvrir la recette"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <input
                        type="number"
                        defaultValue={er.serving_count}
                        onBlur={(e) => {
                          const count = parseInt(e.target.value) || 1
                          if (count === er.serving_count) return
                          const payload = recipes.map((r) => ({
                            recipe_id: r.recette?.id,
                            serving_count: r.recette?.id === er.recette?.id ? count : r.serving_count,
                          }))
                          onPatch({ recettes: payload }).then((ok) => { if (ok) void onRefresh() })
                        }}
                        className="w-14 px-1.5 py-0.5 rounded border border-brun/10 bg-creme text-xs text-brun text-center focus:outline-none focus:ring-2 focus:ring-orange/30"
                        min="1"
                      />
                      <span className="text-xs text-brun-light">{portionLabel}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRecipe(er.recette!.id)}
                    className="text-brun-light hover:text-rose transition-colors shrink-0 mt-0.5"
                    title="Retirer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}

          {recipes.length === 0 && (
            <p className="text-xs text-brun-light italic py-2">Aucune recette ajoutée</p>
          )}
        </div>
      </div>

      {/* Right — Ingrédients */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg text-brun flex items-center gap-2">
          <svg className="w-5 h-5 text-brun-light" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
          </svg>
          Ajouter des ingrédients
        </h2>

        {/* Add ingredient form — 3 lines */}
        <div className="space-y-2 border border-brun/10 rounded-lg p-3 bg-creme/30">
          {/* Line 1: name autocomplete */}
          <div className="relative">
            <input
              type="text"
              value={newIng.name}
              onChange={(e) => { setNewIng({ ...newIng, name: e.target.value, _unitIds: [], _aisleIds: [] }); setIngDropdownOpen(true) }}
              onFocus={() => { if (newIng.name.trim().length >= 2) setIngDropdownOpen(true) }}
              onBlur={() => {
                if (ingBlurRef.current) clearTimeout(ingBlurRef.current)
                ingBlurRef.current = setTimeout(() => setIngDropdownOpen(false), 200)
              }}
              className="w-full px-3 py-2 rounded-lg border border-brun/10 bg-white text-sm text-brun placeholder:text-brun-light/50 focus:outline-none focus:ring-2 focus:ring-orange/30"
              placeholder="Nom de l'ingrédient"
            />
            {ingDropdownOpen && filteredCatalogIng.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-brun/10 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredCatalogIng.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectCatalogIng(cat)}
                    className="w-full text-left px-3 py-2 text-sm text-brun hover:bg-creme transition-colors"
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Line 2: quantity + unit */}
          <div className="flex gap-2">
            <input
              type="number"
              value={newIng.quantity}
              onChange={(e) => setNewIng({ ...newIng, quantity: e.target.value })}
              className="w-20 px-2 py-1.5 rounded-lg border border-brun/10 bg-white text-sm text-brun text-center focus:outline-none focus:ring-2 focus:ring-orange/30"
              placeholder="Qté"
              min="0"
            />
            <select
              value={newIng.unit_id}
              onChange={(e) => setNewIng({ ...newIng, unit_id: e.target.value })}
              className="flex-1 px-2 py-1.5 rounded-lg border border-brun/10 bg-white text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
            >
              <option value="">Unité</option>
              {newIngUnits.map((u) => (
                <option key={u.id} value={u.id}>{u.abbreviation || u.name}</option>
              ))}
            </select>
          </div>
          {/* Line 3: aisle */}
          <select
            value={newIng.aisle_id}
            onChange={(e) => setNewIng({ ...newIng, aisle_id: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg border border-brun/10 bg-white text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
          >
            <option value="">Rayon</option>
            {newIngAisles.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {/* Line 3: add button */}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={addIngredient}
              disabled={!newIng.name.trim() || !newIng.unit_id}
              className="px-4 py-1.5 text-xs bg-orange text-white rounded-lg hover:bg-orange-light disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              + Ajouter
            </button>
          </div>
        </div>

        {/* Ingredient list */}
        <div className="space-y-2">
          {ingredients.map((ing, i) => (
            <div key={ing.id}>
              {editingIngIdx === i ? (
                /* Edit mode */
                <div className="space-y-2 border border-orange/30 rounded-lg p-3 bg-orange/5">
                  <input
                    type="text"
                    value={editIng.name}
                    onChange={(e) => setEditIng({ ...editIng, name: e.target.value })}
                    className="w-full px-3 py-1.5 rounded border border-brun/10 bg-white text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={editIng.quantity}
                      onChange={(e) => setEditIng({ ...editIng, quantity: e.target.value })}
                      className="w-20 px-2 py-1.5 rounded border border-brun/10 bg-white text-sm text-brun text-center focus:outline-none focus:ring-2 focus:ring-orange/30"
                      min="0"
                    />
                    <select
                      value={editIng.unit_id}
                      onChange={(e) => setEditIng({ ...editIng, unit_id: e.target.value })}
                      className="flex-1 px-2 py-1.5 rounded border border-brun/10 bg-white text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
                    >
                      <option value="">Unité</option>
                      {editIngUnits.map((u) => (
                        <option key={u.id} value={u.id}>{u.abbreviation || u.name}</option>
                      ))}
                    </select>
                  </div>
                  <select
                    value={editIng.aisle_id}
                    onChange={(e) => setEditIng({ ...editIng, aisle_id: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-brun/10 bg-white text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
                  >
                    <option value="">Rayon</option>
                    {editIngAisles.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingIngIdx(null)}
                      className="px-3 py-1 text-xs text-brun-light border border-brun/10 rounded hover:bg-creme transition-colors"
                    >
                      Annuler
                    </button>
                    <button
                      type="button"
                      onClick={saveEditIng}
                      disabled={!editIng.name.trim() || !editIng.unit_id}
                      className="px-3 py-1 text-xs bg-orange text-white rounded hover:bg-orange-light disabled:opacity-40 transition-colors"
                    >
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                /* View mode */
                <div className="flex items-center gap-2 p-3 border border-brun/5 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-brun font-medium">{ing.name}</span>
                    <span className="text-xs text-brun-light ml-2">{ing.quantity} {ing.unite?.abbreviation ?? ""}</span>
                    {ing.rayon && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded ml-2"
                        style={{ backgroundColor: ing.rayon.color + "20", color: ing.rayon.color }}
                      >
                        {ing.rayon.name}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => startEditIng(i)}
                    className="text-brun-light hover:text-orange transition-colors shrink-0"
                    title="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => removeIngredient(i)}
                    className="text-brun-light hover:text-rose transition-colors shrink-0"
                    title="Retirer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}

          {ingredients.length === 0 && (
            <p className="text-xs text-brun-light italic py-2">Aucun ingrédient ajouté</p>
          )}
        </div>
      </div>
    </div>
  )
}

// =====================================================================
// SECTION 3: ORGANISATION
// =====================================================================

function OrganisationSection({ event, allAisles, allUnits, catalogIngredients }: {
  event: Event
  allAisles: AisleRef[]
  allUnits: UnitRef[]
  catalogIngredients: Array<{ id: string; name: string; default_aisle_id: string | null; aisle_ids: string[]; conversions: Array<{ source_unit_id: string; target_unit_id: string; conversion_factor: number }> }>
}) {
  type ShoppingItem = { name: string; quantity: number; unit: string; unitPlural: string | null; aisleId: string | null; sources: string[] }

  // Build aisle lookup
  const aisleMap = useMemo(() => {
    const map = new Map<string, AisleRef>()
    for (const a of allAisles) map.set(a.id, a)
    return map
  }, [allAisles])

  // Build catalog lookup by id
  const catalogMap = useMemo(() => {
    const map = new Map<string, typeof catalogIngredients[0]>()
    for (const c of catalogIngredients) map.set(c.id, c)
    return map
  }, [catalogIngredients])

  // Resolve aisle for an ingredient: recipe aisle → master default → first master aisle (by sort_order)
  function resolveAisleId(recipeAisleId: string | null | undefined, masterId: string | null | undefined): string | null {
    if (recipeAisleId) return recipeAisleId
    if (!masterId) return null
    const cat = catalogMap.get(masterId)
    if (!cat) return null
    // Fallback 1: default aisle of the master ingredient
    if (cat.default_aisle_id) return cat.default_aisle_id
    // Fallback 2: first aisle associated, sorted by sort_order
    if (cat.aisle_ids.length > 0) {
      const sorted = cat.aisle_ids
        .map((id) => aisleMap.get(id))
        .filter(Boolean)
        .sort((a, b) => (a!.sort_order ?? 0) - (b!.sort_order ?? 0))
      if (sorted.length > 0) return sorted[0]!.id
    }
    return null
  }

  // ---- Unit normalization ----

  // System conversions: all volumes → mL, all weights → g
  const SYSTEM_TO_BASE: Record<string, { base: string; factor: number }> = {
    mL: { base: "mL", factor: 1 },
    cL: { base: "mL", factor: 10 },
    dL: { base: "mL", factor: 100 },
    L:  { base: "mL", factor: 1000 },
    g:  { base: "g",  factor: 1 },
    kg: { base: "g",  factor: 1000 },
  }

  // Best display unit based on quantity
  function bestDisplayUnit(qty: number, baseUnit: string): { qty: number; unit: string } {
    if (baseUnit === "mL") {
      if (qty >= 1000) return { qty: qty / 1000, unit: "L" }
      if (qty >= 100) return { qty: qty / 10, unit: "cL" }  // prefer cL over dL
      return { qty, unit: "mL" }
    }
    if (baseUnit === "g") {
      if (qty >= 1000) return { qty: qty / 1000, unit: "kg" }
      return { qty, unit: "g" }
    }
    return { qty, unit: baseUnit }
  }

  // Build unit abbreviation → id lookup
  const unitAbbrToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const u of allUnits) map.set(u.abbreviation, u.id)
    return map
  }, [allUnits])

  // Try to convert a quantity+unitAbbrev to a canonical base, using:
  // 1. System conversions (volume/weight)
  // 2. Ingredient-specific conversions (to convert to a system-convertible unit)
  function normalizeToBase(qty: number, unitAbbrev: string, unitId: string | null, masterId: string | null): { qty: number; baseUnit: string; unitGroup: string } {
    // Direct system conversion
    const sys = SYSTEM_TO_BASE[unitAbbrev]
    if (sys) return { qty: qty * sys.factor, baseUnit: sys.base, unitGroup: sys.base }

    // Try ingredient-specific conversion to a system unit
    if (masterId && unitId) {
      const cat = catalogMap.get(masterId)
      if (cat) {
        for (const conv of cat.conversions) {
          if (conv.source_unit_id === unitId) {
            const targetUnit = allUnits.find((u) => u.id === conv.target_unit_id)
            if (targetUnit) {
              const targetSys = SYSTEM_TO_BASE[targetUnit.abbreviation]
              if (targetSys) {
                return { qty: qty * conv.conversion_factor * targetSys.factor, baseUnit: targetSys.base, unitGroup: targetSys.base }
              }
            }
          }
          // Reverse direction
          if (conv.target_unit_id === unitId) {
            const sourceUnit = allUnits.find((u) => u.id === conv.source_unit_id)
            if (sourceUnit) {
              const sourceSys = SYSTEM_TO_BASE[sourceUnit.abbreviation]
              if (sourceSys) {
                return { qty: qty / conv.conversion_factor * sourceSys.factor, baseUnit: sourceSys.base, unitGroup: sourceSys.base }
              }
            }
          }
        }
      }
    }

    // No conversion possible — keep as-is
    return { qty, baseUnit: unitAbbrev, unitGroup: `raw:${unitId ?? unitAbbrev}` }
  }

  // Aggregate all ingredients with unit normalization
  const allItems = useMemo(() => {
    type RawItem = { name: string; qty: number; unitAbbrev: string; unitPlural: string | null; unitId: string | null; masterId: string | null; aisleId: string | null; source: string }
    const rawItems: RawItem[] = []

    for (const er of event.event_recipes ?? []) {
      if (!er.recette?.ingredients) continue
      const ratio = er.recette.serving_count > 0 ? er.serving_count / er.recette.serving_count : 1
      for (const ing of er.recette.ingredients) {
        rawItems.push({
          name: ing.name, qty: (ing.quantity ?? 0) * ratio,
          unitAbbrev: ing.unite?.abbreviation ?? "", unitPlural: ing.unite?.abbreviation_plural ?? null,
          unitId: ing.unite?.id ?? null,
          masterId: ing.ingredient_master_id ?? null,
          aisleId: resolveAisleId(ing.rayon?.id, ing.ingredient_master_id),
          source: er.recette.name,
        })
      }
    }

    for (const ing of event.event_ingredients ?? []) {
      rawItems.push({
        name: ing.name, qty: ing.quantity,
        unitAbbrev: ing.unite?.abbreviation ?? "", unitPlural: ing.unite?.abbreviation_plural ?? null,
        unitId: ing.unite?.id ?? null,
        masterId: null, aisleId: ing.rayon?.id ?? null,
        source: "Ajout individuel",
      })
    }

    // Normalize and aggregate
    const items = new Map<string, ShoppingItem & { baseUnit: string }>()

    for (const raw of rawItems) {
      const nameKey = raw.masterId ?? raw.name.toLowerCase()
      const normalized = normalizeToBase(raw.qty, raw.unitAbbrev, raw.unitId, raw.masterId)
      const key = `${nameKey}-${normalized.unitGroup}`

      const existing = items.get(key)
      if (existing) {
        existing.quantity += normalized.qty
        if (!existing.sources.includes(raw.source)) existing.sources.push(raw.source)
        if (!existing.aisleId && raw.aisleId) existing.aisleId = raw.aisleId
      } else {
        items.set(key, {
          name: raw.name, quantity: normalized.qty, unit: normalized.baseUnit, unitPlural: raw.unitPlural,
          aisleId: raw.aisleId, sources: [raw.source], baseUnit: normalized.baseUnit,
        })
      }
    }

    // Convert base units to best display units, apply plurals for non-system units
    return Array.from(items.values()).map((item) => {
      const display = bestDisplayUnit(item.quantity, item.baseUnit)
      // For non-system units (raw:xxx), use plural form if qty >= 2
      const displayUnit = display.qty >= 2 && item.unitPlural ? item.unitPlural : display.unit
      return { ...item, quantity: display.qty, unit: displayUnit }
    })
  }, [event, allUnits, catalogMap, aisleMap])

  // Organize: family (parent) → child aisles → items, respecting sort_order
  const organized = useMemo(() => {
    type AisleGroup = { id: string; name: string; color: string; sortOrder: number; items: ShoppingItem[] }
    type FamilyGroup = { id: string | null; name: string; color: string; sortOrder: number; aisles: AisleGroup[] }

    // Group items by aisle id
    const byAisleId = new Map<string | null, ShoppingItem[]>()
    for (const item of allItems) {
      const list = byAisleId.get(item.aisleId) ?? []
      list.push(item)
      byAisleId.set(item.aisleId, list)
    }

    const families = new Map<string | null, FamilyGroup>()

    for (const [aisleId, items] of byAisleId.entries()) {
      if (!aisleId) {
        let family = families.get(null)
        if (!family) {
          family = { id: null, name: "Sans rayon", color: "#6B7280", sortOrder: 99999, aisles: [] }
          families.set(null, family)
        }
        family.aisles.push({ id: "none", name: "Non classé", color: "#6B7280", sortOrder: 99999, items })
        continue
      }

      const aisle = aisleMap.get(aisleId)
      if (!aisle) continue

      const parentId = aisle.parent_id ?? null
      const parent = parentId ? aisleMap.get(parentId) : null

      // Family = parent if exists, else self (top-level)
      const familyId = parent ? parentId : aisleId
      const familyRef = parent ?? aisle

      let family = families.get(familyId)
      if (!family) {
        family = { id: familyId, name: familyRef.name, color: familyRef.color, sortOrder: familyRef.sort_order ?? 0, aisles: [] }
        families.set(familyId, family)
      }

      const existing = family.aisles.find((a) => a.id === aisleId)
      if (existing) {
        existing.items.push(...items)
      } else {
        family.aisles.push({ id: aisleId, name: aisle.name, color: aisle.color, sortOrder: aisle.sort_order ?? 0, items })
      }
    }

    return Array.from(families.values())
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((family) => ({
        ...family,
        aisles: family.aisles
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((a) => ({ ...a, items: a.items.sort((x, y) => x.name.localeCompare(y.name)) })),
      }))
  }, [allItems, aisleMap])

  const totalItems = allItems.length

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-brun">Liste de courses</h2>
        <div className="flex items-center gap-3">
          {totalItems > 0 && (
            <span className="text-xs text-brun-light">{totalItems} ingrédient{totalItems > 1 ? "s" : ""}</span>
          )}
          {totalItems > 0 && (
            <button
              type="button"
              onClick={() => void generateShoppingListPdf({
                eventName: event.name,
                organized,
                guestCount: event.guest_count,
              })}
              className="px-3 py-1.5 text-xs font-medium text-brun-light border border-brun/10 rounded-lg hover:border-orange/40 hover:text-orange transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Télécharger PDF
            </button>
          )}
        </div>
      </div>

      {totalItems === 0 ? (
        <p className="text-sm text-brun-light italic py-4 text-center">
          Ajoutez des recettes ou des ingrédients pour générer la liste de courses.
        </p>
      ) : (
        <div className="space-y-5">
          {organized.map((family) => (
            <div key={family.id ?? "none"}>
              {/* Family header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: family.color }} />
                <h3 className="text-sm font-bold text-brun">{family.name}</h3>
              </div>

              {/* Child aisles */}
              <div className="ml-5 space-y-3">
                {family.aisles.map((aisle) => {
                  const showSubHeader = aisle.name !== family.name || family.aisles.length > 1
                  return (
                    <div key={aisle.id}>
                      {showSubHeader && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: aisle.color }} />
                          <h4 className="text-xs font-semibold text-brun-light">{aisle.name}</h4>
                          <span className="text-[10px] text-brun-light/60">({aisle.items.length})</span>
                        </div>
                      )}
                      <div className={`space-y-0.5 ${showSubHeader ? "ml-3.5" : ""}`}>
                        {aisle.items.map((item, i) => {
                          const formatted = formatIngredientNatural(item.name, item.quantity, item.unit, item.unitPlural)
                          return (
                            <div key={i} className="flex items-baseline gap-2 py-0.5">
                              <span className="text-sm text-brun">{formatted}</span>
                              {item.sources.length > 0 && (
                                <span className="text-[10px] text-brun-light/60 truncate">
                                  ({item.sources.join(", ")})
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Links to recipe pages */}
      {(event.event_recipes ?? []).some((er) => er.recette) && (
        <div className="pt-4 border-t border-brun/10">
          <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2">Fiches recettes</h3>
          <div className="flex flex-wrap gap-2">
            {[...(event.event_recipes ?? [])]
              .filter((er) => er.recette)
              .sort((a, b) => (a.recette?.name ?? "").localeCompare(b.recette?.name ?? ""))
              .map((er) => (
                <a
                  key={er.id}
                  href={`/recettes/${er.recette!.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs border border-brun/10 rounded-lg hover:border-orange/40 hover:text-orange transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {er.recette!.name}
                </a>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// =====================================================================
// SECTION 4: COMPTE RENDU
// =====================================================================

function ReportSection({
  event,
  onPatch,
  onRefresh,
}: {
  event: Event
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [reportText, setReportText] = useState(event.report_text ?? "")
  const [reportTitle, setReportTitle] = useState(event.report_title ?? "")
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragging, setDragging] = useState(false)

  const reportImages = useMemo(
    () => (event.event_images ?? []).filter((img) => img.image_type === "report").sort((a, b) => a.sort_order - b.sort_order),
    [event.event_images]
  )

  const adminBase = getAdminBase()

  async function saveReportText(html: string) {
    if (html !== (event.report_text ?? "")) {
      if (await onPatch({ report_text: html || null })) void onRefresh()
    }
  }

  async function saveReportTitle() {
    if (reportTitle.trim() === (event.report_title ?? "")) return
    if (await onPatch({ report_title: reportTitle.trim() || null })) void onRefresh()
  }

  // ---- Image helpers (preserving cover images in all operations) ----

  function buildAllImages(newReportImages: Array<{ image_url: string; caption: string | null; copyright: string | null; sort_order: number }>) {
    return [
      ...(event.event_images ?? []).filter((img) => img.image_type === "cover").map((img) => ({
        image_type: "cover" as const, image_url: img.image_url,
        caption: img.caption, copyright: img.copyright, sort_order: img.sort_order,
      })),
      ...newReportImages.map((img, i) => ({
        image_type: "report" as const, image_url: img.image_url,
        caption: img.caption, copyright: img.copyright, sort_order: i,
      })),
    ]
  }

  async function uploadReportFiles(files: File[]) {
    setUploading(true)
    try {
      const newUrls: string[] = []
      for (const file of files) {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("prefix", "events")
        const res = await fetch("/api/upload-image", { method: "POST", body: formData })
        const json = await res.json()
        const url = json.data?.url ?? json.url
        if (url) newUrls.push(url)
      }
      if (newUrls.length === 0) throw new Error("Aucun upload n'a réussi")

      const updatedReportImages = [
        ...reportImages.map((img) => ({ image_url: img.image_url, caption: img.caption, copyright: img.copyright, sort_order: img.sort_order })),
        ...newUrls.map((url, i) => ({ image_url: url, caption: null, copyright: null, sort_order: reportImages.length + i })),
      ]
      if (await onPatch({ images: buildAllImages(updatedReportImages) })) {
        showToast(`${newUrls.length} image${newUrls.length > 1 ? "s" : ""} ajoutée${newUrls.length > 1 ? "s" : ""}`)
        void onRefresh()
      }
    } catch {
      showToast("Erreur lors de l'upload", "error")
    } finally {
      setUploading(false)
    }
  }

  async function handleReportUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    await uploadReportFiles(files)
    if (fileRef.current) fileRef.current.value = ""
  }

  async function removeReportImage(imageUrl: string) {
    const updated = reportImages
      .filter((img) => img.image_url !== imageUrl)
      .map((img) => ({ image_url: img.image_url, caption: img.caption, copyright: img.copyright, sort_order: img.sort_order }))
    if (await onPatch({ images: buildAllImages(updated) })) {
      showToast("Image retirée")
      void onRefresh()
    }
  }

  async function updateReportImageMeta(imageUrl: string, field: "caption" | "copyright", value: string) {
    const updated = reportImages.map((img) => ({
      image_url: img.image_url,
      caption: img.image_url === imageUrl && field === "caption" ? (value || null) : img.caption,
      copyright: img.image_url === imageUrl && field === "copyright" ? (value || null) : img.copyright,
      sort_order: img.sort_order,
    }))
    if (await onPatch({ images: buildAllImages(updated) })) void onRefresh()
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragging(true) }
  function handleDragLeave(e: React.DragEvent) { e.preventDefault(); setDragging(false) }
  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"))
    if (files.length > 0) await uploadReportFiles(files)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
      <h2 className="font-serif text-lg text-brun">Compte rendu</h2>

      {/* Report text */}
      <div>
        <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2 block">Texte de compte rendu</label>
        <RichTextEditor
          value={reportText}
          onChange={(html) => { setReportText(html); saveReportText(html) }}
        />
      </div>

      {/* Report images title */}
      <div>
        <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2 block">Titre du mur d&apos;images</label>
        <input type="text" value={reportTitle}
          onChange={e => setReportTitle(e.target.value)}
          onBlur={saveReportTitle}
          className="w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
          placeholder="Ex: Retour en images, Galerie photos..." />
      </div>

      {/* Report images — drag & drop zone */}
      <div>
        <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-2 block">Images du compte rendu</label>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-4 transition-colors ${
            dragging ? "border-orange bg-orange/5" : "border-brun/10 hover:border-brun/20"
          }`}
        >
          {reportImages.length === 0 && !uploading && (
            <p className="text-center text-xs text-brun-light py-4">
              Glissez-déposez des images ici ou{" "}
              <button type="button" onClick={() => fileRef.current?.click()} className="text-orange hover:text-orange-light underline">
                parcourir
              </button>
            </p>
          )}

          {uploading && (
            <p className="text-center text-xs text-orange py-2">Upload en cours...</p>
          )}

          <div className="space-y-3">
            {reportImages.map((img) => {
              const url = img.image_url.startsWith("http") ? img.image_url : `${adminBase}${img.image_url}`
              return (
                <div key={img.id} className="flex gap-3 items-start p-2 bg-creme/50 rounded-lg">
                  <div className="w-28 h-20 rounded-lg overflow-hidden border border-brun/10 shrink-0">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      defaultValue={img.caption ?? ""}
                      onBlur={(e) => updateReportImageMeta(img.image_url, "caption", e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-brun/10 bg-white text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                      placeholder="Légende"
                    />
                    <input
                      type="text"
                      defaultValue={img.copyright ?? ""}
                      onBlur={(e) => updateReportImageMeta(img.image_url, "copyright", e.target.value)}
                      className="w-full px-2 py-1.5 rounded border border-brun/10 bg-white text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                      placeholder="Copyright (ex: © Photo Dupont)"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeReportImage(img.image_url)}
                    className="text-rose hover:text-rose/80 transition-colors shrink-0 mt-1"
                    title="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          {reportImages.length > 0 && (
            <div className="text-center mt-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-xs text-orange hover:text-orange-light transition-colors"
              >
                + Ajouter une image
              </button>
            </div>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleReportUpload}
          className="hidden"
        />
      </div>
    </div>
  )
}

// =====================================================================
// SECTION 5: TÉMOIGNAGES
// =====================================================================

function TestimonialsSection({
  event,
  onPatch,
  onRefresh,
}: {
  event: Event
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const [testimonials, setTestimonials] = useState(event.event_testimonials ?? [])

  useEffect(() => { setTestimonials(event.event_testimonials ?? []) }, [event.event_testimonials])

  function addTestimonial() {
    setTestimonials([...testimonials, {
      id: `temp-${Date.now()}`,
      author_name: "",
      author_role: null,
      text: "",
      sort_order: testimonials.length,
    }])
  }

  function updateTestimonial(index: number, field: string, value: string | null) {
    setTestimonials(testimonials.map((t, i) => i === index ? { ...t, [field]: value } : t))
  }

  function removeTestimonial(index: number) {
    setTestimonials(testimonials.filter((_, i) => i !== index))
  }

  async function saveTestimonials() {
    const valid = testimonials.filter((t) => t.text.trim() && t.author_name.trim())
    const payload = valid.map((t, i) => ({
      author_name: t.author_name.trim(),
      author_role: t.author_role || null,
      text: t.text.trim(),
      sort_order: i,
    }))
    if (await onPatch({ testimonials: payload })) {
      showToast("Témoignages enregistrés")
      void onRefresh()
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-brun">Témoignages</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={addTestimonial}
            className="text-xs text-orange hover:text-orange-light transition-colors"
          >
            + Ajouter
          </button>
          {testimonials.length > 0 && (
            <button
              type="button"
              onClick={saveTestimonials}
              className="text-xs px-2 py-0.5 bg-orange text-white rounded hover:bg-orange-light transition-colors"
            >
              Enregistrer
            </button>
          )}
        </div>
      </div>

      {testimonials.length === 0 && (
        <p className="text-xs text-brun-light italic">Aucun témoignage</p>
      )}

      <div className="space-y-3">
        {testimonials.map((t, i) => (
          <div key={t.id} className="border border-brun/10 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-brun">Témoignage {i + 1}</span>
              <button
                type="button"
                onClick={() => removeTestimonial(i)}
                className="text-xs text-rose hover:text-rose/80 transition-colors"
              >
                Supprimer
              </button>
            </div>
            <textarea
              value={t.text}
              onChange={(e) => updateTestimonial(i, "text", e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30 resize-none"
              placeholder="Texte du témoignage..."
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={t.author_name}
                onChange={(e) => updateTestimonial(i, "author_name", e.target.value)}
                className="px-2 py-1.5 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                placeholder="Nom de l'auteur"
              />
              <input
                type="text"
                value={t.author_role ?? ""}
                onChange={(e) => updateTestimonial(i, "author_role", e.target.value || null)}
                className="px-2 py-1.5 rounded border border-brun/10 bg-creme text-xs text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                placeholder="Rôle (optionnel)"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// =====================================================================
// SECTION 6: PARCOURS
// =====================================================================

function StepsSection({
  event,
  onPatch,
  onRefresh,
}: {
  event: Event
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh: () => Promise<void>
}) {
  const { showToast } = useToast()
  const adminBase = getAdminBase()
  const [stepsTitle, setStepsTitle] = useState(event.steps_title ?? "")
  const [stepsText, setStepsText] = useState(event.steps_text ?? "")
  const [steps, setSteps] = useState(event.event_steps ?? [])
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)

  useEffect(() => { setSteps(event.event_steps ?? []) }, [event.event_steps])
  useEffect(() => { setStepsTitle(event.steps_title ?? "") }, [event.steps_title])
  useEffect(() => { setStepsText(event.steps_text ?? "") }, [event.steps_text])

  async function saveStepsTitle() {
    if (stepsTitle.trim() === (event.steps_title ?? "")) return
    if (await onPatch({ steps_title: stepsTitle.trim() || null })) {
      showToast("Titre enregistré")
      void onRefresh()
    }
  }

  async function saveStepsText(html: string) {
    setStepsText(html)
    if (await onPatch({ steps_text: html || null })) void onRefresh()
  }

  function addStep() {
    setSteps([...steps, {
      id: `temp-${Date.now()}`,
      title: null,
      text: null,
      image_url: null,
      sort_order: steps.length,
    }])
  }

  function updateStep(index: number, field: "title" | "text" | "image_url", value: string | null) {
    setSteps(steps.map((s, i) => i === index ? { ...s, [field]: value } : s))
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index))
  }

  function moveStep(index: number, direction: -1 | 1) {
    const next = [...steps]
    const target = index + direction
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setSteps(next)
  }

  async function saveSteps(nextSteps?: typeof steps) {
    const current = nextSteps ?? steps
    const payload = current.map((s, i) => ({
      title: s.title?.trim() || null,
      text: s.text?.trim() || null,
      image_url: s.image_url || null,
      sort_order: i,
    }))
    if (await onPatch({ steps: payload })) {
      showToast("Parcours enregistré")
      void onRefresh()
    }
  }

  async function uploadStepImage(index: number, file: File) {
    setUploadingIdx(index)
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("prefix", "events")
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      const json = await res.json()
      const url = json.data?.url ?? json.url
      if (url) {
        const next = steps.map((s, i) => i === index ? { ...s, image_url: url } : s)
        setSteps(next)
        await saveSteps(next)
      }
    } catch { showToast("Erreur upload", "error") } finally { setUploadingIdx(null) }
  }

  return (
    <div className="space-y-4">
      {/* Section title + text */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg text-brun">Section Parcours</h2>
        <div>
          <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Titre de la section</label>
          <input type="text" value={stepsTitle} onChange={e => setStepsTitle(e.target.value)}
            onBlur={saveStepsTitle}
            className="w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
            placeholder="Ex: Notre parcours, Le menu, Les étapes..." />
        </div>
        <div>
          <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Texte d&apos;introduction</label>
          <RichTextEditor value={stepsText} onChange={saveStepsText} />
        </div>
      </div>

      {/* Steps */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg text-brun">Étapes du parcours</h2>
          <div className="flex gap-2">
            <button type="button" onClick={addStep}
              className="text-xs text-orange hover:text-orange-light transition-colors">
              + Ajouter
            </button>
            {steps.length > 0 && (
              <button type="button" onClick={() => saveSteps()}
                className="text-xs px-2 py-0.5 bg-orange text-white rounded hover:bg-orange-light transition-colors">
                Enregistrer
              </button>
            )}
          </div>
        </div>

        {steps.length === 0 && (
          <p className="text-xs text-brun-light italic">Aucune étape</p>
        )}

        <div className="space-y-4">
          {steps.map((s, i) => {
            const imgSrc = s.image_url
              ? (s.image_url.startsWith("http") ? s.image_url : `${adminBase}${s.image_url}`)
              : null
            return (
              <div key={s.id} className="border border-brun/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-brun">Étape {i + 1}</span>
                  <div className="flex gap-2 items-center">
                    <button type="button" onClick={() => moveStep(i, -1)} disabled={i === 0}
                      className="text-xs text-brun-light hover:text-brun disabled:opacity-30 transition-colors" aria-label="Monter">↑</button>
                    <button type="button" onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1}
                      className="text-xs text-brun-light hover:text-brun disabled:opacity-30 transition-colors" aria-label="Descendre">↓</button>
                    <button type="button" onClick={() => removeStep(i)}
                      className="text-xs text-rose hover:text-rose/80 transition-colors">Supprimer</button>
                  </div>
                </div>

                <div className="flex gap-3 items-start">
                  {/* Image */}
                  <div className="flex-shrink-0">
                    {imgSrc ? (
                      <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-brun/10 bg-creme">
                        <img src={imgSrc} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-32 h-24 rounded-lg border border-dashed border-brun/20 flex items-center justify-center bg-creme">
                        <span className="text-xs text-brun-light/40">Image</span>
                      </div>
                    )}
                    <div className="flex gap-2 mt-1 justify-center">
                      <label className="text-[10px] text-orange cursor-pointer hover:text-orange-light">
                        {uploadingIdx === i ? "..." : (imgSrc ? "Changer" : "Uploader")}
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadStepImage(i, f); e.target.value = "" }} />
                      </label>
                      {imgSrc && (
                        <button type="button" onClick={() => { const next = steps.map((st, idx) => idx === i ? { ...st, image_url: null } : st); setSteps(next); void saveSteps(next) }}
                          className="text-[10px] text-red-400 hover:text-red-600">Retirer</button>
                      )}
                    </div>
                  </div>

                  {/* Contenu */}
                  <div className="flex-1 space-y-2">
                    <input type="text" value={s.title ?? ""}
                      onChange={(e) => updateStep(i, "title", e.target.value || null)}
                      className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"
                      placeholder="Titre de l'étape (optionnel)" />
                    <textarea value={s.text ?? ""}
                      onChange={(e) => updateStep(i, "text", e.target.value || null)}
                      rows={3}
                      className="w-full px-2 py-1.5 rounded border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30 resize-none"
                      placeholder="Texte de l'étape (optionnel)" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
