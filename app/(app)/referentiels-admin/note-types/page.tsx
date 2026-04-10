"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function NoteTypesPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global")

  return (
    <SortableReferentialPage
      title="Types de notes"
      subtitle="Gérez les types de notes d'évolution"
      apiPath="note-types"
      canWrite={canWrite}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "color", label: "Couleur", type: "color" },
      ]}
    />
  )
}
