/**
 * Centralized permissions module.
 *
 * Single source of truth for "who can do what" across the BO and the API.
 * The matrix lives in supabase/PERMISSIONS_MATRIX.md — this file is its
 * code-level translation.
 *
 * Usage:
 *   import { can, ROLE_NAMES } from "@/lib/auth/permissions"
 *   const allowed = can(session.role_assignments, "update", "recipe", {
 *     ownerTeamIds: recipe.team_ids,
 *     isPrivate: recipe.is_private,
 *   })
 *
 * The `can` function is pure and synchronous: all the context it needs has to
 * be passed in. It never touches the DB. Server-side wrappers that need to
 * fetch context should live in lib/auth/guards.ts and ultimately call `can`.
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLE_NAMES = [
  "Admin global",
  "Admin contenu",
  "Traiteur",
  "Contributeur",
  "Team manager",
  "Website manager",
] as const

export type RoleName = (typeof ROLE_NAMES)[number]

export type Scope = "global" | "team"

/** A single role assignment on a user, as stored in the DB. */
export interface RoleAssignment {
  role: RoleName
  /** null for global roles, team uuid for team-scoped roles */
  teamId: string | null
}

/** Static scope per role — must stay in sync with the roles.scope column. */
export const ROLE_SCOPE: Record<RoleName, Scope> = {
  "Admin global": "global",
  "Admin contenu": "global",
  Traiteur: "team",
  Contributeur: "team",
  "Team manager": "team",
  "Website manager": "team",
}

// ---------------------------------------------------------------------------
// Resources & actions
// ---------------------------------------------------------------------------

export type Resource =
  // Business content
  | "recipe"
  | "event"
  | "ingredient"
  // Referentials (shared globally)
  | "referential" // units, aisles, tags (Admin contenu scope)
  | "season" // Admin global only
  // Team & user management
  | "team"
  | "user"
  | "user_role_assignment" // attributing roles to a user
  | "user_status" // changing a user's status
  // Sites
  | "site"
  // API keys (team_api_keys)
  | "api_key"
  // Platform admin (documentation, db admin, release notes)
  | "platform_admin"
  // Event's sub-resources selected by a Traiteur
  | "event_recipe_selection"
  | "event_ingredient_selection"
  // Publication toggles are expressed as actions, not resources

export type Action =
  | "create"
  | "read"
  | "update"
  | "delete" // soft delete; the matrix never authorizes hard delete
  | "publish" // recipes, events
  | "reassign_team" // Admin global moving recipes/events between teams

/**
 * Context carried alongside the action/resource to evaluate permissions.
 *
 * Only fill the fields that make sense for the current check. The functions
 * below will ignore what they don't need.
 */
