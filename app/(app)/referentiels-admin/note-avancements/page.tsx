"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function NoteAvancementsPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global")

  return (
    <SortableReferentialPage
      title="Avancements"
      subtitle="Définissez les statuts d'avancement des notes"
      apiPath="note-progress-statuses"
      canWrite={canWrite}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "color", label: "Couleur", type: "color" },
      ]}
    />
  )
}
