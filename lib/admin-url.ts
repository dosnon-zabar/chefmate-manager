/**
 * Base URL of the chefmate-admin application (CDN + API).
 * Used to resolve relative image URLs returned by the admin API.
 *
 * Returns the prod URL when running on a non-localhost host,
 * and localhost:3000 otherwise (dev mode).
 *
 * Change ADMIN_PROD_URL here to migrate the whole app to a new domain.
 */

export const ADMIN_PROD_URL = "https://admin.brigades.fr"
export const ADMIN_DEV_URL = "http://localhost:3000"

export function getAdminBase(): string {
  if (typeof window !== "undefined" && window.location.hostname !== "localhost") {
    return ADMIN_PROD_URL
  }
  return ADMIN_DEV_URL
}

/**
 * Resolve a potentially relative image URL (returned by the admin API
 * as `/api/images/...`) into a fully qualified URL that works from
 * the manager's domain.
 */
export function resolveAdminUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith("http")) return url
  return `${getAdminBase()}${url}`
}
