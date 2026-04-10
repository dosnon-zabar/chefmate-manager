"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import { SortableTree, buildTreeFromFlat } from "@/components/SortableTree"
import SidePanel from "@/components/SidePanel"
import ConfirmDialog from "@/components/ConfirmDialog"

interface Aisle {
  id: string
  name: string
  color: string
  sort_order: number
  parent_id: string | null
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

export default function RayonsPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global") || hasRole("Admin contenu")
  const { showToast } = useToast()

  const [aisles, setAisles] = useState<Aisle[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState("")

  // Panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingAisle, setEditingAisle] = useState<Aisle | null>(null)
  const [formName, setFormName] = useState("")
  const [formColor, setFormColor] = useState("#3B82F6")
  const [formParentId, setFormParentId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingAisle, setDeletingAisle] = useState<Aisle | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadAisles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/aisles")
      if (!res.ok) return
      const json = await res.json()
      setAisles(json.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAisles()
  }, [loadAisles])

  // Collapsed parents (toggle)
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())

  function toggleCollapse(id: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter aisles by search (keep matching items + their parents)
  const searchLower = searchInput.trim().toLowerCase()
  const filteredAisles = useMemo(() => {
    if (!searchLower) return aisles
    const matchingIds = new Set<string>()
    for (const a of aisles) {
      if (a.name.toLowerCase().includes(searchLower)) {
        matchingIds.add(a.id)
        // Also include the parent so the tree structure holds
        if (a.parent_id) matchingIds.add(a.parent_id)
      }
    }
    return aisles.filter((a) => matchingIds.has(a.id))
  }, [aisles, searchLower])

  // Build tree, then prune collapsed children (skip collapsing when searching)
  const fullTree = useMemo(() => buildTreeFromFlat(filteredAisles), [filteredAisles])

  const treeItems = useMemo(() => {
    // When searching, show everything expanded
    if (searchLower) return fullTree
    function pruneCollapsed(items: ReturnType<typeof buildTreeFromFlat>): ReturnType<typeof buildTreeFromFlat> {
      return items.map((item) => ({
        ...item,
        children: collapsedIds.has(item.id) ? [] : pruneCollapsed(item.children),
      }))
    }
    return pruneCollapsed(fullTree)
  }, [fullTree, collapsedIds, searchLower])

  // Root aisles for the parent dropdown
  const rootAisles = useMemo(
    () => aisles.filter((a) => a.parent_id === null),
    [aisles]
  )

  // Map id → aisle for quick lookup in renderItem
  const aisleMap = useMemo(() => {
    const map = new Map<string, Aisle>()
    for (const a of aisles) map.set(a.id, a)
    return map
  }, [aisles])

  // Set of ids that have children (for toggle icon)
  const hasChildrenSet = useMemo(() => {
    const set = new Set<string>()
    for (const a of aisles) {
      if (a.parent_id) set.add(a.parent_id)
    }
    return set
  }, [aisles])

  // --- Drag and drop ---
  async function handleReorder(
    flatItems: {
      id: string
      parentId: string | null
      sort_order: number
    }[]
  ) {
    // Optimistic update
    setAisles((prev) => {
      const updated = [...prev]
      for (const item of flatItems) {
        const idx = updated.findIndex((a) => a.id === item.id)
        if (idx !== -1) {
          updated[idx] = {
            ...updated[idx],
            parent_id: item.parentId,
            sort_order: item.sort_order,
          }
        }
      }
      return updated
    })

    try {
      const res = await fetch("/api/aisles/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: flatItems.map((i) => ({
            id: i.id,
            parent_id: i.parentId,
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
      void loadAisles() // Revert on failure
    }
  }

  // --- CRUD ---
  function openCreate() {
    setEditingAisle(null)
    setFormName("")
    setFormColor("#3B82F6")
    setFormParentId(null)
    setFormError(null)
    setPanelOpen(true)
  }

  function openEdit(aisle: Aisle) {
    setEditingAisle(aisle)
    setFormName(aisle.name)
    setFormColor(aisle.color || "#3B82F6")
    setFormParentId(aisle.parent_id)
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
        color: formColor,
        parent_id: formParentId,
      }

      if (editingAisle) {
        const res = await fetch(`/api/aisles/${editingAisle.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formName.trim()}" mis à jour.`)
      } else {
        // Set sort_order to max+1 among siblings
        const siblings = aisles.filter(
          (a) => a.parent_id === formParentId
        )
        body.sort_order =
          siblings.length > 0
            ? Math.max(...siblings.map((a) => a.sort_order)) + 1
            : 0

        const res = await fetch("/api/aisles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formName.trim()}" créé.`)
      }
      setPanelOpen(false)
      void loadAisles()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deletingAisle) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/aisles/${deletingAisle.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      showToast(`"${deletingAisle.name}" supprimé.`)
      setDeleteConfirmOpen(false)
      setDeletingAisle(null)
      void loadAisles()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setDeleting(false)
    }
  }

  // --- Render ---
  const isCreation = !editingAisle

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
        {saving
          ? "Enregistrement..."
          : isCreation
            ? "Créer"
            : "Enregistrer"}
      </button>
    </>
  )

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Rayons</h1>
          <p className="text-sm text-brun-light mt-1">
            Organisez les rayons du catalogue par glisser-déposer
          </p>
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
          placeholder="Rechercher un rayon..."
          className="w-full pl-9 pr-9 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => setSearchInput("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-brun-light hover:text-brun text-sm px-1"
          >
            ✕
          </button>
        )}
      </div>

      {loading && (
        <p className="text-sm text-brun-light italic">Chargement...</p>
      )}

      {!loading && aisles.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucun rayon</p>
        </div>
      )}

      {!loading && aisles.length > 0 && (
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <SortableTree
            items={treeItems}
            onReorder={handleReorder}
            renderItem={({ id, depth }) => {
              const aisle = aisleMap.get(id)
              if (!aisle) return null
              const isParent = depth === 0
              const hasChildren = hasChildrenSet.has(id)
              const isCollapsed = collapsedIds.has(id)
              return (
                <div
                  className={`flex items-center gap-2 py-1.5 px-2 rounded group ${
                    isParent
                      ? "bg-creme/60 hover:bg-creme"
                      : "hover:bg-creme/30"
                  }`}
                >
                  {/* Toggle for parents with children */}
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleCollapse(id)
                      }}
                      className="flex-shrink-0 text-brun-light hover:text-brun transition-colors"
                    >
                      <svg
                        className={`w-3.5 h-3.5 transition-transform ${
                          isCollapsed ? "" : "rotate-90"
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
                    </button>
                  ) : (
                    <span className="w-3.5 flex-shrink-0" />
                  )}
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 border border-brun/10"
                    style={{ backgroundColor: aisle.color || "#ccc" }}
                  />
                  <span
                    className={`text-sm flex-1 ${
                      isParent
                        ? "text-brun font-semibold"
                        : "text-brun-light"
                    }`}
                  >
                    {aisle.name}
                  </span>
                  {canWrite && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(aisle)
                        }}
                        title="Modifier"
                        className="text-brun-light hover:text-orange transition-colors p-0.5"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.75}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingAisle(aisle)
                          setDeleteConfirmOpen(true)
                        }}
                        title="Supprimer"
                        className="text-brun-light hover:text-rose transition-colors p-0.5"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={1.75}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
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

      {/* Create/Edit Panel */}
      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={isCreation ? "Nouveau rayon" : "Modifier le rayon"}
        subtitle="Rayons"
        footer={footer}
        width="sm"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brun mb-1">
              Nom *
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className={INPUT_CLASS}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-brun mb-1">
              Couleur
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="w-10 h-10 rounded-lg border border-brun/10 cursor-pointer"
              />
              <input
                type="text"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className={INPUT_CLASS}
                placeholder="#RRGGBB"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brun mb-1">
              Rayon parent
            </label>
            <select
              value={formParentId || ""}
              onChange={(e) =>
                setFormParentId(e.target.value || null)
              }
              className={INPUT_CLASS}
            >
              <option value="">Aucun (rayon racine)</option>
              {rootAisles
                .filter((a) => a.id !== editingAisle?.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer le rayon"
        message={`Êtes-vous sûr de vouloir supprimer "${deletingAisle?.name}" ? Les sous-rayons deviendront des rayons racine.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDeletingAisle(null)
        }}
      />
    </div>
  )
}
