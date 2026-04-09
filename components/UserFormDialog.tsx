"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import type { Role, Team, UserWithRoles } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  /** null = creation, populated = edition */
  user: UserWithRoles | null
  /** Called after a successful save. */
  onSaved: () => void
}

/**
 * Create / edit dialog for a user. Supports:
 *  - base infos (first_name, last_name, email, phone, password)
 *  - status (active/inactive/deleted)
 *  - global roles (Admin global caller only)
 *  - team roles (only on teams the caller manages, scoped by their role assignments)
 *
 * In create mode, a simple 2-step wizard: infos → roles.
 * In edit mode, everything is on one page.
 */
export default function UserFormDialog({ open, onClose, user, onSaved }: Props) {
  const { user: caller, hasRole } = useAuth()
  const isCallerAdminGlobal = hasRole("Admin global")

  const callerManagedTeamIds = useMemo<Set<string> | "ALL">(() => {
    if (isCallerAdminGlobal) return "ALL"
    const ids = new Set<string>()
    for (const a of caller?.role_assignments ?? []) {
      if (a.role === "Team manager" && a.teamId !== null) ids.add(a.teamId)
    }
    return ids
  }, [caller, isCallerAdminGlobal])

  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Base infos
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState<"active" | "inactive" | "deleted">("active")

  // Roles
  const [roles, setRoles] = useState<Role[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [globalRoleNames, setGlobalRoleNames] = useState<Set<string>>(new Set())
  const [teamRoleNames, setTeamRoleNames] = useState<Map<string, Set<string>>>(new Map())

  const isCreation = !user

  useEffect(() => {
    if (!open) return
    setStep(1)
    setError(null)
    setPassword("")
    setConfirmPassword("")
    // Load reference data
    Promise.all([
      fetch("/api/roles").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/teams").then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([rolesJson, teamsJson]) => {
        setRoles(rolesJson.data || [])
        setTeams(teamsJson.data || [])
      })
      .catch(() => setError("Impossible de charger les rôles et équipes"))

    if (user) {
      setFirstName(user.first_name)
      setLastName(user.last_name)
      setEmail(user.email)
      setPhone(user.phone ?? "")
      setStatus(user.status)

      const globals = new Set<string>()
      const teamMap = new Map<string, Set<string>>()
      for (const ur of user.user_roles) {
        const roleName = ur.role?.name
        if (!roleName) continue
        if (ur.team_id === null) {
          globals.add(roleName)
        } else {
          const set = teamMap.get(ur.team_id) ?? new Set<string>()
          set.add(roleName)
          teamMap.set(ur.team_id, set)
        }
      }
      setGlobalRoleNames(globals)
      setTeamRoleNames(teamMap)
    } else {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setStatus("active")
      setGlobalRoleNames(new Set())
      setTeamRoleNames(new Map())
    }
  }, [open, user])

  const globalRoles = useMemo(() => roles.filter((r) => r.scope === "global"), [roles])
  const teamScopedRoles = useMemo(() => roles.filter((r) => r.scope === "team"), [roles])

  const selectableTeams = useMemo(() => {
    if (callerManagedTeamIds === "ALL") return teams
    return teams.filter((t) => callerManagedTeamIds.has(t.id))
  }, [teams, callerManagedTeamIds])

  function toggleGlobalRole(name: string) {
    setGlobalRoleNames((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  function toggleTeamRole(teamId: string, name: string) {
    setTeamRoleNames((prev) => {
      const next = new Map(prev)
      const set = new Set(next.get(teamId) ?? [])
      if (set.has(name)) set.delete(name)
      else set.add(name)
      if (set.size === 0) next.delete(teamId)
      else next.set(teamId, set)
      return next
    })
  }

  function toggleTeamMembership(teamId: string) {
    setTeamRoleNames((prev) => {
      const next = new Map(prev)
      if (next.has(teamId)) next.delete(teamId)
      else next.set(teamId, new Set())
      return next
    })
  }

  function validateStep1(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Prénom et nom obligatoires"
    if (!email.trim()) return "Email obligatoire"
    if (isCreation && !password) return "Mot de passe obligatoire pour un nouvel utilisateur"
    if (password && password !== confirmPassword) return "Les mots de passe ne correspondent pas"
    if (password && password.length < 6) return "Le mot de passe doit contenir au moins 6 caractères"
    return null
  }

  async function handleSave() {
    setError(null)
    const err = validateStep1()
    if (err) {
      setError(err)
      setStep(1)
      return
    }

    setSaving(true)
    try {
      let userId = user?.id

      if (isCreation) {
        // Admin global only (the API enforces it).
        const createRes = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            email: email.trim(),
            phone: phone.trim() || null,
            password,
          }),
        })
        const createJson = await createRes.json().catch(() => ({}))
        if (!createRes.ok) throw new Error(createJson.error || "Erreur création")
        userId = createJson.data.id
      }

      // Then PATCH to apply infos (again in edit), status, password change, and roles.
      if (!userId) throw new Error("User id manquant")
      const patchBody: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
      }
      if (!isCreation) {
        patchBody.status = status
        if (password) patchBody.password = password
      }
      if (isCallerAdminGlobal) {
        patchBody.global_roles = Array.from(globalRoleNames)
      }
      const teamRoleObj: Record<string, string[]> = {}
      for (const [teamId, set] of teamRoleNames.entries()) {
        if (callerManagedTeamIds !== "ALL" && !callerManagedTeamIds.has(teamId)) continue
        teamRoleObj[teamId] = Array.from(set)
      }
      patchBody.team_roles = teamRoleObj

      const patchRes = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      })
      const patchJson = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) throw new Error(patchJson.error || "Erreur mise à jour")

      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-brun/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-brun/10">
          <h2 className="font-serif text-2xl text-brun">
            {isCreation ? "Nouvel utilisateur" : "Modifier l'utilisateur"}
            {isCreation && (
              <span className="ml-2 text-xs text-brun-light">(étape {step}/2)</span>
            )}
          </h2>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">{error}</div>
          )}

          {(step === 1 || !isCreation) && (
            <>
              <Field label="Prénom" required>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Nom" required>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Email" required>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Téléphone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label={isCreation ? "Mot de passe (requis)" : "Nouveau mot de passe (optionnel)"}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder={isCreation ? "" : "Laisser vide pour ne pas changer"}
                />
              </Field>
              {password && (
                <Field label="Confirmer le mot de passe" required>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </Field>
              )}
              {!isCreation && (
                <Field label="Statut">
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as typeof status)}
                    className={INPUT_CLASS}
                  >
                    <option value="active">Actif</option>
                    <option value="inactive">Inactif</option>
                    {isCallerAdminGlobal && <option value="deleted">Supprimé</option>}
                  </select>
                </Field>
              )}
            </>
          )}

          {(step === 2 || !isCreation) && (
            <>
              {isCallerAdminGlobal && globalRoles.length > 0 && (
                <div className="border-t border-brun/10 pt-4">
                  <h3 className="font-semibold text-brun mb-2">Rôles globaux</h3>
                  <p className="text-xs text-brun-light mb-3">
                    Ces rôles s&apos;appliquent à toute la plateforme, sans notion d&apos;équipe.
                  </p>
                  <div className="space-y-2">
                    {globalRoles.map((role) => (
                      <label key={role.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={globalRoleNames.has(role.name)}
                          onChange={() => toggleGlobalRole(role.name)}
                          className="mt-0.5"
                        />
                        <span>
                          <span className="font-medium">{role.name}</span>
                          {role.description && (
                            <span className="text-brun-light ml-1">— {role.description}</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-brun/10 pt-4">
                <h3 className="font-semibold text-brun mb-2">Rôles par équipe</h3>
                <p className="text-xs text-brun-light mb-3">
                  Sélectionnez les équipes concernées, puis les rôles pour chacune.
                </p>

                <div className="space-y-2 mb-3">
                  {selectableTeams.map((team) => {
                    const isMember = teamRoleNames.has(team.id)
                    return (
                      <label
                        key={team.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={isMember}
                          onChange={() => toggleTeamMembership(team.id)}
                        />
                        <span className="font-medium">{team.name}</span>
                      </label>
                    )
                  })}
                </div>

                {Array.from(teamRoleNames.keys()).length > 0 && (
                  <div className="space-y-4 bg-creme rounded-lg p-3">
                    {Array.from(teamRoleNames.entries())
                      .filter(
                        ([teamId]) =>
                          callerManagedTeamIds === "ALL" ||
                          callerManagedTeamIds.has(teamId)
                      )
                      .map(([teamId, set]) => {
                        const team = teams.find((t) => t.id === teamId)
                        if (!team) return null
                        return (
                          <div key={teamId}>
                            <div className="text-xs font-semibold text-brun mb-2">
                              {team.name}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              {teamScopedRoles.map((role) => (
                                <label
                                  key={role.id}
                                  className="flex items-center gap-2 text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={set.has(role.name)}
                                    onChange={() => toggleTeamRole(teamId, role.name)}
                                  />
                                  <span>{role.name}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-brun/10 flex justify-end gap-3">
          {isCreation && step === 2 && (
            <button
              type="button"
              onClick={() => setStep(1)}
              disabled={saving}
              className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
            >
              Précédent
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
          >
            Annuler
          </button>
          {isCreation && step === 1 ? (
            <button
              type="button"
              onClick={() => {
                const err = validateStep1()
                if (err) setError(err)
                else {
                  setError(null)
                  setStep(2)
                }
              }}
              disabled={saving}
              className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
            >
              Suivant
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : isCreation ? "Créer" : "Enregistrer"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

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
