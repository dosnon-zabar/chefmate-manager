"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import type { Role, Team, UserWithRoles } from "@/lib/types"
import SidePanel from "./SidePanel"

interface Props {
  open: boolean
  onClose: () => void
  /** null = creation, populated = edition */
  user: UserWithRoles | null
  /** Called after a successful save. */
  onSaved: () => void
}

/**
 * Slide-in side panel for creating / editing a user.
 *
 * Behaviour:
 *  - Creation mode → 2-step wizard:
 *      Step 1 = base infos + password (with confirmation always visible)
 *      Step 2 = global roles (Admin global only) and per-team roles
 *  - Edition mode → single page with everything visible
 *
 * Permission scoping:
 *  - The caller can edit team_roles only on the teams they manage as
 *    Team manager (or all teams if Admin global).
 *  - global_roles checkboxes are only shown if the caller is Admin global.
 *  - Other team roles on the target user are preserved untouched on save.
 */
export default function UserFormPanel({ open, onClose, user, onSaved }: Props) {
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
      // We keep the team in the map even with an empty set so the user can
      // see the team is selected but no role is granted yet (matches the
      // checkbox state).
      next.set(teamId, set)
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
    if (password && password.length < 6) {
      return "Le mot de passe doit contenir au moins 6 caractères"
    }
    if (password && password !== confirmPassword) return "Les mots de passe ne correspondent pas"
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

  // ----- Header chip + footer -----
  const titleAside =
    isCreation ? (
      <span className="text-xs font-normal text-brun-light bg-creme-dark px-2 py-1 rounded">
        Étape {step}/2
      </span>
    ) : null

  const footer = (
    <>
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
    </>
  )

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={isCreation ? "Nouvel utilisateur" : "Modifier l'utilisateur"}
      subtitle={
        isCreation
          ? step === 1
            ? "Informations de base"
            : "Rôles globaux et par équipe"
          : "Modifiez les informations et les rôles"
      }
      titleAside={titleAside}
      footer={footer}
      width="md"
    >
      <div className="space-y-5">
        {error && (
          <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* ================= Step 1 / Edit base infos ================= */}
        {(step === 1 || !isCreation) && (
          <>
            <div className="grid grid-cols-2 gap-3">
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
            </div>

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

            <div className="grid grid-cols-2 gap-3">
              <Field
                label={isCreation ? "Mot de passe" : "Nouveau mot de passe"}
                required={isCreation}
              >
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder={isCreation ? "" : "Laisser vide pour ne pas changer"}
                />
              </Field>
              <Field
                label="Confirmer le mot de passe"
                required={isCreation || password.length > 0}
              >
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

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

        {/* ================= Step 2 / Edit roles ================= */}
        {(step === 2 || !isCreation) && (
          <>
            {isCallerAdminGlobal && globalRoles.length > 0 && (
              <div className="border-t border-brun/10 pt-5">
                <h3 className="font-semibold text-brun mb-1">Rôles globaux</h3>
                <p className="text-xs text-brun-light mb-3">
                  S&apos;appliquent à toute la plateforme.
                </p>
                <div className="space-y-2">
                  {globalRoles.map((role) => (
                    <label key={role.id} className="flex items-start gap-2 text-sm cursor-pointer">
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

            <div className={isCallerAdminGlobal && globalRoles.length > 0 ? "border-t border-brun/10 pt-5" : ""}>
              <h3 className="font-semibold text-brun mb-1">Rôles par équipe</h3>
              <p className="text-xs text-brun-light mb-3">
                Sélectionnez l&apos;équipe puis les rôles à attribuer dessus.
              </p>

              {selectableTeams.length === 0 ? (
                <p className="text-xs text-brun-light italic">
                  Aucune équipe disponible.
                </p>
              ) : (
                <>
                  <div className="space-y-2 mb-3">
                    {selectableTeams.map((team) => {
                      const isMember = teamRoleNames.has(team.id)
                      return (
                        <label
                          key={team.id}
                          className="flex items-center gap-2 text-sm cursor-pointer"
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
                                    className="flex items-center gap-2 text-xs cursor-pointer"
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </SidePanel>
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
