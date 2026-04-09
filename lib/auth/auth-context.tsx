"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type React from "react"
import {
  can as canPermission,
  type Action,
  type PermissionContext,
  type Resource,
  type RoleAssignment,
  type RoleName,
} from "./permissions"

export interface AuthUser {
  id: string
  email: string
  first_name: string
  last_name: string
  roles: string[]
  role_assignments: RoleAssignment[]
}

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  hasRole: (roleName: string) => boolean
  hasRoleOnTeam: (role: RoleName, teamId: string) => boolean
  can: (action: Action, resource: Resource, context?: PermissionContext) => boolean
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  hasRole: () => false,
  hasRoleOnTeam: () => false,
  can: () => false,
})

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: React.ReactNode
  initialUser?: AuthUser | null
}) {
  const [user, setUser] = useState<AuthUser | null>(initialUser)
  const [loading, setLoading] = useState(initialUser === null)

  useEffect(() => {
    if (initialUser) return
    fetch("/api/session")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { user?: AuthUser } | null) => {
        if (data?.user) {
          setUser({
            ...data.user,
            role_assignments: data.user.role_assignments ?? [],
          })
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [initialUser])

  const logout = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" })
    setUser(null)
    window.location.href = "/login"
  }, [])

  const hasRole = useCallback(
    (roleName: string) => user?.roles?.includes(roleName) ?? false,
    [user]
  )

  const hasRoleOnTeam = useCallback(
    (role: RoleName, teamId: string) =>
      user?.role_assignments?.some(
        (a) => a.role === role && a.teamId === teamId
      ) ?? false,
    [user]
  )

  const can = useCallback(
    (action: Action, resource: Resource, context: PermissionContext = {}) => {
      if (!user) return false
      return canPermission(user.role_assignments, action, resource, context)
    },
    [user]
  )

  const value = useMemo(
    () => ({ user, loading, logout, hasRole, hasRoleOnTeam, can }),
    [user, loading, logout, hasRole, hasRoleOnTeam, can]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}
