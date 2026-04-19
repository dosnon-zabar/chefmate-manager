"use client"

/**
 * SessionGuard — global 401 interceptor for browser-side fetches.
 *
 * Why: the backend can revoke a user's session at any time (logout from
 * another device, password change, role change, admin deactivation).
 * When that happens, our next API call returns 401 — but the page that
 * triggered the call stays mounted with partial state unless we handle
 * the response at a central point.
 *
 * What it does:
 *  - Patches `window.fetch` once at mount time.
 *  - On a 401 response to a `/api/*` URL, shows a toast and redirects
 *    to /login. Excludes `/api/session` GET which is the "am I logged
 *    in?" check and legitimately returns 401 for anonymous visitors.
 *  - Idempotent: survives React StrictMode double-mount and HMR.
 *
 * The server-side cascade (admin 401 → manager clears cm_session cookie
 * in lib/api.ts) handles the cookie cleanup. This component is purely
 * responsible for navigating the user away from a now-useless page.
 */

import { useEffect } from "react"
import { usePathname } from "next/navigation"

const ORIGINAL_FETCH_KEY = "__chefmate_session_guard_patched__"

/**
 * Paths that legitimately return 401 for anonymous users and that the
 * client handles on its own. Don't let the interceptor redirect on those.
 */
const EXCLUDED_PATHS = ["/api/session"]

function isExcluded(url: string): boolean {
  // Only run on same-origin /api/* paths. External fetches are ignored.
  if (url.startsWith("http://") || url.startsWith("https://")) {
    try {
      const u = new URL(url)
      if (u.origin !== window.location.origin) return true
      return EXCLUDED_PATHS.some((p) => u.pathname === p)
    } catch {
      return true
    }
  }
  if (!url.startsWith("/api/")) return true
  return EXCLUDED_PATHS.some((p) => url === p)
}

export function SessionGuard() {
  const pathname = usePathname()

  useEffect(() => {
    // Never redirect when the user is already on the login page. Prevents
    // loops if /api/session itself returned 401 during an anonymous visit.
    if (pathname === "/login") return

    // Guard against double-patching. The original fetch is stashed on the
    // window so we can re-wrap on HMR without chaining wrappers forever.
    const w = window as unknown as {
      [ORIGINAL_FETCH_KEY]?: typeof fetch
      fetch: typeof fetch
    }

    if (!w[ORIGINAL_FETCH_KEY]) {
      w[ORIGINAL_FETCH_KEY] = w.fetch.bind(window)
    }
    const originalFetch = w[ORIGINAL_FETCH_KEY]!

    w.fetch = async (input, init) => {
      const response = await originalFetch(input, init)

      if (response.status === 401) {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : ""

        if (!isExcluded(url)) {
          // Hard navigation to /login?expired=1. A toast on the current
          // page wouldn't be visible because the nav wipes React state
          // immediately — the URL param lets the login page display the
          // "session expirée" banner instead.
          window.location.href = "/login?expired=1"
        }
      }

      return response
    }

    return () => {
      // Restore on unmount — avoids a leaked wrapper if the guard is
      // ever unmounted without a page reload.
      const restore = w[ORIGINAL_FETCH_KEY]
      if (restore) w.fetch = restore
    }
  }, [pathname])

  return null
}
