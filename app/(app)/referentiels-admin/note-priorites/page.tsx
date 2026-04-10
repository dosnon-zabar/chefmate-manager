"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function NotePrioritesPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global")

  return (
    <SortableReferentialPage
      title="Priorités"
      subtitle="Gérez les niveaux de priorité des notes"
      apiPath="note-priorities"
      canWrite={canWrite}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "color", label: "Couleur", type: "color" },
      ]}
    />
  )
}
