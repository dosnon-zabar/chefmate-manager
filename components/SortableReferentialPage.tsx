"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useToast } from "./Toaster"
import { SortableTree, buildTreeFromFlat, type TreeItem } from "./SortableTree"
import SidePanel from "./SidePanel"
import ConfirmDialog from "./ConfirmDialog"

export interface FieldDef {
  key: string
  label: string
  type: "text" | "color" | "number"
  required?: boolean
  placeholder?: string
}

interface ReferentialItem {
  id: string
  name: string
  sort_order: number
  parent_id: null
  [key: string]: unknown
}

interface Props {
  title: string
  subtitle: string
  apiPath: string
  fields: FieldDef[]
  canWrite: boolean
  /** Which field to show as the main label in the sortable list. Default: "name" */
  labelKey?: string
  /** Optional secondary text shown after the label */
  secondaryKey?: string
  /** Optional field shown before the label (e.g. emoji icon) */
  prefixKey?: string
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

/**
 * Sortable referential page for flat lists with drag-and-drop ordering.
 * Uses SortableTree with flat items (no hierarchy).
 */
export default function SortableReferentialPage({
  title,
  subtitle,
  apiPath,
  fields,
  canWrite,
  labelKey = "name",
  secondaryKey,
  prefixKey,
}: Props) {
  const { showToast } = useToast()

  const [items, setItems] = useState<ReferentialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ReferentialItem | null>(null)
  const [formData, setFormData] = useState<Record<string, string | number>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<ReferentialItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadItems = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/${apiPath}`)
      if (!res.ok) return
      const json = await res.json()
      // Ensure parent_id is null for flat items (so buildTreeFromFlat works)
      setItems(
        (json.data ?? []).map((d: Record<string, unknown>) => ({
          ...d,
          parent_id: null,
          sort_order: typeof d.sort_order === "number" ? d.sort_order : 0,
        }))
      )
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [apiPath])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // Search filter (local)
  const searchLower = searchInput.trim().toLowerCase()
  const filteredItems = useMemo(() => {
    if (!searchLower) return items
    return items.filter((i) =>
      String(i[labelKey] ?? "")
        .toLowerCase()
        .includes(searchLower)
    )
  }, [items, searchLower, labelKey])

  const treeItems = useMemo(
    () => buildTreeFromFlat(filteredItems),
    [filteredItems]
  )

  const itemMap = useMemo(() => {
    const map = new Map<string, ReferentialItem>()
    for (const item of items) map.set(item.id, item)
    return map
  }, [items])

  // Reorder
  async function handleReorder(
    flatItems: { id: string; parentId: string | null; sort_order: number }[]
  ) {
    // Optimistic update
    setItems((prev) => {
      const updated = [...prev]
      for (const fi of flatItems) {
        const idx = updated.findIndex((a) => a.id === fi.id)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], sort_order: fi.sort_order }
        }
      }
      return updated.sort((a, b) => a.sort_order - b.sort_order)
    })

    try {
      const res = await fetch(`/api/${apiPath}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: flatItems.map((i) => ({
            id: i.id,
            sort_order: i.sort_order,
          })),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      showToast("Ordre mis à jour.")
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
      void loadItems()
    }
  }

  // CRUD
  function openCreate() {
    setEditingItem(null)
    const initial: Record<string, string | number> = {}
    for (const f of fields) {
      initial[f.key] = f.type === "number" ? 0 : ""
    }
    setFormData(initial)
    setFormError(null)
    setPanelOpen(true)
  }

  function openEdit(item: ReferentialItem) {
    setEditingItem(item)
    const initial: Record<string, string | number> = {}
    for (const f of fields) {
      const val = item[f.key]
      initial[f.key] =
        f.type === "number"
          ? typeof val === "number" ? val : 0
          : typeof val === "string" ? val : ""
    }
    setFormData(initial)
    setFormError(null)
    setPanelOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    for (const f of fields) {
      if (f.required && !formData[f.key] && formData[f.key] !== 0) {
        setFormError(`Le champ "${f.label}" est obligatoire`)
        return
      }
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {}
      for (const f of fields) {
        body[f.key] = formData[f.key] || (f.type === "number" ? 0 : null)
      }

      if (editingItem) {
        const res = await fetch(`/api/${apiPath}/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formData[labelKey]}" mis à jour.`)
      } else {
        body.sort_order =
          items.length > 0
            ? Math.max(...items.map((i) => i.sort_order)) + 1
            : 0
        const res = await fetch(`/api/${apiPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formData[labelKey]}" créé.`)
      }
      setPanelOpen(false)
      void loadItems()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingItem) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/${apiPath}/${deletingItem.id}`, { method: "DELETE" })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      showToast(`"${deletingItem.name}" supprimé.`)
      setDeleteConfirmOpen(false)
      setDeletingItem(null)
      void loadItems()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setDeleting(false)
    }
  }

  const isCreation = !editingItem

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
        disabled={saving}
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
          <h1 className="font-serif text-3xl text-brun">{title}</h1>
          <p className="text-sm text-brun-light mt-1">{subtitle}</p>
        </div>
        {canWrite && (
          <button
            onClick={openCreate}
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
          placeholder="Rechercher..."
          className="w-full pl-9 pr-9 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
        />
        {searchInput && (
          <button type="button" onClick={() => setSearchInput("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-brun-light hover:text-brun text-sm px-1">
            ✕
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-brun-light italic">Chargement...</p>}

      {!loading && filteredItems.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucun élément</p>
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <SortableTree
            items={treeItems}
            onReorder={handleReorder}
            renderItem={({ id }) => {
              const item = itemMap.get(id)
              if (!item) return null
              // Check if there's a color field
              const colorField = fields.find((f) => f.type === "color")
              const colorValue = colorField
                ? (item[colorField.key] as string)
                : null
              return (
                <div className="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-creme/50 group">
                  {colorValue && (
                    <span
                      className="w-3 h-3 rounded-full flex-shrink-0 border border-brun/10"
                      style={{ backgroundColor: colorValue }}
                    />
                  )}
                  <span className="text-sm text-brun font-medium flex-1">
                    {prefixKey && item[prefixKey] ? (
                      <span className="mr-1.5">{String(item[prefixKey])}</span>
                    ) : null}
                    {String(item[labelKey] ?? "")}
                    {secondaryKey && item[secondaryKey] ? (
                      <span className="text-brun-light font-normal ml-2">
                        ({String(item[secondaryKey])})
                      </span>
                    ) : null}
                  </span>
                  {canWrite && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openEdit(item) }}
                        title="Modifier"
                        className="text-brun-light hover:text-orange transition-colors p-0.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setDeletingItem(item); setDeleteConfirmOpen(true) }}
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
            }}
          />
        </div>
      )}

      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={isCreation ? "Ajouter" : "Modifier"}
        subtitle={title}
        footer={footer}
        width="sm"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">{formError}</div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-brun mb-1">
                {f.label}{f.required && " *"}
              </label>
              {f.type === "color" ? (
                <div className="flex items-center gap-2">
                  <input type="color" value={(formData[f.key] as string) || "#6B7280"} onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))} className="w-10 h-10 rounded-lg border border-brun/10 cursor-pointer" />
                  <input type="text" value={(formData[f.key] as string) || ""} onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))} className={INPUT_CLASS} placeholder="#RRGGBB" />
                </div>
              ) : f.type === "number" ? (
                <input type="number" value={formData[f.key] ?? 0} onChange={(e) => setFormData((d) => ({ ...d, [f.key]: parseInt(e.target.value) || 0 }))} className={INPUT_CLASS} />
              ) : (
                <input type="text" value={(formData[f.key] as string) || ""} onChange={(e) => setFormData((d) => ({ ...d, [f.key]: e.target.value }))} className={INPUT_CLASS} placeholder={f.placeholder} />
              )}
            </div>
          ))}
        </div>
      </SidePanel>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer"
        message={`Êtes-vous sûr de vouloir supprimer "${deletingItem?.name}" ?`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => { setDeleteConfirmOpen(false); setDeletingItem(null) }}
      />
    </div>
  )
}
