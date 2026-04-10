"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import SidePanel from "./SidePanel"

export type SiteLifecycleStatus = "active" | "inactive" | "deleted"

export interface SiteRow {
  id: string
  team_id: string
  title: string
  domain: string
  subtitle: string | null
  baseline: string | null
  events_page_enabled: boolean
  about_page_enabled: boolean
  facebook_url: string | null
  instagram_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  lifecycle_status: SiteLifecycleStatus
  created_at: string
  updated_at: string
  team: { id: string; name: string } | null
}

interface TeamOption {
  id: string
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  site: SiteRow | null
  onSaved: (message?: string) => void
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

export default function SiteFormPanel({
  open,
  onClose,
  site,
  onSaved,
}: Props) {
  const { hasRole } = useAuth()
  const isCallerAdminGlobal = hasRole("Admin global")

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teams, setTeams] = useState<TeamOption[]>([])

  // Fields
  const [teamId, setTeamId] = useState("")
  const [title, setTitle] = useState("")
  const [domain, setDomain] = useState("")
  const [subtitle, setSubtitle] = useState("")
  const [baseline, setBaseline] = useState("")
  const [eventsPageEnabled, setEventsPageEnabled] = useState(false)
  const [aboutPageEnabled, setAboutPageEnabled] = useState(false)
  const [facebookUrl, setFacebookUrl] = useState("")
  const [instagramUrl, setInstagramUrl] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [youtubeUrl, setYoutubeUrl] = useState("")
  const [tiktokUrl, setTiktokUrl] = useState("")
  const [lifecycleStatus, setLifecycleStatus] =
    useState<SiteLifecycleStatus>("active")

  const isCreation = !site

  useEffect(() => {
    if (!open) return
    setError(null)

    // Load teams for the dropdown
    fetch("/api/teams")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json) => setTeams(json.data || []))
      .catch(() => setTeams([]))

