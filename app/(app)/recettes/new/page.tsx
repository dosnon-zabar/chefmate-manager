"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/Toaster"

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

export default function NewRecipePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    try {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur création")

      const id = json.data?.id
      if (id) {
        router.push(`/recettes/${id}`)
      } else {
        showToast("Recette créée mais ID non retourné", "error")
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
        Nouvelle recette
      </h1>
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <div>
          <label className="block text-sm font-medium text-brun mb-1">
            Nom de la recette *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim() && !saving) {
                void handleCreate()
              }
            }}
            className={INPUT_CLASS}
            placeholder="Ex: Tarte aux poireaux"
            autoFocus
          />
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving || !name.trim()}
          className="w-full py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
        >
          {saving ? "Création..." : "Créer et éditer"}
        </button>
      </div>
    </div>
  )
}
