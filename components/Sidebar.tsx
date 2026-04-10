"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import type { RoleAssignment, RoleName } from "@/lib/auth/permissions"
import { ThemeSelector } from "./ThemeProvider"

/**
 * Predicate helpers. Work directly on the caller's role_assignments so we can
 * ask things like "does this user have Contributeur on any team". The central
 * can() function is optimized for per-resource checks, but for a sidebar we
 * mostly want "can this user access THIS area at all".
 */
const isAdminGlobal = (a: RoleAssignment[]) =>
  a.some((r) => r.role === "Admin global" && r.teamId === null)

const hasGlobalRole = (a: RoleAssignment[], role: RoleName) =>
  a.some((r) => r.role === role && r.teamId === null)

const hasTeamRoleAnywhere = (a: RoleAssignment[], role: RoleName) =>
  a.some((r) => r.role === role && r.teamId !== null)

/** User can see the recipes area: Admin global, Admin contenu (read-only),
 *  or any team-scoped role on any team. */
const canSeeRecipes = (a: RoleAssignment[]) =>
  isAdminGlobal(a) ||
  hasGlobalRole(a, "Admin contenu") ||
  hasTeamRoleAnywhere(a, "Contributeur") ||
  hasTeamRoleAnywhere(a, "Traiteur") ||
  hasTeamRoleAnywhere(a, "Team manager") ||
  hasTeamRoleAnywhere(a, "Website manager")

/** Events area: same visibility rule as recipes. */
const canSeeEvents = canSeeRecipes

const canSeeIngredientsAndReferentials = (a: RoleAssignment[]) =>
  isAdminGlobal(a) || hasGlobalRole(a, "Admin contenu")

const canSeeSeasons = isAdminGlobal

const canSeeTeams = (a: RoleAssignment[]) =>
  isAdminGlobal(a) || hasTeamRoleAnywhere(a, "Team manager")

const canSeeUsers = canSeeTeams

const canSeeSites = (a: RoleAssignment[]) =>
  isAdminGlobal(a) || hasTeamRoleAnywhere(a, "Website manager")

const canSeeAdminArea = isAdminGlobal

// ---------------------------------------------------------------------------
// Navigation structure
// ---------------------------------------------------------------------------

type LeafItem = {
  href: string
  label: string
  icon: string
  visible: (a: RoleAssignment[]) => boolean
}

type GroupItem = {
  id: string
  label: string
  icon: string
  visible: (a: RoleAssignment[]) => boolean
  children: LeafItem[]
}

type NavItem = LeafItem | GroupItem

type Section = {
  label: string
  visible: (a: RoleAssignment[]) => boolean
  items: NavItem[]
}

