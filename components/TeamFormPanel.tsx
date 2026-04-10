"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import SidePanel from "./SidePanel"

export type TeamLifecycleStatus = "active" | "inactive" | "deleted"

export interface TeamRow {
  id: string
  name: string
  description: string | null
  sort_order: number
  lifecycle_status: TeamLifecycleStatus
  member_count: number
  created_at: string
  updated_at: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** null = creation, populated = edition */
  team: TeamRow | null
  onSaved: (message?: string) => void
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

/**
 * Slide-in side panel for creating / editing a team's core info
 * (name, description, lifecycle_status).
 *
 * Members are managed inline on the team card — not in this panel.
 */
export default function TeamFormPanel({
  open,
  onClose,
  team,
  onSaved,
}: Props) {
  const { hasRole } = useAuth()
  const isCallerAdminGlobal = hasRole("Admin global")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [lifecycleStatus, setLifecycleStatus] =
    useState<TeamLifecycleStatus>("active")

  const isCreation = !team

  useEffect(() => {
    if (!open) return
    setError(null)
    if (team) {
      setName(team.name)
      setDescription(team.description || "")
      setLifecycleStatus(team.lifecycle_status)
    } else {
      setName("")
      setDescription("")
      setLifecycleStatus("active")
    }
  }, [open, team])

  const nameValid = name.trim().length > 0

  async function handleSave() {
    setError(null)
    if (!nameValid) {
      setError("Le nom est obligatoire")
      return
    }

    setSaving(true)
    try {
      if (isCreation) {
        const res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || null,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur création")
        onSaved(`L'équipe "${name.trim()}" a été créée.`)
      } else {
        const body: Record<string, unknown> = {
          name: name.trim(),
          description: description.trim() || null,
        }
        if (isCallerAdminGlobal) {
          body.lifecycle_status = lifecycleStatus
        }
        const res = await fetch(`/api/teams/${team.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur mise à jour")
        onSaved(`L'équipe "${name.trim()}" a été mise à jour.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !nameValid}
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
    <SidePanel
      open={open}
      onClose={onClose}
      title={isCreation ? "Nouvelle équipe" : "Modifier l'équipe"}
      subtitle={
        isCreation
          ? "Renseignez les informations de l'équipe"
          : "Modifiez les informations de l'équipe"
      }
      footer={footer}
      width="md"
    >
      <div className="space-y-5">
        {error && (
          <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <Field label="Nom" required>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={INPUT_CLASS}
            autoFocus
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={INPUT_CLASS}
            placeholder="Optionnel"
          />
        </Field>

        {!isCreation && isCallerAdminGlobal && (
          <Field label="Statut">
            <select
              value={lifecycleStatus}
              onChange={(e) =>
                setLifecycleStatus(
                  e.target.value as TeamLifecycleStatus
                )
              }
              className={INPUT_CLASS}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="deleted">Supprimée</option>
            </select>
          </Field>
        )}
      </div>
    </SidePanel>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brun mb-1">
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  )
}
