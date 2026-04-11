"use client"

import { useAuth } from "@/lib/auth/auth-context"
import ReferentialPage from "@/components/ReferentialPage"

export default function TagsPage() {
  const { hasRole } = useAuth()
  const canWrite = hasRole("Admin global") || hasRole("Admin contenu")

  return (
    <ReferentialPage
      title="Tags"
      subtitle="Gérez les tags et étiquettes"
      apiPath="tags"
      canWrite={canWrite}
      fields={[
        { key: "name", label: "Nom", type: "text", required: true },
      ]}
    />
  )
}
