"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { groupRolesByTeam, type UserStatus, type UserWithRoles } from "@/lib/types"
import UserFormPanel from "@/components/UserFormPanel"
import { useToast } from "@/components/Toaster"

// ----- Status presentation helpers -----
//
// Status management is an Admin global concern. The list page shows a
// colored badge on every user card so admins can spot inactive / deleted
// users at a glance, and they can flip the status directly from the card
// via a small native select. Non-admin callers only ever see active users
// (the API already enforces that server-side) and no status UI.

const STATUS_LABEL: Record<UserStatus, string> = {
  active: "Actif",
  inactive: "Inactif",
  deleted: "Supprimé",
}

const STATUS_BADGE_CLASS: Record<UserStatus, string> = {
  active: "bg-vert-eau/20 text-brun",
  inactive: "bg-brun/10 text-brun-light",
  deleted: "bg-rose/10 text-rose",
}

type StatusFilter = UserStatus | "all"

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "active", label: "Actifs" },
  { value: "inactive", label: "Inactifs" },
  { value: "deleted", label: "Supprimés" },
  { value: "all", label: "Tous" },
]

export default function UsersPage() {
  const { user: caller, hasRole } = useAuth()
  const isAdminGlobal = hasRole("Admin global")
  const { showToast } = useToast()

  // A Team manager on at least one team can also create users.
  const isTeamManagerSomewhere = useMemo(
    () =>
      (caller?.role_assignments ?? []).some(
        (a) => a.role === "Team manager" && a.teamId !== null
      ),
    [caller]
  )
  const canCreateUsers = isAdminGlobal || isTeamManagerSomewhere

  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Status filter is only relevant to Admin global. Default is "all"
  // so inactive/deleted users are visible out of the box — status
  // management is their job. Non-admins are hard-pinned to "active" at
  // fetch time anyway via effectiveStatus, so this default is harmless
  // for them (the filter UI is hidden).
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")

  // Search box value. The admin API's GET /users endpoint already
  // supports a `search` query param that ilike-matches on email,
  // first_name, and last_name. We debounce the input locally so every
  // keystroke doesn't hammer the API.
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setSearchTerm(searchInput.trim()), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  // Track per-user in-flight status updates so we can disable the select
  // during the roundtrip (prevents double-clicks from racing).
  const [pendingStatus, setPendingStatus] = useState<Set<string>>(new Set())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Admin global can ask for any status (or all); everyone else is
      // pinned to active because the API won't return anything else.
      const effectiveStatus: StatusFilter = isAdminGlobal ? statusFilter : "active"
      const params = new URLSearchParams()
      if (effectiveStatus !== "all") params.set("status", effectiveStatus)
      if (searchTerm) params.set("search", searchTerm)
      const qs = params.toString()
      const res = await fetch(`/api/users${qs ? `?${qs}` : ""}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setUsers(json.data ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setLoading(false)
    }
  }, [isAdminGlobal, statusFilter, searchTerm])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const openCreate = () => {
    setEditingUser(null)
    setDialogOpen(true)
  }

  const openEdit = (user: UserWithRoles) => {
    setEditingUser(user)
    setDialogOpen(true)
  }

  /**
   * Inline status change from the card. Admin global only. We PATCH the
   * user with the new status and either:
   *  - remove the card from the list if the new status no longer matches
   *    the active filter (e.g. switching to 'inactive' while filter is
   *    'active')
   *  - or update it in place if the filter is "all"
   *
   * On error, we revert the select by triggering a full refetch.
   */
  async function handleStatusChange(userId: string, newStatus: UserStatus) {
    setError(null)
    setPendingStatus((prev) => new Set(prev).add(userId))
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur de mise à jour")
      }

      setUsers((prev) => {
        if (statusFilter !== "all" && statusFilter !== newStatus) {
          // The card no longer matches the current filter → remove it.
          return prev.filter((u) => u.id !== userId)
        }
        return prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      })
      showToast(`Statut mis à jour : ${STATUS_LABEL[newStatus]}.`)
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur"
      showToast(msg, "error")
      void loadUsers()
    } finally {
      setPendingStatus((prev) => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
    }
  }

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Utilisateurs</h1>
          <p className="text-sm text-brun-light mt-1">
            Gérez les accès et les rôles des utilisateurs
          </p>
        </div>
        {canCreateUsers && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
          >
            + Nouvel utilisateur
          </button>
        )}
      </header>

      <div className="mb-6 space-y-3">
        {/* Search box — same filter works for everyone; the API does the
            ilike matching on email, first_name, last_name. */}
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
            placeholder="Rechercher par nom ou email..."
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {users.map((user) => {
          const groups = groupRolesByTeam(user)
          const isPending = pendingStatus.has(user.id)
          return (
            <div
              key={user.id}
              className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
              onClick={() => openEdit(user)}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg text-brun truncate">
                    {user.first_name} {user.last_name}
                  </h3>
                  <p className="text-xs text-brun-light truncate">{user.email}</p>
                  {user.phone && (
                    <p className="text-xs text-brun-light">{user.phone}</p>
                  )}
                </div>

                {/* Status corner — only visible to Admin global since
                    they're the only ones allowed to change it. Team
                    managers see no status UI at all (their API scope
                    only returns active users anyway). */}
                {isAdminGlobal && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex-shrink-0"
                  >
                    <select
                      value={user.status}
                      disabled={isPending}
                      onChange={(e) =>
                        handleStatusChange(user.id, e.target.value as UserStatus)
                      }
                      aria-label={`Statut de ${user.first_name} ${user.last_name}`}
                      className={`status-pill-select ${STATUS_BADGE_CLASS[user.status]}`}
                    >
                      <option value="active">Actif</option>
                      <option value="inactive">Inactif</option>
                      <option value="deleted">Supprimé</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-2 border-t border-brun/10 flex-1">
                {groups.globalRoles.length === 0 && groups.teamGroups.length === 0 ? (
                  <p className="text-xs text-brun-light italic">
                    Aucun rôle attribué
                  </p>
                ) : (
                  <>
                    {groups.globalRoles.length > 0 && (
                      <div>
                        <div className="text-[10px] font-semibold text-brun-light uppercase tracking-wide mb-1">
                          Global
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {groups.globalRoles.map((r) => (
                            <span
                              key={r}
                              className="inline-block px-2 py-0.5 text-xs rounded bg-orange/10 text-orange"
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {groups.teamGroups.map((g) => (
                      <div key={g.teamId}>
                        <div className="text-[10px] font-semibold text-brun-light uppercase tracking-wide mb-1">
                          {g.teamName}
                        </div>
                        {g.roles.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {g.roles.map((r) => (
                              <span
                                key={r}
                                className="inline-block px-2 py-0.5 text-xs rounded bg-vert-eau/20 text-brun"
                              >
                                {r}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-brun-light italic">
                            Membre sans rôle
                          </p>
                        )}
                      </div>
                    ))}
                  </>
                )}
              </div>

              {/* Footer actions */}
              <div className="mt-4 pt-3 border-t border-brun/10 flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    openEdit(user)
                  }}
                  className="inline-flex items-center gap-1.5 text-xs text-brun-light hover:text-orange transition-colors"
                  aria-label={`Modifier ${user.first_name} ${user.last_name}`}
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
                  Modifier
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {users.length === 0 && !loading && !error && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucun utilisateur</p>
        </div>
      )}

      <UserFormPanel
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        user={editingUser}
        onSaved={(message) => {
          setDialogOpen(false)
          if (message) showToast(message)
          void loadUsers()
        }}
      />
    </div>
  )
}
