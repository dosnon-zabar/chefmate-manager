"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { groupRolesByTeam, type UserWithRoles } from "@/lib/types"
import UserFormPanel from "@/components/UserFormPanel"

export default function UsersPage() {
  const { hasRole } = useAuth()
  const isAdminGlobal = hasRole("Admin global")

  const [users, setUsers] = useState<UserWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserWithRoles | null>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/users?status=active")
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
  }, [])

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

  return (
    <div>
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-brun">Utilisateurs</h1>
          <p className="text-sm text-brun-light mt-1">
            Gérez les accès et les rôles des utilisateurs
          </p>
        </div>
        {isAdminGlobal && (
          <button
            onClick={openCreate}
            className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
          >
            + Nouvel utilisateur
          </button>
        )}
      </header>

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
          return (
            <div
              key={user.id}
              className="bg-white rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow cursor-pointer flex flex-col"
              onClick={() => openEdit(user)}
            >
              <div className="mb-3">
                <h3 className="font-serif text-lg text-brun">
                  {user.first_name} {user.last_name}
                </h3>
                <p className="text-xs text-brun-light">{user.email}</p>
                {user.phone && (
                  <p className="text-xs text-brun-light">{user.phone}</p>
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
        onSaved={() => {
          setDialogOpen(false)
          void loadUsers()
        }}
      />
    </div>
  )
}
