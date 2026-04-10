"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import SidePanel from "@/components/SidePanel"
import ConfirmDialog from "@/components/ConfirmDialog"

// Lazy-load TipTap to avoid SSR issues
const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-24 bg-creme rounded-lg border border-brun/10 animate-pulse" />
  ),
})

// ----- Types -----

interface RefItem {
  id: string
  name: string
  color: string
  sort_order?: number
}

interface Note {
  id: string
  title: string
  content: string
  type_id: string | null
  family_id: string | null
  progress_id: string | null
  priority_id: string | null
  type: RefItem | null
  family: RefItem | null
  progress: RefItem | null
  priority: RefItem | null
  created_at: string
  updated_at: string
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

export default function NotesEvolutionPage() {
  const { hasRole } = useAuth()
  const isAdmin = hasRole("Admin global")
  const { showToast } = useToast()

  const [notes, setNotes] = useState<Note[]>([])
  const [statuses, setStatuses] = useState<RefItem[]>([])
  const [types, setTypes] = useState<RefItem[]>([])
  const [families, setFamilies] = useState<RefItem[]>([])
  const [priorities, setPriorities] = useState<RefItem[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterType, setFilterType] = useState("")
  const [filterFamily, setFilterFamily] = useState("")
  const [filterPriority, setFilterPriority] = useState("")
  const [searchInput, setSearchInput] = useState("")

  // Panel
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [formTitle, setFormTitle] = useState("")
  const [formContent, setFormContent] = useState("")
  const [formTypeId, setFormTypeId] = useState("")
  const [formFamilyId, setFormFamilyId] = useState("")
  const [formProgressId, setFormProgressId] = useState("")
  const [formPriorityId, setFormPriorityId] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletingNote, setDeletingNote] = useState<Note | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Drag state
  const [dragNoteId, setDragNoteId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [notesRes, statusRes, typeRes, familyRes, priorityRes] =
        await Promise.all([
          fetch("/api/notes"),
          fetch("/api/note-progress-statuses"),
          fetch("/api/note-types"),
          fetch("/api/note-families"),
          fetch("/api/note-priorities"),
        ])
      const [notesJson, statusJson, typeJson, familyJson, priorityJson] =
        await Promise.all([
          notesRes.json(),
          statusRes.json(),
          typeRes.json(),
          familyRes.json(),
          priorityRes.json(),
        ])
      setNotes(notesJson.data ?? [])
      setStatuses(
        (statusJson.data ?? []).sort(
          (a: RefItem, b: RefItem) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
      )
      setTypes(typeJson.data ?? [])
      setFamilies(familyJson.data ?? [])
      setPriorities(
        (priorityJson.data ?? []).sort(
          (a: RefItem, b: RefItem) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
        )
      )
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  // Filtered notes
  const filteredNotes = useMemo(() => {
    let filtered = notes
    if (filterType) filtered = filtered.filter((n) => n.type_id === filterType)
    if (filterFamily)
      filtered = filtered.filter((n) => n.family_id === filterFamily)
    if (filterPriority)
      filtered = filtered.filter((n) => n.priority_id === filterPriority)
    if (searchInput.trim()) {
      const s = searchInput.trim().toLowerCase()
      filtered = filtered.filter((n) =>
        n.title.toLowerCase().includes(s)
      )
    }
    return filtered
  }, [notes, filterType, filterFamily, filterPriority, searchInput])

  // Group by progress_id
  const notesByStatus = useMemo(() => {
    const map = new Map<string, Note[]>()
    for (const status of statuses) {
      map.set(
        status.id,
        filteredNotes
          .filter((n) => n.progress_id === status.id)
          .sort(
            (a, b) =>
              new Date(b.updated_at).getTime() -
              new Date(a.updated_at).getTime()
          )
      )
    }
    // Unclassified
    const unclassified = filteredNotes.filter(
      (n) => !n.progress_id || !statuses.some((s) => s.id === n.progress_id)
    )
    if (unclassified.length > 0) {
      map.set("__none__", unclassified)
    }
    return map
  }, [filteredNotes, statuses])

  // ----- Drag and drop between columns -----
  function handleDragStart(noteId: string) {
    setDragNoteId(noteId)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
  }

  async function handleDrop(statusId: string) {
    if (!dragNoteId) return
    setDragNoteId(null)

    // Optimistic update
    setNotes((prev) =>
      prev.map((n) =>
        n.id === dragNoteId ? { ...n, progress_id: statusId } : n
      )
    )

    try {
      const res = await fetch(`/api/notes/${dragNoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ progress_id: statusId }),
      })
      if (!res.ok) throw new Error("Erreur")
    } catch {
      showToast("Erreur lors du déplacement", "error")
      void loadData()
    }
  }

  // ----- CRUD -----
  function openCreate(progressId?: string) {
    setEditingNote(null)
    setFormTitle("")
    setFormContent("")
    setFormTypeId(types[0]?.id || "")
    setFormFamilyId(families[0]?.id || "")
    setFormProgressId(progressId || statuses[0]?.id || "")
    setFormPriorityId(priorities[0]?.id || "")
    setFormError(null)
    setPanelOpen(true)
  }

  function openEdit(note: Note) {
    setEditingNote(note)
    setFormTitle(note.title)
    setFormContent(note.content || "")
    setFormTypeId(note.type_id || "")
    setFormFamilyId(note.family_id || "")
    setFormProgressId(note.progress_id || "")
    setFormPriorityId(note.priority_id || "")
    setFormError(null)
    setPanelOpen(true)
  }

  async function handleSave() {
    setFormError(null)
    if (!formTitle.trim()) {
      setFormError("Le titre est obligatoire")
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: formTitle.trim(),
        content: formContent,
        type_id: formTypeId || null,
        family_id: formFamilyId || null,
        progress_id: formProgressId || null,
        priority_id: formPriorityId || null,
      }

      if (editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast("Note mise à jour.")
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur")
        showToast("Note créée.")
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
    if (!deletingNote) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/notes/${deletingNote.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Erreur")
      showToast("Note supprimée.")
      setDeleteOpen(false)
      setDeletingNote(null)
      void loadData()
    } catch {
      showToast("Erreur lors de la suppression", "error")
    } finally {
      setDeleting(false)
    }
  }

  // ----- Render -----
  const isCreation = !editingNote

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
        disabled={saving || !formTitle.trim()}
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
          <h1 className="font-serif text-3xl text-brun">
            Notes d&apos;évolution
          </h1>
          <p className="text-sm text-brun-light mt-1">
            Suivez les évolutions et les demandes
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => openCreate()}
            className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
          >
            + Nouvelle note
          </button>
        )}
      </header>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
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
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-2 py-1.5 pr-7 rounded-lg bg-white border border-brun/10 text-xs text-brun appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%236B7B6B%27><path fill-rule=%27evenodd%27 d=%27M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z%27 clip-rule=%27evenodd%27/></svg>')] bg-no-repeat bg-[right_0.4rem_center] bg-[length:0.85rem]"
        >
          <option value="">Tous les types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          value={filterFamily}
          onChange={(e) => setFilterFamily(e.target.value)}
          className="px-2 py-1.5 pr-7 rounded-lg bg-white border border-brun/10 text-xs text-brun appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%236B7B6B%27><path fill-rule=%27evenodd%27 d=%27M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z%27 clip-rule=%27evenodd%27/></svg>')] bg-no-repeat bg-[right_0.4rem_center] bg-[length:0.85rem]"
        >
          <option value="">Toutes les familles</option>
          {families.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value)}
          className="px-2 py-1.5 pr-7 rounded-lg bg-white border border-brun/10 text-xs text-brun appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 20 20%27 fill=%27%236B7B6B%27><path fill-rule=%27evenodd%27 d=%27M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z%27 clip-rule=%27evenodd%27/></svg>')] bg-no-repeat bg-[right_0.4rem_center] bg-[length:0.85rem]"
        >
          <option value="">Toutes les priorités</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {loading && (
        <p className="text-sm text-brun-light italic">Chargement...</p>
      )}

      {/* Kanban board */}
      {!loading && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {statuses.map((status) => {
            const columnNotes = notesByStatus.get(status.id) || []
            return (
              <div
                key={status.id}
                className="flex-shrink-0 w-72"
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(status.id)}
              >
                {/* Column header */}
                <div
                  className="rounded-t-xl px-4 py-2.5 flex items-center justify-between"
                  style={{ backgroundColor: status.color + "20" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: status.color }}
                    />
                    <span className="text-sm font-semibold text-brun">
                      {status.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-brun-light">
                      {columnNotes.length}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => openCreate(status.id)}
                        className="text-brun-light/40 hover:text-orange transition-colors"
                        title="Ajouter dans cette colonne"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div className="bg-creme/30 rounded-b-xl p-2 space-y-2 min-h-[100px]">
                  {columnNotes.map((note) => (
                    <div
                      key={note.id}
                      draggable={isAdmin}
                      onDragStart={() => handleDragStart(note.id)}
                      onClick={() => openEdit(note)}
                      className={`bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow ${
                        dragNoteId === note.id ? "opacity-40" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h4 className="text-sm font-medium text-brun line-clamp-2 flex-1">
                          {note.title}
                        </h4>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingNote(note)
                              setDeleteOpen(true)
                            }}
                            className="text-brun-light/30 hover:text-rose transition-colors flex-shrink-0"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {note.type && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] rounded font-medium"
                            style={{
                              backgroundColor: note.type.color + "20",
                              color: note.type.color,
                            }}
                          >
                            {note.type.name}
                          </span>
                        )}
                        {note.priority && (
                          <span
                            className="px-1.5 py-0.5 text-[10px] rounded font-medium"
                            style={{
                              backgroundColor: note.priority.color + "20",
                              color: note.priority.color,
                            }}
                          >
                            {note.priority.name}
                          </span>
                        )}
                        {note.family && (
                          <span className="px-1.5 py-0.5 text-[10px] rounded bg-brun/5 text-brun-light">
                            {note.family.name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Panel */}
      <SidePanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        title={isCreation ? "Nouvelle note" : "Modifier la note"}
        subtitle="Notes d'évolution"
        footer={footer}
        width="lg"
      >
        <div className="space-y-4">
          {formError && (
            <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
              {formError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-brun mb-1">
              Titre *
            </label>
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className={INPUT_CLASS}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-brun mb-1">
                Type
              </label>
              <select
                value={formTypeId}
                onChange={(e) => setFormTypeId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Aucun</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brun mb-1">
                Famille
              </label>
              <select
                value={formFamilyId}
                onChange={(e) => setFormFamilyId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Aucune</option>
                {families.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brun mb-1">
                Avancement
              </label>
              <select
                value={formProgressId}
                onChange={(e) => setFormProgressId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Aucun</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-brun mb-1">
                Priorité
              </label>
              <select
                value={formPriorityId}
                onChange={(e) => setFormPriorityId(e.target.value)}
                className={INPUT_CLASS}
              >
                <option value="">Aucune</option>
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-brun mb-1">
              Contenu
            </label>
            <RichTextEditor
              key={editingNote?.id || "new"}
              value={formContent}
              onChange={setFormContent}
              placeholder="Décrivez la note..."
              rows={8}
            />
          </div>
        </div>
      </SidePanel>

      <ConfirmDialog
        open={deleteOpen}
        title="Supprimer la note"
        message={`Êtes-vous sûr de vouloir supprimer "${deletingNote?.title}" ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteOpen(false)
          setDeletingNote(null)
        }}
      />
    </div>
  )
}
