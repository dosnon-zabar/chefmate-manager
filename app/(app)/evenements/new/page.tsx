"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toaster"

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

interface TeamRef { id: string; name: string }

export default function NewEventPage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [name, setName] = useState("")
  const [teamId, setTeamId] = useState("")
  const [teams, setTeams] = useState<TeamRef[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/teams?status=active")
      .then((r) => r.json())
      .then((j) => {
        const t = j.data ?? []
        setTeams(t)
        if (t.length === 1) setTeamId(t[0].id)
      })
      .catch(() => {})
  }, [])

  async function handleCreate() {
    if (!name.trim() || !teamId) return
    setSaving(true)
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), team_id: teamId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur création")

      const id = json.data?.id
      if (id) {
        router.push(`/evenements/${id}`)
      } else {
        showToast("Événement créé mais ID non retourné", "error")
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <h1 className="font-serif text-2xl text-brun mb-6 text-center">
        Nouvel événement
      </h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-brun mb-1">
            Nom de l'événement *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && teamId && !saving) {
                void handleCreate()
              }
            }}
            className={INPUT_CLASS}
            placeholder="Ex: Dîner de gala"
            autoFocus
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-brun mb-1">
            Équipe *
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className={`${INPUT_CLASS} appearance-none filter-select-chevron`}
          >
            <option value="">Sélectionner une équipe</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !name.trim() || !teamId}
          className="w-full py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer et éditer"}
        </button>
      </div>
    </div>
  )
}
