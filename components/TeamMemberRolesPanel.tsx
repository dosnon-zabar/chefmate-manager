"use client"

import { useEffect, useState } from "react"
import type { Role } from "@/lib/types"
import SidePanel from "./SidePanel"

interface Props {
  open: boolean
  onClose: () => void
  member: { id: string; first_name: string; last_name: string; email: string } | null
  teamId: string | null
  teamName: string | null
  /** Current role names for this member on this team. */
  currentRoles: string[]
  onSaved: (message?: string) => void
}

/**
 * Small side panel to edit the team-scoped roles of a single member
 * on a single team. Uses PATCH /api/users/[id] with
 * team_roles: { [teamId]: selectedRoles } which respects all existing
 * permission and scope rules.
 */
export default function TeamMemberRolesPanel({
  open,
  onClose,
  member,
  teamId,
  teamName,
  currentRoles,
  onSaved,
}: Props) {
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSelected(new Set(currentRoles))
    // Fetch team-scoped roles
    fetch("/api/roles")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => {
        const teamRoles = (json.data || []).filter(
          (r: Role) => r.scope === "team"
        )
        setAllRoles(teamRoles)
      })
      .catch(() => setAllRoles([]))
  }, [open, currentRoles])

  function toggleRole(name: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function handleSave() {
    if (!member || !teamId) return
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/users/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team_roles: { [teamId]: Array.from(selected) },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur mise à jour")
      onSaved(
        `Rôles de ${member.first_name} ${member.last_name} mis à jour.`
      )
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
        disabled={saving}
        className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? "Enregistrement..." : "Enregistrer"}
      </button>
    </>
  )

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={
        member
          ? `${member.first_name} ${member.last_name}`
          : "Rôles du membre"
      }
      subtitle={teamName ? `Rôles sur ${teamName}` : "Rôles sur l'équipe"}
      footer={footer}
      width="sm"
    >
      <div className="space-y-4">
        {error && (
          <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {member && (
          <div className="bg-creme rounded-lg px-3 py-2 text-xs text-brun-light">
            {member.email}
          </div>
        )}

        {allRoles.length === 0 ? (
          <p className="text-xs text-brun-light italic">
            Aucun rôle d&apos;équipe disponible.
          </p>
        ) : (
          <div className="space-y-2">
            {allRoles.map((role) => (
              <label
                key={role.id}
                className="flex items-start gap-2 text-sm cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selected.has(role.name)}
                  onChange={() => toggleRole(role.name)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{role.name}</span>
                  {role.description && (
                    <span className="text-brun-light ml-1">
                      — {role.description}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  )
}
