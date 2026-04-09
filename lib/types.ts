/**
 * Shared TypeScript types for chefmate-manager.
 * Mirror the shape returned by chefmate-admin's /api/v1 endpoints.
 */

import type { RoleAssignment } from "./auth/permissions"

export type UserStatus = "active" | "inactive" | "deleted"

export interface Team {
  id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Role {
  id: string
  name: string
  description: string | null
  sort_order: number
  scope: "global" | "team"
}

export interface UserRoleRow {
  team_id: string | null
  role: { id: string; name: string; scope: "global" | "team" } | null
  team: { id: string; name: string } | null
}

export interface UserTeamRow {
  team: { id: string; name: string } | null
}

export interface UserWithRoles {
  id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  status: UserStatus
  created_at: string
  updated_at: string
  user_roles: UserRoleRow[]
  user_teams: UserTeamRow[]
}

/** Utility: map a UserWithRoles to a UserGroups layout for the UI. */
export interface UserGroups {
  globalRoles: string[]
  teamGroups: Array<{ teamId: string; teamName: string; roles: string[] }>
}

export function groupRolesByTeam(user: UserWithRoles): UserGroups {
  const globalRoles: string[] = []
  const teamMap = new Map<string, { teamName: string; roles: Set<string> }>()

  for (const m of user.user_teams || []) {
    if (m.team && !teamMap.has(m.team.id)) {
      teamMap.set(m.team.id, { teamName: m.team.name, roles: new Set() })
    }
  }

  for (const ur of user.user_roles || []) {
    const name = ur.role?.name
    if (!name) continue
    if (ur.team_id === null) {
      globalRoles.push(name)
    } else if (ur.team) {
      const bucket = teamMap.get(ur.team.id) || {
        teamName: ur.team.name,
        roles: new Set<string>(),
      }
      bucket.roles.add(name)
      teamMap.set(ur.team.id, bucket)
    }
  }

  return {
    globalRoles: Array.from(new Set(globalRoles)).sort(),
    teamGroups: Array.from(teamMap.entries())
      .map(([teamId, bucket]) => ({
        teamId,
        teamName: bucket.teamName,
        roles: Array.from(bucket.roles).sort(),
      }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName)),
  }
}

/** Build the assignments shape that can() expects from a UserWithRoles. */
export function userToAssignments(user: UserWithRoles): RoleAssignment[] {
  return (user.user_roles || [])
    .map((ur): RoleAssignment | null => {
      if (!ur.role) return null
      return {
        role: ur.role.name as RoleAssignment["role"],
        teamId: ur.team_id,
      }
    })
    .filter((x): x is RoleAssignment => x !== null)
}