export interface PermissionContext {
  /**
   * Team(s) that own the target resource.
   *  - recipes can belong to multiple teams (recipe_teams)
   *  - events belong to a single team
   *  - sites belong to a single team
   */
  ownerTeamIds?: string[]
  /** For recipes: is the target publicly visible. */
  isPublic?: boolean
  /**
   * For `event_recipe_selection`: the teamId of the event that will host the
   * recipe (in addition to the recipe's owner teams passed via ownerTeamIds).
   */
  hostEventTeamId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True if the user has the given role anywhere (global or on any team). */
export function hasRole(assignments: RoleAssignment[], role: RoleName): boolean {
  return assignments.some((a) => a.role === role)
}

/** True if the user has the given role on the given team. */
export function hasRoleOnTeam(
  assignments: RoleAssignment[],
  role: RoleName,
  teamId: string
): boolean {
  return assignments.some((a) => a.role === role && a.teamId === teamId)
}

/** True if the user has the given global role. */
export function hasGlobalRole(
  assignments: RoleAssignment[],
  role: RoleName
): boolean {
  return assignments.some((a) => a.role === role && a.teamId === null)
}

/** True if the user is Admin global (shortcut used all over the codebase). */
export function isAdminGlobal(assignments: RoleAssignment[]): boolean {
  return hasGlobalRole(assignments, "Admin global")
}

/** Returns the list of teamIds on which the user has the given team-scoped role. */
export function getTeamsWithRole(
  assignments: RoleAssignment[],
  role: RoleName
): string[] {
  if (ROLE_SCOPE[role] !== "team") return []
  return assignments
    .filter((a) => a.role === role && a.teamId !== null)
    .map((a) => a.teamId as string)
}

// ---------------------------------------------------------------------------
// The matrix
// ---------------------------------------------------------------------------

/**
 * Central permission check. Returns true if the user is allowed to perform
 * `action` on `resource`, given the context.
 *
 * The function is a tall switch on (resource, action). It is written to be
 * explicit and easy to audit — do not try to factor the branches until the
 * matrix is stable.
 */
export function can(
  assignments: RoleAssignment[],
  action: Action,
  resource: Resource,
  context: PermissionContext = {}
): boolean {
  // Admin global short-circuit — full access everywhere.
  if (isAdminGlobal(assignments)) return true

  const ownerTeamIds = context.ownerTeamIds ?? []
  const anyOwnerTeam = (predicate: (teamId: string) => boolean): boolean =>
    ownerTeamIds.some(predicate)

  switch (resource) {
    // ---------- Recipes ----------
    case "recipe": {
      const canEdit = (teamId: string) =>
        hasRoleOnTeam(assignments, "Contributeur", teamId)
      const canRead = (teamId: string) =>
        hasRoleOnTeam(assignments, "Contributeur", teamId) ||
        hasRoleOnTeam(assignments, "Traiteur", teamId) ||
        hasRoleOnTeam(assignments, "Team manager", teamId) ||
        hasRoleOnTeam(assignments, "Website manager", teamId)

      switch (action) {
        case "create":
          // Must be Contributeur on at least one team (which team is resolved
          // when the caller specifies ownerTeamIds of the recipe being created).
          if (ownerTeamIds.length === 0) {
            return getTeamsWithRole(assignments, "Contributeur").length > 0
          }
          return anyOwnerTeam(canEdit)
        case "read":
          if (context.isPublic) return true
          return anyOwnerTeam(canRead)
        case "update":
        case "delete":
        case "publish":
          return anyOwnerTeam(canEdit)
        case "reassign_team":
          return false // Admin global only (short-circuited above)
        default:
          return false
      }
    }

    // ---------- Events ----------
    case "event": {
      const canEditEvent = (teamId: string) =>
        hasRoleOnTeam(assignments, "Traiteur", teamId)
      const canReadEvent = (teamId: string) =>
        hasRoleOnTeam(assignments, "Contributeur", teamId) ||
        hasRoleOnTeam(assignments, "Traiteur", teamId) ||
        hasRoleOnTeam(assignments, "Team manager", teamId) ||
        hasRoleOnTeam(assignments, "Website manager", teamId)

      switch (action) {
        case "create":
          if (ownerTeamIds.length === 0) {
            return getTeamsWithRole(assignments, "Traiteur").length > 0
          }
          return anyOwnerTeam(canEditEvent)
        case "read":
          return anyOwnerTeam(canReadEvent)
        case "update":
        case "delete":
        case "publish":
          return anyOwnerTeam(canEditEvent)
        case "reassign_team":
          return false
        default:
          return false
      }
    }

    // ---------- Event sub-resources (recipe / ingredient picking) ----------
    case "event_recipe_selection": {
      // A Traiteur on the host team can pick a recipe if:
      //   - the recipe is not private, OR
      //   - the recipe belongs to a team where the user is Contributeur, OR
      //   - the recipe belongs to the host team itself (and user is Traiteur there)
      if (!context.hostEventTeamId) return false
      if (!hasRoleOnTeam(assignments, "Traiteur", context.hostEventTeamId)) return false
      if (action !== "create" && action !== "read") return false
      if (context.isPublic) return true
      if (ownerTeamIds.includes(context.hostEventTeamId)) return true
      return anyOwnerTeam((tid) => hasRoleOnTeam(assignments, "Contributeur", tid))
    }

    case "event_ingredient_selection": {
      // Only the Traiteur on the host team can add ingredients to an event.
      if (!context.hostEventTeamId) return false
      return hasRoleOnTeam(assignments, "Traiteur", context.hostEventTeamId)
    }

    // ---------- Ingredients ----------
    case "ingredient": {
      if (action === "read") return true // every authenticated user can read
      return hasGlobalRole(assignments, "Admin contenu")
    }

    // ---------- Referentials (units, aisles, tags) ----------
    case "referential": {
      if (action === "read") return true
      return hasGlobalRole(assignments, "Admin contenu")
    }

    // ---------- Seasons ----------
    case "season": {
      if (action === "read") return true
      return false // Admin global only (short-circuited above)
    }

    // ---------- Teams ----------
    case "team": {
      switch (action) {
        case "create":
        case "delete":
        case "reassign_team":
          return false // Admin global only
        case "update":
          return ownerTeamIds.length > 0
            ? anyOwnerTeam((tid) => hasRoleOnTeam(assignments, "Team manager", tid))
            : getTeamsWithRole(assignments, "Team manager").length > 0
        case "read":
          return ownerTeamIds.length > 0
            ? ownerTeamIds.some((tid) =>
                assignments.some((a) => a.teamId === tid)
              )
            : assignments.some((a) => a.teamId !== null)
        default:
          return false
      }
    }

    // ---------- Users ----------
    case "user": {
      switch (action) {
        case "create":
        case "update":
        case "read":
          // Team manager can CRUD users on teams they manage.
          return ownerTeamIds.length > 0
            ? anyOwnerTeam((tid) => hasRoleOnTeam(assignments, "Team manager", tid))
            : getTeamsWithRole(assignments, "Team manager").length > 0
        case "delete":
          // Soft delete is a status change, go via user_status
          return false
        default:
          return false
      }
    }

    case "user_role_assignment": {
      // Team manager can assign any team-scoped role on their teams.
      // Attributing a global role (Admin global, Admin contenu) is Admin global only.
      if (action !== "create" && action !== "update" && action !== "delete") return false
      return ownerTeamIds.length > 0
        ? anyOwnerTeam((tid) => hasRoleOnTeam(assignments, "Team manager", tid))
        : false
    }

    case "user_status": {
      if (action !== "update") return false
      return ownerTeamIds.length > 0
        ? anyOwnerTeam((tid) => hasRoleOnTeam(assignments, "Team manager", tid))
        : false
    }

    // ---------- Sites ----------
    case "site": {
      switch (action) {
        case "create":
        case "update":
          return ownerTeamIds.length > 0
            ? anyOwnerTeam((tid) => hasRoleOnTeam(assignments, "Website manager", tid))
            : getTeamsWithRole(assignments, "Website manager").length > 0
        case "read":
          return ownerTeamIds.length > 0
            ? ownerTeamIds.some((tid) =>
                assignments.some((a) => a.teamId === tid)
              )
            : assignments.some((a) => a.teamId !== null)
        case "delete":
          return false // Admin global only (and only soft delete)
        default:
          return false
      }
    }

    // ---------- API keys (team_api_keys) ----------
    case "api_key": {
      // Requires BOTH Team manager AND Website manager on the same team.
      if (!["create", "read", "update", "delete"].includes(action)) return false
      const requireBoth = (teamId: string) =>
        hasRoleOnTeam(assignments, "Team manager", teamId) &&
        hasRoleOnTeam(assignments, "Website manager", teamId)
      return ownerTeamIds.length > 0
        ? anyOwnerTeam(requireBoth)
        : assignments
            .filter((a) => a.role === "Team manager" && a.teamId !== null)
            .some((a) => requireBoth(a.teamId as string))
    }

    // ---------- Platform admin (docs, db admin, release notes) ----------
    case "platform_admin":
      return false // Admin global only (short-circuited above)

    default:
      return false
  }
}
