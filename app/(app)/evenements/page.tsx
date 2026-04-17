"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { getAdminBase } from "@/lib/admin-url"
// Auth context available if needed for permission checks
// import { useAuth } from "@/lib/auth/auth-context"

interface TeamRef {
  id: string
  name: string
}

interface EventDate {
  id: string
  start_datetime: string
  duration_minutes: number | null
  guest_count: number
  location: string | null
}

interface EventImage {
  id: string
  image_type: "cover" | "report"
  image_url: string
  sort_order: number
}

interface Event {
  id: string
  name: string
  slug: string | null
  description: string | null
  event_date: string | null
  guest_count: number
  status: string
  team: TeamRef | null
  event_recipes: Array<{ id: string; serving_count: number; recette: { id: string; name: string } | null }>
  event_images: EventImage[]
  event_dates: EventDate[]
  created_at: string
  updated_at: string
}

const STATUS_LABELS: Record<string, { label: string; bg: string; text: string }> = {
  brouillon: { label: "Brouillon", bg: "bg-brun/10", text: "text-brun-light" },
  non_publiee: { label: "Non publiée", bg: "bg-jaune/20", text: "text-brun" },
  publiee: { label: "Publiée", bg: "bg-vert-eau/20", text: "text-brun" },
}

const PAGE_SIZE = 24

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })
  } catch {
    return dateStr
  }
}

function formatDateTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return isoStr
  }
}

function getCoverImageUrl(images: EventImage[]): string | null {
  const cover = images?.find((img) => img.image_type === "cover")
  if (!cover) return null
  const url = cover.image_url
  if (url.startsWith("http")) return url
  return `${getAdminBase()}${url}`
}

