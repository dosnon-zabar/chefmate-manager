"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import type { Role, Team, UserWithRoles } from "@/lib/types"
import SidePanel from "./SidePanel"

interface Props {
  open: boolean
  onClose: () => void
  /** null = creation, populated = edition */
  user: UserWithRoles | null
  /**
   * Called after a successful save. The optional `message` argument
   * is a human-readable confirmation to display (e.g. "X a été ajouté
   * à vos équipes"). When `undefined`, the caller can decide whether
   * to show a generic toast.
   */
  onSaved: (message?: string) => void
}

/**
 * Slide-in side panel for creating / editing a user.
 *
 * Behaviour:
 *  - Creation mode → 3-step wizard:
 *      Step 1 = email only. Clicking "Suivant" hits
 *               GET /api/users/by-email to check existence.
 *               * If no user with that email → step 2.
 *               * If a user exists → we skip directly to step 3 (roles),
 *                 pre-filled with the existing user's infos. The save
 *                 becomes an upsert that also reactivates the user if
 *                 they were inactive/deleted.
 *      Step 2 = name + phone + password (only for fresh creations)
 *      Step 3 = global roles (Admin global only) and per-team roles
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

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // When step 1 finds a matching email, we stash the existing user's id
  // and status here. This flags the wizard as "upsert" (skip step 2) and
  // lets us decide whether we need to send status='active' to reactivate.
  const [existingUserId, setExistingUserId] = useState<string | null>(null)
  const [existingUserStatus, setExistingUserStatus] = useState<
    "active" | "inactive" | "deleted" | null
  >(null)

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

  // Snapshot of the team memberships the target user had when the panel
  // opened. Used in edit mode to compute which teams must be detached at
  // save time (initial - current). Only meaningful for teams the caller
  // can touch.
  const initialTeamIdsRef = useRef<Set<string>>(new Set())

  const isCreation = !user

  useEffect(() => {
    if (!open) return
    setStep(1)
    setError(null)
    setPassword("")
    setConfirmPassword("")
    setExistingUserId(null)
    setExistingUserStatus(null)
    Promise.all([
      fetch("/api/roles").then((r) => (r.ok ? r.json() : { data: [] })),
      fetch("/api/teams").then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([rolesJson, teamsJson]) => {
        setRoles(rolesJson.data || [])
        setTeams(teamsJson.data || [])

        // ---- Creation mode: auto-select the single managed team ----
        // If the caller is not Admin global and has exactly one managed
        // team, preselect it so they don't need to tick it.
        if (!user && callerManagedTeamIds !== "ALL" && callerManagedTeamIds.size === 1) {
          const singleTeamId = Array.from(callerManagedTeamIds)[0]
          setTeamRoleNames(new Map([[singleTeamId, new Set<string>()]]))
        }
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

      // Seed with team-scoped roles first
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

      // Also seed bare memberships (user_teams without any team-scoped
      // role). Those show up as "member without role" in the UI and must
      // have their checkbox ticked so the user can explicitly untick them
      // to detach the membership.
      for (const ut of user.user_teams || []) {
        if (!ut.team) continue
        if (!teamMap.has(ut.team.id)) {
          teamMap.set(ut.team.id, new Set<string>())
        }
      }

      setGlobalRoleNames(globals)
      setTeamRoleNames(teamMap)
      initialTeamIdsRef.current = new Set(teamMap.keys())
    } else {
      setFirstName("")
      setLastName("")
      setEmail("")
      setPhone("")
      setStatus("active")
      setGlobalRoleNames(new Set())
      initialTeamIdsRef.current = new Set()
      // teamRoleNames is seeded above (auto-select single team) if applicable.
    }
  }, [open, user, callerManagedTeamIds])

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

  // ---- Validation per step ----

  function isValidEmail(value: string): boolean {
    // Minimal sanity check. The server is the source of truth.
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  }

  function validateStep1Email(): string | null {
    if (!email.trim()) return "Email obligatoire"
    if (!isValidEmail(email)) return "Email invalide"
    return null
  }

  function validateStep2Infos(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Prénom et nom obligatoires"
    if (!password) return "Mot de passe obligatoire pour un nouvel utilisateur"
    if (password.length < 6) {
      return "Le mot de passe doit contenir au moins 6 caractères"
    }
    if (password !== confirmPassword) return "Les mots de passe ne correspondent pas"
    return null
  }

  /**
   * Edit mode validator — used by the single-page edit form and by
   * handleSave() to gate the final PATCH call. Passwords are only
   * validated when the user actually typed one.
   */
  function validateEditForm(): string | null {
    if (!firstName.trim() || !lastName.trim()) return "Prénom et nom obligatoires"
    if (!email.trim()) return "Email obligatoire"
    if (password && password.length < 6) {
      return "Le mot de passe doit contenir au moins 6 caractères"
    }
    if (password && password !== confirmPassword) {
      return "Les mots de passe ne correspondent pas"
    }
    return null
  }

  /**
   * Handle the "Suivant" button on step 1. Calls the by-email endpoint
   * and either jumps to step 2 (new user) or step 3 (existing user).
   */
  async function handleEmailCheck() {
    setError(null)
    const err = validateStep1Email()
    if (err) {
      setError(err)
      return
    }

    setChecking(true)
    try {
      const res = await fetch(
        `/api/users/by-email?email=${encodeURIComponent(email.trim())}`
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur lors de la vérification")

      // Admin global receives the full identity payload; non-admins get
      // a minimal { id, status } shape because the backend refuses to
      // leak first_name/last_name/phone across team scopes (see
      // docs/user-management.md §5.3).
      const payload = (json.data || {}) as {
        exists?: boolean
        user?: {
          id: string
          first_name?: string
          last_name?: string
          email?: string
          phone?: string | null
          status: "active" | "inactive" | "deleted"
        }
      }

      if (payload.exists && payload.user) {
        setExistingUserId(payload.user.id)
        setExistingUserStatus(payload.user.status)
        // Only pre-fill the fields we actually received. For a non-admin
        // caller the wizard will show "Cet email existe déjà" without
        // revealing any identity info, and the POST upsert will leave
        // the target row's base infos untouched on their behalf.
        setFirstName(payload.user.first_name || "")
        setLastName(payload.user.last_name || "")
        setPhone(payload.user.phone || "")
        setStep(3)
      } else {
        setExistingUserId(null)
        setExistingUserStatus(null)
        setStep(2)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setChecking(false)
    }
  }

  /**
   * Build the { teamId: [role names] } object from the local state,
   * filtered to the teams the caller is allowed to touch.
   */
  function buildTeamRolesPayload(): Record<string, string[]> {
    const out: Record<string, string[]> = {}
    for (const [teamId, set] of teamRoleNames.entries()) {
      if (callerManagedTeamIds !== "ALL" && !callerManagedTeamIds.has(teamId)) continue
      out[teamId] = Array.from(set)
    }
    return out
  }

  async function handleSave() {
    setError(null)

    // Final validation depends on the mode.
    if (isCreation) {
      // In wizard flow, step 2 may have been skipped for existing users,
      // so we only validate names/passwords on the "fresh creation" path.
      // For an upsert on an existing user:
      //  - Admin global gets the full identity payload from by-email, so
      //    first_name/last_name are pre-filled and will be refreshed by
      //    the backend. We require them to be non-empty.
      //  - A non-admin caller gets only { id, status } from by-email and
      //    will not mutate the target's infos anyway. Empty names are
      //    expected and fine on this path.
      if (!existingUserId) {
        const err = validateStep2Infos()
        if (err) {
          setError(err)
          setStep(2)
          return
        }
      } else if (
        isCallerAdminGlobal &&
        (!firstName.trim() || !lastName.trim())
      ) {
        setError("Prénom et nom obligatoires")
        return
      }
    } else {
      const err = validateEditForm()
      if (err) {
        setError(err)
        return
      }
    }

    setSaving(true)
    try {
      const teamRoles = buildTeamRolesPayload()

      if (isCreation) {
        // Single call: the backend handles create-or-upsert and attaches
        // the requested teams + roles in one go.
        const body: Record<string, unknown> = {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          team_roles: teamRoles,
        }
        if (password) body.password = password
        // Reactivation: when the existing row is not active, ask the API
        // to flip its status back to 'active' as part of the upsert.
        if (existingUserId && existingUserStatus && existingUserStatus !== "active") {
          body.status = "active"
        }
        if (isCallerAdminGlobal) {
          body.global_roles = Array.from(globalRoleNames)
        }
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur création")

        // Build a user-facing feedback message based on the flags. For
        // a non-admin upsert on an unseen user, we don't know the name —
        // fall back to the email.
        const payload = json.data || {}
        const fullName =
          firstName.trim() || lastName.trim()
            ? `${firstName.trim()} ${lastName.trim()}`.trim()
            : email.trim()
        let message: string | undefined
        if (payload.created) {
          message = `${fullName} a été créé et ajouté à vos équipes.`
        } else if (existingUserStatus && existingUserStatus !== "active") {
          message = `${fullName} a été réactivé et ses rôles ont été mis à jour.`
        } else if (payload.already_in_teams) {
          message = `${fullName} existe déjà dans vos équipes. Ses rôles ont été mis à jour.`
        } else {
          message = `${fullName} existait déjà. Il a été ajouté à vos équipes.`
        }

        onSaved(message)
        return
      }

      // Edit mode: PATCH the existing user.
      const userId = user!.id

      // Compute teams to detach: teams that were in the initial snapshot
      // but are no longer in the current teamRoleNames map. Only teams the
      // caller can actually touch are listed (the backend also enforces
      // this, but filtering here keeps the payload clean).
      const detachTeams: string[] = []
      for (const initialTeamId of initialTeamIdsRef.current) {
        if (teamRoleNames.has(initialTeamId)) continue
        if (
          callerManagedTeamIds !== "ALL" &&
          !callerManagedTeamIds.has(initialTeamId)
        ) {
          continue
        }
        detachTeams.push(initialTeamId)
      }

      const patchBody: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        team_roles: teamRoles,
      }
      // Status is an Admin-global-only concern (backend also enforces it).
      if (isCallerAdminGlobal) {
        patchBody.status = status
      }
      if (detachTeams.length > 0) {
        patchBody.detach_teams = detachTeams
      }
      if (password) patchBody.password = password
      if (isCallerAdminGlobal) {
        patchBody.global_roles = Array.from(globalRoleNames)
      }

      const patchRes = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      })
      const patchJson = await patchRes.json().catch(() => ({}))
      if (!patchRes.ok) throw new Error(patchJson.error || "Erreur mise à jour")

      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  // ----- Derived state for button disablement -----
  const step1Valid = validateStep1Email() === null
  const step2Valid = validateStep2Infos() === null

  // A non-admin caller MUST have at least one team selected before the
  // creation can go through. Admin global is allowed to create a user
  // without any team (they can attribute only global roles for instance).
  const atLeastOneTeamSelected = teamRoleNames.size > 0
  const submitEnabled = isCreation
    ? isCallerAdminGlobal || atLeastOneTeamSelected
    : true

  // ----- Header chip + subtitle -----
  // Total number of steps depends on whether we're creating a fresh user
  // (3 steps) or upserting an existing one (we jump 1 → 3 so we display
  // "Étape 2/2" on the roles screen to match the user's perception).
  const totalSteps = existingUserId ? 2 : 3
  const displayedStep = existingUserId && step === 3 ? 2 : step

  const titleAside =
    isCreation ? (
      <span className="text-xs font-normal text-brun-light bg-creme-dark px-2 py-1 rounded">
        Étape {displayedStep}/{totalSteps}
      </span>
    ) : null

  const subtitle = isCreation
    ? step === 1
      ? "Adresse email"
      : step === 2
        ? "Informations et mot de passe"
        : existingUserId
          ? "Rôles à attribuer"
          : "Rôles globaux et par équipe"
    : "Modifiez les informations et les rôles"

  // ----- Footer buttons -----
  const footer = (
    <>
      {isCreation && step > 1 && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            // From step 3, going back for an existing user returns to
            // step 1 (we never visited step 2) so the caller can retype
            // a different email. For a fresh creation we hop back one.
            if (step === 3 && existingUserId) {
              // Clear stale upsert data: the caller is about to type a
              // new email, we must not leak the previous lookup's name,
              // phone, password, or selected roles into the next flow.
              setExistingUserId(null)
              setExistingUserStatus(null)
              setFirstName("")
              setLastName("")
              setPhone("")
              setPassword("")
              setConfirmPassword("")
              setStep(1)
            } else if (step === 3) {
              setStep(2)
            } else {
              setStep(1)
            }
          }}
          disabled={saving || checking}
          className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
        >
          Précédent
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        disabled={saving || checking}
        className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
      >
        Annuler
      </button>
      {isCreation && step === 1 && (
        <button
          type="button"
          onClick={handleEmailCheck}
          disabled={checking || !step1Valid}
          className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {checking ? "Vérification..." : "Suivant"}
        </button>
      )}
      {isCreation && step === 2 && (
        <button
          type="button"
          onClick={() => {
            setError(null)
            setStep(3)
          }}
          disabled={saving || !step2Valid}
          className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Suivant
        </button>
      )}
      {((isCreation && step === 3) || !isCreation) && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !submitEnabled}
          className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
      subtitle={subtitle}
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

        {/* ================= Step 1 — Email only ================= */}
        {isCreation && step === 1 && (
          <>
            <p className="text-sm text-brun-light">
              Saisissez l&apos;adresse email de l&apos;utilisateur. S&apos;il existe
              déjà, vous pourrez lui attribuer des rôles sur vos équipes ; sinon
              vous renseignerez ses informations à l&apos;étape suivante.
            </p>
            <Field label="Email" required>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && step1Valid && !checking) {
                    e.preventDefault()
                    void handleEmailCheck()
                  }
                }}
                className={INPUT_CLASS}
                autoFocus
              />
            </Field>
          </>
        )}

        {/* ================= Step 2 — Infos (fresh creation only) ================= */}
        {isCreation && step === 2 && (
          <>
            <div className="bg-creme text-brun-light text-xs px-3 py-2 rounded">
              <span className="font-medium text-brun">{email.trim()}</span> —
              aucun utilisateur existant. Complétez les informations ci-dessous.
            </div>

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

            <Field label="Téléphone">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT_CLASS}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Mot de passe" required>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Confirmer le mot de passe" required>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </>
        )}

        {/* ================= Edit mode — single page base infos ================= */}
        {!isCreation && (
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
              <Field label="Nouveau mot de passe">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                  placeholder="Laisser vide pour ne pas changer"
                />
              </Field>
              <Field
                label="Confirmer le mot de passe"
                required={password.length > 0}
              >
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            {isCallerAdminGlobal && (
              <Field label="Statut">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as typeof status)}
                  className={INPUT_CLASS}
                >
                  <option value="active">Actif</option>
                  <option value="inactive">Inactif</option>
                  <option value="deleted">Supprimé</option>
                </select>
              </Field>
            )}
          </>
        )}

        {/* ================= Step 3 / Edit roles section ================= */}
        {((isCreation && step === 3) || !isCreation) && (
          <>
            {isCreation && existingUserId && (
              <div className="bg-vert-eau/20 text-brun text-xs px-3 py-2 rounded">
                {firstName || lastName ? (
                  <>
                    <span className="font-medium">
                      {firstName} {lastName}
                    </span>{" "}
                    ({email.trim()}) existe déjà
                  </>
                ) : (
                  <>
                    L&apos;email{" "}
                    <span className="font-medium">{email.trim()}</span> est
                    déjà associé à un utilisateur
                  </>
                )}
                {existingUserStatus && existingUserStatus !== "active" && (
                  <>
                    {" "}—{" "}
                    {isCallerAdminGlobal
                      ? "il sera réactivé en l'ajoutant à vos équipes"
                      : "seul un Admin global peut le réactiver"}
                  </>
                )}
                .
              </div>
            )}

            {isCallerAdminGlobal && globalRoles.length > 0 && (
              <div className={!isCreation ? "border-t border-brun/10 pt-5" : ""}>
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

            {(() => {
              // Label simplified when the caller only manages a single team:
              // "Rôles par équipe" becomes just "Rôles", and the sub-text
              // doesn't mention team selection since there's nothing to pick.
              const hasMultipleTeams = selectableTeams.length > 1
              const sectionTitle = hasMultipleTeams ? "Rôles par équipe" : "Rôles"
              const sectionHelp = hasMultipleTeams
                ? "Sélectionnez l'équipe puis les rôles à attribuer dessus."
                : "Sélectionner les rôles pour cet utilisateur."
              return (
                <div className={isCallerAdminGlobal && globalRoles.length > 0 ? "border-t border-brun/10 pt-5" : ""}>
                  <h3 className="font-semibold text-brun mb-1">{sectionTitle}</h3>
                  <p className="text-xs text-brun-light mb-3">{sectionHelp}</p>

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
              )
            })()}
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
