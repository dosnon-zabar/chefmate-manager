"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function NoteFamillesPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global")

  return (
    <SortableReferentialPage
      title="Familles de notes"
      subtitle="Organisez les familles de notes d'évolution"
      apiPath="note-families"
      canWrite={canWrite}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "color", label: "Couleur", type: "color" },
      ]}
    />
  )
}