export default function EvenementsPage() {
  const router = useRouter()

  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)

  // Filters
  const [filterStatus, setFilterStatus] = useState("")
  const [searchName, setSearchName] = useState("")
  const [sortBy, setSortBy] = useState("event_date")
  const [sortOrder, setSortOrder] = useState("desc")

  const resetPage = useCallback(() => setPage(0), [])

  const loadEvents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set("status", filterStatus)
      if (sortBy) params.set("sort_by", sortBy)
      if (sortOrder) params.set("sort_order", sortOrder)
      params.set("limit", String(PAGE_SIZE))
      params.set("offset", String(page * PAGE_SIZE))

      const res = await fetch(`/api/events?${params}`)
      const json = await res.json()

      setEvents(json.data ?? [])
      setTotal(json.meta?.total ?? json.data?.length ?? 0)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [filterStatus, sortBy, sortOrder, page])

  useEffect(() => {
    const t = setTimeout(() => void loadEvents(), 300)
    return () => clearTimeout(t)
  }, [loadEvents])

  // Client-side name filter (API doesn't support name search on events)
  const filteredEventsRaw = searchName.trim()
    ? events.filter((e) => e.name.toLowerCase().includes(searchName.trim().toLowerCase()))
    : events

  // Re-sort by computed "effective date" (first event_dates[].start_datetime,
  // fallback to event_date). The API-level sort doesn't work for events that
  // only use event_dates and have null event_date.
  function getEffectiveDate(e: typeof events[0]): string {
    const first = (e.event_dates ?? [])
      .filter((d) => d.start_datetime)
      .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))[0]
    return first?.start_datetime || e.event_date || ""
  }

  const filteredEvents = sortBy === "event_date"
    ? [...filteredEventsRaw].sort((a, b) => {
        const da = getEffectiveDate(a)
        const db = getEffectiveDate(b)
        // Empty dates go last regardless of order
        if (!da && !db) return 0
        if (!da) return 1
        if (!db) return -1
        return sortOrder === "asc" ? da.localeCompare(db) : db.localeCompare(da)
      })
    : filteredEventsRaw

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      <header className="flex items-start justify-between mb-6">
        <div>
          <h1 className="font-serif text-3xl text-brun">Événements</h1>
          <p className="text-sm text-brun-light mt-1">
            {total} événement{total !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => router.push("/evenements/new")}
          className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
        >
          + Nouvel événement
        </button>
      </header>

      {/* Filters */}
      <div className="mb-6 flex gap-3">
        {/* Search by name */}
        <div className="relative flex-1">
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
            value={searchName}
            onChange={(e) => { setSearchName(e.target.value); resetPage() }}
            placeholder="Rechercher par nom..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun placeholder:text-brun-light/70 focus:outline-none focus:ring-2 focus:ring-orange/30"
          />
        </div>

        {/* Status filter */}
        <div className="relative">
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
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); resetPage() }}
            className="pl-9 pr-8 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
          >
            <option value="">Tous les statuts</option>
            <option value="brouillon">Brouillon</option>
            <option value="non_publiee">Non publiée</option>
            <option value="publiee">Publiée</option>
          </select>
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={`${sortBy}.${sortOrder}`}
            onChange={(e) => {
              const lastDot = e.target.value.lastIndexOf(".")
              setSortBy(e.target.value.slice(0, lastDot))
              setSortOrder(e.target.value.slice(lastDot + 1))
              resetPage()
            }}
            className="px-3 py-2 rounded-lg bg-white border border-brun/10 text-sm text-brun appearance-none focus:outline-none focus:ring-2 focus:ring-orange/30 filter-select-chevron"
          >
            <option value="event_date.desc">Date (récent → ancien)</option>
            <option value="event_date.asc">Date (ancien → récent)</option>
            <option value="name.asc">Nom A→Z</option>
            <option value="name.desc">Nom Z→A</option>
            <option value="created_at.desc">Création (récent)</option>
          </select>
        </div>
      </div>

      {loading && (
        <p className="text-sm text-brun-light italic">Chargement...</p>
      )}

      {/* Event cards */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEvents.map((event) => {
            const statusInfo = STATUS_LABELS[event.status] || STATUS_LABELS.brouillon
            const coverUrl = getCoverImageUrl(event.event_images || [])
            const recipeCount = event.event_recipes?.length ?? 0
            const nextDate = event.event_dates
              ?.filter((d) => d.start_datetime)
              .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))[0]

            return (
              <div
                key={event.id}
                className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden cursor-pointer"
                onClick={() => router.push(`/evenements/${event.id}`)}
              >
                {/* Cover image */}
                <div className="aspect-[16/10] bg-creme relative">
                  {coverUrl ? (
                    <img
                      src={coverUrl}
                      alt={event.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg
                        className="w-12 h-12 text-brun-light/20"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Status badge */}
                  <span
                    className={`absolute top-2 right-2 px-2 py-0.5 text-[10px] font-medium rounded-full ${statusInfo.bg} ${statusInfo.text}`}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Content */}
                <div className="p-4">
                  <h3 className="font-serif text-base text-brun mb-1 line-clamp-1">
                    {event.name}
                  </h3>

                  {/* Team */}
                  {event.team && (
                    <p className="text-[10px] text-brun-light mb-2">
                      {event.team.name}
                    </p>
                  )}

                  {/* Meta row */}
                  <div className="flex flex-wrap items-center gap-2 text-[10px] text-brun-light">
                    {/* Date */}
                    {nextDate ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDateTime(nextDate.start_datetime)}
                      </span>
                    ) : event.event_date ? (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {formatDate(event.event_date)}
                      </span>
                    ) : null}

                    {/* Guest count */}
                    {event.guest_count > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {event.guest_count}
                      </span>
                    )}

                    {/* Recipe count */}
                    {recipeCount > 0 && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        {recipeCount} recette{recipeCount > 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {!loading && filteredEvents.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <p className="text-brun-light">Aucun événement</p>
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg border border-brun/10 bg-white text-brun hover:bg-creme disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Précédent
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i)
              .filter((i) => {
                if (i === 0 || i === totalPages - 1) return true
                if (Math.abs(i - page) <= 1) return true
                return false
              })
              .reduce<(number | "ellipsis")[]>((acc, i, idx, arr) => {
                if (idx > 0 && typeof arr[idx - 1] === "number" && i - (arr[idx - 1] as number) > 1) {
                  acc.push("ellipsis")
                }
                acc.push(i)
                return acc
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`e-${idx}`} className="px-1 text-brun-light text-sm">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setPage(item)}
                    className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                      item === page
                        ? "bg-orange text-white font-semibold"
                        : "bg-white border border-brun/10 text-brun hover:bg-creme"
                    }`}
                  >
                    {item + 1}
                  </button>
                )
              )}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-brun/10 bg-white text-brun hover:bg-creme disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  )
}
