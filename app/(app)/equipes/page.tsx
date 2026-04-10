"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"
import TeamFormPanel, {
  type TeamLifecycleStatus,
  type TeamRow,
} from "@/components/TeamFormPanel"
import TeamMemberRolesPanel from "@/components/TeamMemberRolesPanel"
import UserFormPanel from "@/components/UserFormPanel"
import TeamApiKeys from "@/components/TeamApiKeys"
import ConfirmDialog from "@/components/ConfirmDialog"

/** Sort role objects by the canonical display order (reuses the same
 *  ordering logic as ROLE_DISPLAY_ORDER in lib/types.ts). */
import { ROLE_DISPLAY_ORDER } from "@/lib/types"
function sortedRoles(roles: Array<{ id: string; name: string }>) {
  return [...roles].sort((a, b) => {
    const ia = ROLE_DISPLAY_ORDER.indexOf(a.name)
    const ib = ROLE_DISPLAY_ORDER.indexOf(b.name)
    const oa = ia === -1 ? ROLE_DISPLAY_ORDER.length : ia
    const ob = ib === -1 ? ROLE_DISPLAY_ORDER.length : ib
    if (oa !== ob) return oa - ob
    return a.name.localeCompare(b.name)
  })
}

// ----- Types -----

interface TeamMember {
  id: string
  first_name: string
  last_name: string
  email: string
  roles: Array<{ id: string; name: string }>
}

// ----- Status presentation -----

const STATUS_LABEL: Record<TeamLifecycleStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  deleted: "Supprimée",
}

const STATUS_BADGE_CLASS: Record<TeamLifecycleStatus, string> = {
  active: "bg-vert-eau/20 text-brun",
  inactive: "bg-brun/10 text-brun-light",
  deleted: "bg-rose/10 text-rose",
}

type StatusFilter = TeamLifecycleStatus | "all"

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Actives" },
  { value: "inactive", label: "Inactives" },
  { value: "deleted", label: "Supprimées" },
  { value: "all", label: "Toutes" },
]

