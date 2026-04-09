"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import type { RoleAssignment, RoleName } from "@/lib/auth/permissions"

type NavItem = {
  href: string
  label: string
  /** Icon path for a 24x24 stroke svg. */
  icon: string
  /** Predicate receiving the user's role assignments. */
  visible: (assignments: RoleAssignment[]) => boolean
}

/** True if the user has a given role anywhere (global or on any team). */
const hasRole = (assignments: RoleAssignment[], role: RoleName) =>
  assignments.some((a) => a.role === role)

const isAdminGlobal = (assignments: RoleAssignment[]) =>
  assignments.some((a) => a.role === "Admin global" && a.teamId === null)

const NAV: NavItem[] = [
  {
    href: "/",
    label: "Tableau de bord",
    icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
    visible: () => true,
  },
  {
    href: "/utilisateurs",
    label: "Utilisateurs",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
    // Team manager ou Admin global
    visible: (a) => isAdminGlobal(a) || hasRole(a, "Team manager"),
  },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  if (!user) return null

  const assignments = user.role_assignments
  const visibleItems = NAV.filter((item) => item.visible(assignments))

  return (
    <aside className="w-64 bg-brun h-screen p-6 flex-shrink-0 flex flex-col sticky top-0">
      <div className="mb-8">
        <span className="font-serif text-xl text-white">Chefmate</span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-white/40">
          Manager
        </span>
      </div>

      <nav className="space-y-1 flex-1">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-orange text-white"
                  : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <svg
                className="w-5 h-5 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d={item.icon}
                />
              </svg>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <div className="mb-3 px-2">
          <p className="text-white text-sm font-medium truncate">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-white/40 text-xs truncate">{user.email}</p>
        </div>
        <button
          onClick={() => logout()}
          className="w-full text-left px-3 py-2 text-sm text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          Se déconnecter
        </button>
      </div>
    </aside>
  )
}