const NAV: Section[] = [
  {
    label: "Navigation",
    visible: () => true,
    items: [
      {
        href: "/",
        label: "Tableau de bord",
        icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6",
        visible: () => true,
      },
      {
        href: "/recettes",
        label: "Recettes",
        icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
        visible: canSeeRecipes,
      },
      {
        href: "/evenements",
        label: "Événements",
        icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
        visible: canSeeEvents,
      },
    ],
  },
  {
    label: "Contenu",
    visible: canSeeIngredientsAndReferentials,
    items: [
      {
        href: "/ingredients",
        label: "Ingrédients",
        icon: "M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01",
        visible: canSeeIngredientsAndReferentials,
      },
      {
        id: "ref-contenu",
        label: "Référentiels",
        icon: "M4 6h16M4 12h16M4 18h16",
        visible: canSeeIngredientsAndReferentials,
        children: [
          {
            href: "/referentiels/unites",
            label: "Unités",
            icon: "M3 3h18v18H3z",
            visible: canSeeIngredientsAndReferentials,
          },
          {
            href: "/referentiels/rayons",
            label: "Rayons",
            icon: "M3 3h18v18H3z",
            visible: canSeeIngredientsAndReferentials,
          },
          {
            href: "/referentiels/tags",
            label: "Tags",
            icon: "M3 3h18v18H3z",
            visible: canSeeIngredientsAndReferentials,
          },
          {
            href: "/referentiels/saisons",
            label: "Saisons",
            icon: "M3 3h18v18H3z",
            visible: canSeeSeasons,
          },
        ],
      },
    ],
  },
  {
    label: "Organisation",
    visible: (a) => canSeeTeams(a) || canSeeSites(a),
    items: [
      {
        href: "/equipes",
        label: "Équipes",
        icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
        visible: canSeeTeams,
      },
      {
        href: "/utilisateurs",
        label: "Utilisateurs",
        icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
        visible: canSeeUsers,
      },
      {
        href: "/sites",
        label: "Sites",
        icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
        visible: canSeeSites,
      },
    ],
  },
  {
    label: "Administration",
    visible: canSeeAdminArea,
    items: [
      {
        href: "/roles",
        label: "Rôles",
        icon: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
        visible: canSeeAdminArea,
      },
      {
        href: "/documentation",
        label: "Documentation",
        icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
        visible: canSeeAdminArea,
      },
      {
        href: "/gestion-bdd",
        label: "Santé technique",
        icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
        visible: canSeeAdminArea,
      },
      {
        href: "/rgpd",
        label: "RGPD / Clean",
        icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
        visible: canSeeAdminArea,
      },
    ],
  },
  {
    label: "Évolutions",
    visible: canSeeAdminArea,
    items: [
      {
        href: "/notes-evolution",
        label: "Notes d'évolution",
        icon: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
        visible: canSeeAdminArea,
      },
      {
        id: "ref-evols",
        label: "Référentiels évols",
        icon: "M4 6h16M4 12h16M4 18h16",
        visible: canSeeAdminArea,
        children: [
          {
            href: "/referentiels-admin/note-types",
            label: "Types de notes",
            icon: "M3 3h18v18H3z",
            visible: canSeeAdminArea,
          },
          {
            href: "/referentiels-admin/note-familles",
            label: "Familles de notes",
            icon: "M3 3h18v18H3z",
            visible: canSeeAdminArea,
          },
          {
            href: "/referentiels-admin/note-avancements",
            label: "Avancements",
            icon: "M3 3h18v18H3z",
            visible: canSeeAdminArea,
          },
          {
            href: "/referentiels-admin/note-priorites",
            label: "Priorités",
            icon: "M3 3h18v18H3z",
            visible: canSeeAdminArea,
          },
        ],
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export default function Sidebar() {
  const { user, logout } = useAuth()
  const pathname = usePathname()
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set())

  if (!user) return null
  const a = user.role_assignments

  const toggleGroup = (id: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  const isGroup = (i: NavItem): i is GroupItem => "children" in i

  return (
    <aside className="w-64 bg-brun h-screen flex-shrink-0 flex flex-col sticky top-0">
      <div className="px-6 pt-6 pb-2 mb-4">
        <img
          src="/chefmate-logo.svg"
          alt="ChefMate"
          className="h-8 brightness-0 invert"
        />
        <span className="block text-[10px] uppercase tracking-[0.2em] text-white/40 mt-1">
          Manager
        </span>
      </div>

      {/* Scrollable nav with fade-out gradient at the bottom */}
      <div className="flex-1 min-h-0 relative">
        <nav className="h-full overflow-y-auto px-6 pb-8 sidebar-nav space-y-8">
          {NAV.map((section) => {
          if (!section.visible(a)) return null
          const visibleItems = section.items
            .map((item): NavItem | null => {
              if (isGroup(item)) {
                const children = item.children.filter((c) => c.visible(a))
                if (children.length === 0) return null
                return { ...item, children }
              }
              return item.visible(a) ? item : null
            })
            .filter((i): i is NavItem => i !== null)

          if (visibleItems.length === 0) return null

          return (
            <div key={section.label}>
              <h3 className="text-[10px] font-semibold text-white/30 uppercase tracking-[0.15em] px-3 mb-2">
                {section.label}
              </h3>
              <div className="space-y-0.5">
                {visibleItems.map((item) => {
                  if (isGroup(item)) {
                    const anyChildActive = item.children.some((c) => isActive(c.href))
                    const isOpen = openGroups.has(item.id) || anyChildActive
                    return (
                      <div key={item.id}>
                        <button
                          type="button"
                          onClick={() => toggleGroup(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                            anyChildActive
                              ? "bg-orange text-white"
                              : "text-white/60 hover:bg-white/5 hover:text-white"
                          }`}
                        >
                          <NavIcon d={item.icon} />
                          <span className="flex-1 text-left">{item.label}</span>
                          <svg
                            className={`w-3 h-3 transition-transform ${
                              isOpen ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isOpen && (
                          <div className="ml-4 pl-3 mt-1 space-y-0.5 border-l border-white/10">
                            {item.children.map((child) => (
                              <Link
                                key={child.href}
                                href={child.href}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                                  isActive(child.href)
                                    ? "text-orange"
                                    : "text-white/50 hover:text-white/80"
                                }`}
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                        isActive(item.href)
                          ? "bg-orange text-white"
                          : "text-white/60 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <NavIcon d={item.icon} />
                      <span>{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
          </nav>
        {/* Fade gradient overlay */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-brun to-transparent" />
      </div>

      {/* Fixed footer */}
      <div className="flex-shrink-0 border-t border-white/10 px-6 py-4">
        <div className="mb-3 flex justify-center">
          <ThemeSelector />
        </div>
        <div className="flex items-center gap-2 px-2">
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">
              {user.first_name} {user.last_name}
            </p>
            <p className="text-white/40 text-xs truncate">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => logout()}
            title="Se déconnecter"
            className="flex-shrink-0 text-white/40 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/5"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

function NavIcon({ d }: { d: string }) {
  return (
    <svg
      className="w-5 h-5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  )
}
