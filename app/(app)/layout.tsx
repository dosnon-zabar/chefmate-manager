import { redirect } from "next/navigation"
import { readSession } from "@/lib/session"
import { AuthProvider } from "@/lib/auth/auth-context"
import Sidebar from "@/components/Sidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await readSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <AuthProvider initialUser={session.user}>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-8 bg-creme">{children}</main>
      </div>
    </AuthProvider>
  )
}
