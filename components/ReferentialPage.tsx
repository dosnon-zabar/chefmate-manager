"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "./Toaster"
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
  [key: string]: unknown
}

interface Props {
  title: string
  subtitle: string
  apiPath: string
  /** Which fields to show in the table + edit form */
  fields: FieldDef[]
  /** Whether current user can create/edit/delete */
  canWrite: boolean
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

export default function ReferentialPage({
  title,
  subtitle,
  apiPath,
  fields,
  canWrite,
}: Props) {
  const { showToast } = useToast()

  const [items, setItems] = useState<ReferentialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const [panelOpen, setPanelOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ReferentialItem | null>(null)
  const [formData, setFormData] = useState<Record<string, string | number>>({})
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deletingItem, setDeletingItem] = useState<ReferentialItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.set("search", searchTerm)
      const qs = params.toString()
      const res = await fetch(`/api/${apiPath}${qs ? `?${qs}` : ""}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setItems(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [apiPath, searchTerm])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

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
          ? typeof val === "number"
            ? val
            : 0
          : typeof val === "string"
            ? val
            : ""
    }
    setFormData(initial)
    setFormError(null)
    setPanelOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    // Validate required fields
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
        showToast(`"${formData.name}" mis à jour.`)
      } else {
        const res = await fetch(`/api/${apiPath}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast(`"${formData.name}" créé.`)
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
      const res = await fetch(`/api/${apiPath}/${deletingItem.id}`, {
        method: "DELETE",
      })
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
          placeholder="Rechercher..."
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
      {error && (
        <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Table */}
      {!loading && items.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-creme/50 text-[11px] font-semibold text-brun-light uppercase tracking-wide">
                {fields.map((f) => (
                  <th key={f.key} className="text-left px-5 py-2">
                    {f.label}
                  </th>
                ))}
                {canWrite && (
                  <th className="text-right px-5 py-2 w-24">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={idx % 2 === 0 ? "bg-white" : "bg-creme/30"}
                >
                  {fields.map((f) => (
                    <td key={f.key} className="px-5 py-2.5 text-brun">
                      {f.type === "color" ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full inline-block border border-brun/10"
                            style={{
                              backgroundColor:
                                (item[f.key] as string) || "#ccc",
                            }}
                          />
                          <span className="text-xs text-brun-light">
                            {(item[f.key] as string) || "—"}
                          </span>
                        </div>
                      ) : (
                        <span>{String(item[f.key] ?? "—")}</span>
                      )}
                    </td>
                  ))}
                  {canWrite && (
                    <td className="px-5 py-2.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Modifier"
                          className="text-brun-light hover:text-orange transition-colors"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingItem(item)
                            setDeleteConfirmOpen(true)
                          }}
                          title="Supprimer"
                          className="text-brun-light hover:text-rose transition-colors"
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
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucun élément</p>
        </div>
      )}

      {/* Edit/Create panel */}
      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={isCreation ? `Ajouter` : `Modifier`}
        subtitle={title}
        footer={footer}
        width="sm"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
              {formError}
            </div>
          )}
          {fields.map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-brun mb-1">
                {f.label}
                {f.required && " *"}
              </label>
              {f.type === "color" ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={(formData[f.key] as string) || "#6B7280"}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                    className="w-10 h-10 rounded-lg border border-brun/10 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={(formData[f.key] as string) || ""}
                    onChange={(e) =>
                      setFormData((d) => ({ ...d, [f.key]: e.target.value }))
                    }
                    className={INPUT_CLASS}
                    placeholder="#RRGGBB"
                  />
                </div>
              ) : f.type === "number" ? (
                <input
                  type="number"
                  value={formData[f.key] ?? 0}
                  onChange={(e) =>
                    setFormData((d) => ({
                      ...d,
                      [f.key]: parseInt(e.target.value) || 0,
                    }))
                  }
                  className={INPUT_CLASS}
                />
              ) : (
                <input
                  type="text"
                  value={(formData[f.key] as string) || ""}
                  onChange={(e) =>
                    setFormData((d) => ({ ...d, [f.key]: e.target.value }))
                  }
                  className={INPUT_CLASS}
                  placeholder={f.placeholder}
                />
              )}
            </div>
          ))}
        </div>
      </SidePanel>

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Supprimer"
        message={`Êtes-vous sûr de vouloir supprimer "${deletingItem?.name}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteConfirmOpen(false)
          setDeletingItem(null)
        }}
      />
    </div>
  )
}