export default function TeamsPage() {
  const { hasRole, can } = useAuth()
  const isAdminGlobal = hasRole("Admin global")
  const { showToast } = useToast()

  const [teams, setTeams] = useState<TeamRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  const [pendingStatus, setPendingStatus] = useState<Set<string>>(new Set())

  // Members per team { teamId: TeamMember[] }
  const [membersByTeam, setMembersByTeam] = useState<
    Record<string, TeamMember[]>
  >({})

  // Team edit/create panel
  const [teamPanelOpen, setTeamPanelOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<TeamRow | null>(null)

  // Member roles edit panel
  const [rolesPanelOpen, setRolesPanelOpen] = useState(false)
  const [editingMember, setEditingMember] = useState<{
    member: TeamMember
    teamId: string
    teamName: string
  } | null>(null)

  // User creation panel (add member flow, reuses the 3-step wizard)
  const [userPanelOpen, setUserPanelOpen] = useState(false)
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null)

  // Confirm dialog for removing a member
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [removingInfo, setRemovingInfo] = useState<{
    member: TeamMember
    teamId: string
  } | null>(null)
  const [removingLoading, setRemovingLoading] = useState(false)

  // Confirm dialog for destructive team status changes
  const [statusConfirmOpen, setStatusConfirmOpen] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<{
    teamId: string
    teamName: string
    newStatus: TeamLifecycleStatus
  } | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  const loadTeams = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const effectiveStatus: StatusFilter = isAdminGlobal
        ? statusFilter
        : "active"
      const params = new URLSearchParams()
      if (effectiveStatus !== "all") params.set("status", effectiveStatus)
      if (searchTerm) params.set("search", searchTerm)
      const qs = params.toString()
      const res = await fetch(`/api/teams${qs ? `?${qs}` : ""}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      const loaded = (json.data ?? []) as TeamRow[]
      setTeams(loaded)

      // Fetch members for each team in parallel
      const entries = await Promise.all(
        loaded.map(async (team) => {
          try {
            const mRes = await fetch(`/api/teams/${team.id}/members`)
            if (!mRes.ok) return [team.id, []] as const
            const mJson = await mRes.json()
            return [team.id, mJson.data ?? []] as const
          } catch {
            return [team.id, []] as const
          }
        })
      )
      setMembersByTeam(Object.fromEntries(entries))
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [isAdminGlobal, statusFilter, searchTerm])

  useEffect(() => {
    void loadTeams()
  }, [loadTeams])

  /** Reload members for a single team without reloading the whole page. */
  async function refreshTeamMembers(teamId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/members`)
      if (!res.ok) return
      const json = await res.json()
      setMembersByTeam((prev) => ({
        ...prev,
        [teamId]: json.data ?? [],
      }))
    } catch {
      // silent
    }
  }

  const openCreate = () => {
    setEditingTeam(null)
    setTeamPanelOpen(true)
  }

  const openEditTeam = (team: TeamRow) => {
    setEditingTeam(team)
    setTeamPanelOpen(true)
  }

  function openEditRoles(member: TeamMember, team: TeamRow) {
    setEditingMember({
      member,
      teamId: team.id,
      teamName: team.name,
    })
    setRolesPanelOpen(true)
  }

  function openAddMember(teamId: string) {
    setAddMemberTeamId(teamId)
    setUserPanelOpen(true)
  }

  function openRemoveConfirm(member: TeamMember, teamId: string) {
    setRemovingInfo({ member, teamId })
    setConfirmOpen(true)
  }

  async function handleRemoveMember() {
    if (!removingInfo) return
    setRemovingLoading(true)
    try {
      const res = await fetch(
        `/api/teams/${removingInfo.teamId}/members/${removingInfo.member.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      showToast(
        `${removingInfo.member.first_name} ${removingInfo.member.last_name} a été retiré de l'équipe.`
      )
      setConfirmOpen(false)
      setRemovingInfo(null)
      await refreshTeamMembers(removingInfo.teamId)
      // Also reload teams to update member_count
      void loadTeams()
    } catch (e) {
      showToast(
        e instanceof Error ? e.message : "Erreur",
        "error"
      )
    } finally {
      setRemovingLoading(false)
    }
  }

  /**
   * Called from the status select onChange. For destructive transitions
   * (deleted, inactive), we intercept and show a confirmation dialog
   * before actually running the PATCH.
   */
  function requestStatusChange(
    teamId: string,
    teamName: string,
    newStatus: TeamLifecycleStatus
  ) {
    if (newStatus === "deleted" || newStatus === "inactive") {
      setPendingStatusChange({ teamId, teamName, newStatus })
      setStatusConfirmOpen(true)
      return
    }
    void executeStatusChange(teamId, newStatus)
  }

  async function executeStatusChange(
    teamId: string,
    newStatus: TeamLifecycleStatus
  ) {
    setError(null)
    setPendingStatus((prev) => new Set(prev).add(teamId))
    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lifecycle_status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur de mise à jour")
      }
      setTeams((prev) => {
        if (statusFilter !== "all" && statusFilter !== newStatus) {
          return prev.filter((t) => t.id !== teamId)
        }
        return prev.map((t) =>
          t.id === teamId
            ? { ...t, lifecycle_status: newStatus, member_count: newStatus === "deleted" ? 0 : t.member_count }
            : t
        )
      })
      // Refresh members for this team: if deleted, the backend
      // cascaded (detached all members), so the list should be empty.
      // For inactive→active transitions, members may have changed too.
      void refreshTeamMembers(teamId)
      showToast(`Statut mis à jour : ${STATUS_LABEL[newStatus]}.`)
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
      void loadTeams()
    } finally {
      setPendingStatus((prev) => {
        const next = new Set(prev)
        next.delete(teamId)
        return next
      })
    }
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Équipes</h1>
          <p className="text-sm text-brun-light mt-1">
            Gérez les équipes et leurs membres
          </p>
        </div>
        {isAdminGlobal && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
          >
            + Nouvelle équipe
          </button>
        )}
      </header>

      <div className="mb-6 space-y-3">
        {/* Search */}
        <div className="relative max-w-md">
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
            placeholder="Rechercher par nom..."
            className="w-full pl-9 pr-9 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label="Effacer la recherche"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-brun-light hover:text-brun text-sm px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status filter pills — Admin global only */}
        {isAdminGlobal && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-brun-light uppercase tracking-wide mr-1">
              Statut
            </span>
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStatusFilter(f.value)}
                  className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                    active
                      ? "bg-orange text-white border-orange"
                      : "bg-white text-brun border-brun/10 hover:border-orange/40"
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
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

      {/* Team cards — one per team, with inline member table */}
      <div className="space-y-4">
        {teams.map((team) => {
          const isPending = pendingStatus.has(team.id)
          const members = membersByTeam[team.id] ?? []
          return (
            <div
              key={team.id}
              className="bg-white rounded-2xl shadow-sm overflow-hidden"
            >
              {/* Team header */}
              <div className="p-5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-serif text-lg text-brun truncate">
                      {team.name}
                    </h3>
                    {/* Edit team — next to the title */}
                    <button
                      type="button"
                      onClick={() => openEditTeam(team)}
                      className="text-brun-light hover:text-orange transition-colors flex-shrink-0"
                      aria-label={`Modifier ${team.name}`}
                      title="Modifier l'équipe"
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
                  </div>
                  {team.description && (
                    <p className="text-xs text-brun-light line-clamp-2 mt-1">
                      {team.description}
                    </p>
                  )}
                </div>

                {/* Status — Admin global only */}
                {isAdminGlobal && (
                  <div className="flex-shrink-0">
                    <select
                      value={team.lifecycle_status}
                      disabled={isPending}
                      onChange={(e) =>
                        requestStatusChange(
                          team.id,
                          team.name,
                          e.target.value as TeamLifecycleStatus
                        )
                      }
                      aria-label={`Statut de ${team.name}`}
                      className={`status-pill-select ${STATUS_BADGE_CLASS[team.lifecycle_status]}`}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="deleted">Supprimée</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Members table */}
              <div className="border-t border-brun/5">
                <div className="px-5 py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-brun-light uppercase tracking-wide">
                    Membres ({members.length})
                  </span>
                  {team.lifecycle_status === "active" && (
                    <button
                      type="button"
                      onClick={() => openAddMember(team.id)}
                      className="text-xs text-orange hover:text-orange-light font-medium transition-colors"
                    >
                      + Ajouter un membre
                    </button>
                  )}
                </div>
                {members.length === 0 ? (
                  <p className="px-5 pb-4 text-xs text-brun-light italic">
                    Aucun membre
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-creme/50 text-[11px] font-semibold text-brun-light uppercase tracking-wide">
                        <th className="text-left px-5 py-2">Prénom</th>
                        <th className="text-left px-5 py-2">Nom</th>
                        <th className="text-left px-5 py-2">Email</th>
                        <th className="text-left px-5 py-2">Rôles</th>
                        <th className="text-right px-5 py-2 w-24">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((member, idx) => (
                        <tr
                          key={member.id}
                          className={
                            idx % 2 === 0 ? "bg-white" : "bg-creme/30"
                          }
                        >
                          <td className="px-5 py-2.5 text-brun">
                            {member.first_name}
                          </td>
                          <td className="px-5 py-2.5 text-brun">
                            {member.last_name}
                          </td>
                          <td className="px-5 py-2.5 text-brun-light text-xs">
                            {member.email}
                          </td>
                          <td className="px-5 py-2.5">
                            {member.roles.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {sortedRoles(member.roles).map((role) => (
                                  <span
                                    key={role.id}
                                    className="inline-block px-1.5 py-0.5 text-[10px] rounded bg-vert-eau/20 text-brun whitespace-nowrap"
                                  >
                                    {role.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[10px] text-brun-light italic">
                                Aucun rôle
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Edit roles */}
                              <button
                                type="button"
                                onClick={() => openEditRoles(member, team)}
                                disabled={team.lifecycle_status !== "active"}
                                title="Modifier les rôles"
                                className="text-brun-light hover:text-orange transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-brun-light"
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
                              {/* Remove member */}
                              <button
                                type="button"
                                onClick={() =>
                                  openRemoveConfirm(member, team.id)
                                }
                                disabled={team.lifecycle_status !== "active"}
                                title="Retirer de l'équipe"
                                className="text-brun-light hover:text-rose transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-brun-light"
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* API keys section — only for callers who can manage them
                  (Admin global, or Team manager + Website manager on this team). */}
              {can("read", "api_key", { ownerTeamIds: [team.id] }) && (
                <TeamApiKeys teamId={team.id} />
              )}
            </div>
          )
        })}
      </div>

      {teams.length === 0 && !loading && !error && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucune équipe</p>
        </div>
      )}

      {/* Team edit/create panel */}
      <TeamFormPanel
        open={teamPanelOpen}
        onClose={() => setTeamPanelOpen(false)}
        team={editingTeam}
        onSaved={(message) => {
          setTeamPanelOpen(false)
          if (message) showToast(message)
          void loadTeams()
        }}
      />

      {/* Member roles edit panel */}
      <TeamMemberRolesPanel
        open={rolesPanelOpen}
        onClose={() => setRolesPanelOpen(false)}
        member={editingMember?.member ?? null}
        teamId={editingMember?.teamId ?? null}
        teamName={editingMember?.teamName ?? null}
        currentRoles={
          editingMember?.member.roles.map((r) => r.name) ?? []
        }
        onSaved={(message) => {
          setRolesPanelOpen(false)
          if (message) showToast(message)
          if (editingMember) {
            void refreshTeamMembers(editingMember.teamId)
          }
        }}
      />

      {/* Confirm dialog for removing a member */}
      {/* User creation panel — add member via the standard 3-step wizard,
          scoped to the target team (no global roles, no team selection). */}
      <UserFormPanel
        open={userPanelOpen}
        onClose={() => {
          setUserPanelOpen(false)
          setAddMemberTeamId(null)
        }}
        user={null}
        onSaved={(message) => {
          setUserPanelOpen(false)
          if (message) showToast(message)
          if (addMemberTeamId) void refreshTeamMembers(addMemberTeamId)
          setAddMemberTeamId(null)
          void loadTeams()
        }}
        preselectedTeamId={addMemberTeamId}
      />

      {/* Confirm dialog for destructive team status changes */}
      <ConfirmDialog
        open={statusConfirmOpen}
        title={
          pendingStatusChange?.newStatus === "deleted"
            ? "Supprimer l'équipe"
            : "Désactiver l'équipe"
        }
        message={
          pendingStatusChange?.newStatus === "deleted"
            ? `Êtes-vous sûr de vouloir supprimer "${pendingStatusChange?.teamName}" ? Les clés API seront révoquées et tous les membres seront détachés. Cette action est difficilement réversible.`
            : `Êtes-vous sûr de vouloir désactiver "${pendingStatusChange?.teamName}" ? Les clés API cesseront de fonctionner tant que l'équipe sera inactive.`
        }
        confirmLabel={
          pendingStatusChange?.newStatus === "deleted"
            ? "Supprimer"
            : "Désactiver"
        }
        variant={
          pendingStatusChange?.newStatus === "deleted" ? "danger" : "warning"
        }
        onConfirm={() => {
          if (pendingStatusChange) {
            setStatusConfirmOpen(false)
            void executeStatusChange(
              pendingStatusChange.teamId,
              pendingStatusChange.newStatus
            )
            setPendingStatusChange(null)
          }
        }}
        onCancel={() => {
          setStatusConfirmOpen(false)
          setPendingStatusChange(null)
        }}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Retirer le membre"
        message={
          removingInfo
            ? `Êtes-vous sûr de vouloir retirer ${removingInfo.member.first_name} ${removingInfo.member.last_name} de cette équipe ? Ses rôles sur cette équipe seront également supprimés.`
            : ""
        }
        confirmLabel="Retirer"
        variant="danger"
        loading={removingLoading}
        onConfirm={handleRemoveMember}
        onCancel={() => {
          setConfirmOpen(false)
          setRemovingInfo(null)
        }}
      />
    </div>
  )
}
