import { redirect } from "next/navigation"
import { readSession } from "@/lib/session"
import { apiFetchServer, ApiError } from "@/lib/api"
import { AuthProvider } from "@/lib/auth/auth-context"
import Sidebar from "@/components/Sidebar"
import { ToastProvider } from "@/components/Toaster"
import { ThemeProvider } from "@/components/ThemeProvider"
import { SessionGuard } from "@/components/SessionGuard"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await readSession()
  if (!session) {
    redirect("/login")
  }

  // Confirm with admin that our embedded apiToken is still honored.
  // readSession() above is purely local (decodes our own cookie), so it
  // can't detect that admin has revoked the session (logout elsewhere,
  // password change, role change, deactivation, session_version bump).
  // Without this ping, a refresh on a fully server-rendered page (no
  // client-side /api/* calls) would show the user stale permissions
  // until they navigate to a page that does fetch data.
  //
  // /auth/me is the cheapest endpoint to validate the bearer. Only 401
  // triggers a redirect — transient failures (admin down, 5xx, network
  // blip) are tolerated so a flaky admin doesn't brick the manager UI.
  // The local readSession snapshot will be used as a fallback until the
  // next page load.
  try {
    await apiFetchServer<unknown>("/auth/me")
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      // apiFetchServer already cleared cm_session on 401 via baseFetch
      // (best-effort — may be a no-op in this Server Component context
      // where cookie writes are read-only). The exception on
      // /login?expired=1 in middleware prevents a redirect loop when
      // the locally-valid cookie is still present.
      redirect("/login?expired=1")
    }
    // Non-401 (network error, 5xx, timeout): log and let the page render
    // with the local session snapshot. A transient admin glitch shouldn't
    // brick the manager UI — the user might see slightly stale data for
    // one request, which the next navigation will refresh.
    console.error(
      "AppLayout: /auth/me ping failed (non-401), continuing with local session",
      e
    )
  }

  return (
    <AuthProvider initialUser={session.user}>
      <ThemeProvider>
        <ToastProvider>
          {/*
            SessionGuard patches window.fetch to redirect to /login on 401
            from /api/* — covers all the ad-hoc fetch calls scattered
            across feature pages without having to wrap each one.
          */}
          <SessionGuard />
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-8 bg-creme">{children}</main>
          </div>
        </ToastProvider>
      </ThemeProvider>
    </AuthProvider>
  )
}
