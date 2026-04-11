"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function PortionTypesPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global") || hasRole("Admin contenu")

  return (
    <SortableReferentialPage
      title="Types de portions"
      subtitle="Gérez les types de portions pour les recettes"
      apiPath="portion-types"
      canWrite={canWrite}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true, placeholder: "personnes, parts, bouchées..." },
      ]}
    />
  )
}
