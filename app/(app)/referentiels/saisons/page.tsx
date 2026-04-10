"use client"

import { useAuth } from "@/lib/auth/auth-context"
import SortableReferentialPage from "@/components/SortableReferentialPage"

export default function SaisonsPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global")

  return (
    <SortableReferentialPage
      title="Saisons"
      subtitle="Définissez les saisons par glisser-déposer"
      apiPath="seasons"
      canWrite={canWrite}
      prefixKey="icon"
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
        { key: "icon", label: "Icône", type: "text", placeholder: "🌸 ☀️ 🍂 ❄️" },
      ]}
    />
  )
}
