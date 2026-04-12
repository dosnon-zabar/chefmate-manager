"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function UnitesPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global") || hasRole("Admin contenu")

  return (
    <SortableReferentialPage
      title="Unités"
      subtitle="Gérez les unités de mesure par glisser-déposer"
      apiPath="units"
      canWrite={canWrite}
      labelKey="name"
      secondaryKey="abbreviation"
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "abbreviation", label: "Abréviation", type: "text", required: true, placeholder: "g, kg, mL..." },
        { key: "abbreviation_plural", label: "Pluriel", type: "text", placeholder: "bottes, pincées..." },
      ]}
    />
  )
}