    if (site) {
      setTeamId(site.team_id)
      setTitle(site.title)
      setDomain(site.domain)
      setSubtitle(site.subtitle || "")
      setBaseline(site.baseline || "")
      setEventsPageEnabled(site.events_page_enabled)
      setAboutPageEnabled(site.about_page_enabled)
      setFacebookUrl(site.facebook_url || "")
      setInstagramUrl(site.instagram_url || "")
      setLinkedinUrl(site.linkedin_url || "")
      setYoutubeUrl(site.youtube_url || "")
      setTiktokUrl(site.tiktok_url || "")
      setLifecycleStatus(site.lifecycle_status)
    } else {
      setTeamId("")
      setTitle("")
      setDomain("")
      setSubtitle("")
      setBaseline("")
      setEventsPageEnabled(false)
      setAboutPageEnabled(false)
      setFacebookUrl("")
      setInstagramUrl("")
      setLinkedinUrl("")
      setYoutubeUrl("")
      setTiktokUrl("")
      setLifecycleStatus("active")
    }
  }, [open, site])

  const titleValid = title.trim().length > 0
  const domainValid =
    domain.trim().length > 0 && /^https?:\/\/.+\..+/.test(domain.trim())
  const teamValid = teamId.length > 0

  async function handleSave() {
    setError(null)
    if (!titleValid) {
      setError("Le titre est obligatoire")
      return
    }
    if (!domainValid) {
      setError(
        "Le domaine doit être une URL valide (ex: https://monsite.fr)"
      )
      return
    }
    if (isCreation && !teamValid) {
      setError("Veuillez sélectionner une équipe")
      return
    }

    setSaving(true)
    try {
      if (isCreation) {
        const body: Record<string, unknown> = {
          team_id: teamId,
          title: title.trim(),
          domain: domain.trim().toLowerCase(),
          subtitle: subtitle.trim() || null,
          baseline: baseline.trim() || null,
          events_page_enabled: eventsPageEnabled,
          about_page_enabled: aboutPageEnabled,
          facebook_url: facebookUrl.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          tiktok_url: tiktokUrl.trim() || null,
        }
        const res = await fetch("/api/sites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur création")
        onSaved(`Le site "${title.trim()}" a été créé.`)
      } else {
        const body: Record<string, unknown> = {
          title: title.trim(),
          domain: domain.trim().toLowerCase(),
          subtitle: subtitle.trim() || null,
          baseline: baseline.trim() || null,
          events_page_enabled: eventsPageEnabled,
          about_page_enabled: aboutPageEnabled,
          facebook_url: facebookUrl.trim() || null,
          instagram_url: instagramUrl.trim() || null,
          linkedin_url: linkedinUrl.trim() || null,
          youtube_url: youtubeUrl.trim() || null,
          tiktok_url: tiktokUrl.trim() || null,
        }
        if (isCallerAdminGlobal) {
          body.lifecycle_status = lifecycleStatus
          body.team_id = teamId
        }
        const res = await fetch(`/api/sites/${site.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || "Erreur mise à jour")
        onSaved(`Le site "${title.trim()}" a été mis à jour.`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur")
    } finally {
      setSaving(false)
    }
  }

  const footer = (
    <>
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        className="px-4 py-2 text-sm text-brun-light hover:text-brun transition-colors"
      >
        Annuler
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !titleValid || !domainValid || (isCreation && !teamValid)}
        className="px-4 py-2 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving
          ? "Enregistrement..."
          : isCreation
            ? "Créer"
            : "Enregistrer"}
      </button>
    </>
  )

  return (
    <SidePanel
      open={open}
      onClose={onClose}
      title={isCreation ? "Nouveau site" : "Modifier le site"}
      subtitle={
        isCreation
          ? "Renseignez les informations du site"
          : "Modifiez les informations du site"
      }
      footer={footer}
      width="lg"
    >
      <div className="space-y-5">
        {error && (
          <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Équipe */}
        <Field label="Équipe" required>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            disabled={!isCreation && !isCallerAdminGlobal}
            className={INPUT_CLASS}
          >
            <option value="">Sélectionner une équipe</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Titre" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLASS}
              placeholder="Mon site"
            />
          </Field>
          <Field label="Domaine" required>
            <input
              type="url"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className={INPUT_CLASS}
              placeholder="https://monsite.fr"
            />
          </Field>
        </div>

        <Field label="Sous-titre">
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className={INPUT_CLASS}
          />
        </Field>

        <Field label="Baseline">
          <textarea
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </Field>

        {/* Pages activées */}
        <div className="border-t border-brun/10 pt-5">
          <h3 className="font-semibold text-brun mb-3 text-sm">Pages</h3>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={eventsPageEnabled}
                onChange={(e) => setEventsPageEnabled(e.target.checked)}
              />
              <span>Page événements</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={aboutPageEnabled}
                onChange={(e) => setAboutPageEnabled(e.target.checked)}
              />
              <span>Page à propos</span>
            </label>
          </div>
        </div>

        {/* Réseaux sociaux */}
        <div className="border-t border-brun/10 pt-5">
          <h3 className="font-semibold text-brun mb-3 text-sm">
            Réseaux sociaux
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Facebook">
              <input
                type="url"
                value={facebookUrl}
                onChange={(e) => setFacebookUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://facebook.com/..."
              />
            </Field>
            <Field label="Instagram">
              <input
                type="url"
                value={instagramUrl}
                onChange={(e) => setInstagramUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://instagram.com/..."
              />
            </Field>
            <Field label="LinkedIn">
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://linkedin.com/..."
              />
            </Field>
            <Field label="YouTube">
              <input
                type="url"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://youtube.com/..."
              />
            </Field>
            <Field label="TikTok">
              <input
                type="url"
                value={tiktokUrl}
                onChange={(e) => setTiktokUrl(e.target.value)}
                className={INPUT_CLASS}
                placeholder="https://tiktok.com/..."
              />
            </Field>
          </div>
        </div>

        {/* Statut — Admin global only, edit only */}
        {!isCreation && isCallerAdminGlobal && (
          <div className="border-t border-brun/10 pt-5">
            <Field label="Statut">
              <select
                value={lifecycleStatus}
                onChange={(e) =>
                  setLifecycleStatus(
                    e.target.value as SiteLifecycleStatus
                  )
                }
                className={INPUT_CLASS}
              >
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="deleted">Supprimé</option>
              </select>
            </Field>
          </div>
        )}
      </div>
    </SidePanel>
  )
}

function Field({
  label,
  children,
  required,
}: {
  label: string
  children: React.ReactNode
  required?: boolean
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-brun mb-1">
        {label}
        {required && " *"}
      </label>
      {children}
    </div>
  )
}
