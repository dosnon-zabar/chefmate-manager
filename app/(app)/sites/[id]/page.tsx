"use client"

import dynamic from "next/dynamic"
import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "@/components/Toaster"

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), {
  ssr: false,
  loading: () => <div className="h-24 bg-creme rounded-lg border border-brun/10 animate-pulse" />,
})

interface TeamRef { id: string; name: string }

interface Site {
  id: string
  team_id: string
  team: TeamRef | null
  title: string
  domain: string
  subtitle: string | null
  baseline: string | null
  events_page_enabled: boolean
  about_page_enabled: boolean
  recipes_page_enabled: boolean
  facebook_url: string | null
  instagram_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
  home_hero_image: string | null
  home_intro: string | null
  home_seo_title: string | null
  home_seo_desc: string | null
  home_seo_image: string | null
  recipes_intro: string | null
  recipes_seo_title: string | null
  recipes_seo_desc: string | null
  recipes_seo_image: string | null
  events_intro: string | null
  events_seo_title: string | null
  events_seo_desc: string | null
  events_seo_image: string | null
  about_header_image: string | null
  about_text: string | null
  about_seo_title: string | null
  about_seo_desc: string | null
  about_seo_image: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  footer_text: string | null
  lifecycle_status: string
  // Homepage bloc toggles & content
  home_events_enabled: boolean
  home_past_events_enabled: boolean
  home_recipes_enabled: boolean
  home_about_enabled: boolean
  home_events_title: string | null
  home_events_subtitle: string | null
  home_past_events_title: string | null
  home_past_events_subtitle: string | null
  home_recipes_title: string | null
  home_recipes_subtitle: string | null
  home_about_title: string | null
  home_about_text: string | null
  // Page titles
  recipes_page_title: string | null
  events_page_title: string | null
  about_page_title: string | null
  // About sections
  about_values_enabled: boolean
  about_team_enabled: boolean
  about_contact_enabled: boolean
  about_values_title: string | null
  about_values: { title: string; text: string; icon: string }[] | null
  about_team_title: string | null
  about_team_members: { name: string; role: string; text: string; image_url: string }[] | null
  about_contact_title: string | null
  about_contact_text: string | null
}

type TabKey = "general" | "accueil" | "recettes" | "evenements" | "apropos" | "footer"

const INPUT = "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

function resolveImg(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith("http")) return url
  const base = typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://chefmate-admin.zabar.fr" : "http://localhost:3000"
  return `${base}${url}`
}

export default function SiteEditPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { hasRole } = useAuth()
  const isAdmin = hasRole("Admin global")
  const { showToast } = useToast()

  const [site, setSite] = useState<Site | null>(null)
  const [teams, setTeams] = useState<TeamRef[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>("general")

  const loadSite = useCallback(async () => {
    try {
      const res = await fetch(`/api/sites/${id}`)
      const json = await res.json()
      if (json.data) setSite(json.data)
    } catch { /* silent */ }
  }, [id])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([
        loadSite(),
        fetch("/api/teams?status=active").then(r => r.json()).then(j => setTeams(j.data ?? [])).catch(() => {}),
      ])
      setLoading(false)
    }
    void init()
  }, [loadSite])

  async function patchSite(body: Record<string, unknown>) {
    try {
      const res = await fetch(`/api/sites/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || "Erreur")
      }
      return true
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
      return false
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><p className="text-brun-light italic">Chargement...</p></div>
  if (!site) return (
    <div className="text-center py-20">
      <p className="text-brun-light">Site non trouvé</p>
      <button onClick={() => router.push("/sites")} className="mt-4 text-orange text-sm hover:text-orange-light">Retour à la liste</button>
    </div>
  )

  const tabs: { key: TabKey; label: string; hidden?: boolean }[] = [
    { key: "general", label: "Général" },
    { key: "accueil", label: "Accueil" },
    { key: "recettes", label: "Recettes", hidden: site.recipes_page_enabled === false },
    { key: "evenements", label: "Événements", hidden: !site.events_page_enabled },
    { key: "apropos", label: "À propos", hidden: !site.about_page_enabled },
    { key: "footer", label: "Footer & Contact" },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <button onClick={() => router.push("/sites")} className="text-sm text-brun-light hover:text-brun transition-colors flex items-center gap-1 mb-3">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          Retour aux sites
        </button>
        <h1 className="font-serif text-3xl text-brun">{site.title}</h1>
        <p className="text-sm text-brun-light mt-1">{site.domain}</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-brun/10">
        <nav className="flex gap-0 -mb-px">
          {tabs.filter(t => !t.hidden).map(tab => (
            <button key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.key ? "border-orange text-orange" : "border-transparent text-brun-light hover:text-brun hover:border-brun/20"}`}>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === "general" && <GeneralTab site={site} teams={teams} isAdmin={isAdmin} onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "accueil" && <HomeTab site={site} onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "recettes" && <ContentTab site={site} prefix="recipes" label="Recettes" pageTitleField="recipes_page_title" onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "evenements" && <ContentTab site={site} prefix="events" label="Événements" pageTitleField="events_page_title" onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "apropos" && <AboutTab site={site} onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "footer" && <FooterTab site={site} onPatch={patchSite} onRefresh={loadSite} />}
    </div>
  )
}

// ---- GENERAL TAB ----

function GeneralTab({ site, teams, isAdmin, onPatch, onRefresh }: {
  site: Site; teams: TeamRef[]; isAdmin: boolean
  onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [title, setTitle] = useState(site.title)
  const [subtitle, setSubtitle] = useState(site.subtitle ?? "")
  const [baseline, setBaseline] = useState(site.baseline ?? "")
  const [domain, setDomain] = useState(site.domain)
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg text-brun">Identité</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Titre</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => { if (title.trim() && title !== site.title) saveField("title", title.trim()) }}
              className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Domaine</label>
            <input type="url" value={domain} onChange={e => setDomain(e.target.value)}
              onBlur={() => { if (domain.trim() && domain !== site.domain) saveField("domain", domain.trim().toLowerCase()) }}
              className={INPUT} placeholder="https://monsite.fr" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Sous-titre</label>
            <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)}
              onBlur={() => saveField("subtitle", subtitle.trim() || null)} className={INPUT} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Baseline</label>
            <input type="text" value={baseline} onChange={e => setBaseline(e.target.value)}
              onBlur={() => saveField("baseline", baseline.trim() || null)} className={INPUT} />
          </div>
        </div>

        {/* Team + Status */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Équipe</label>
            <select value={site.team_id} onChange={async e => { if (await onPatch({ team_id: e.target.value })) void onRefresh() }}
              disabled={!isAdmin} className={`${INPUT} appearance-none filter-select-chevron ${!isAdmin ? "opacity-60" : ""}`}>
              {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <div>
              <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Statut</label>
              <select value={site.lifecycle_status} onChange={async e => { if (await onPatch({ lifecycle_status: e.target.value })) void onRefresh() }}
                className={`${INPUT} appearance-none filter-select-chevron`}>
                <option value="active">Actif</option>
                <option value="inactive">Inactif</option>
                <option value="deleted">Supprimé</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Pages activées */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-serif text-lg text-brun">Pages du site</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={site.events_page_enabled}
            onChange={async e => { if (await onPatch({ events_page_enabled: e.target.checked })) void onRefresh() }}
            className="rounded border-brun/20 text-orange focus:ring-orange/30" />
          <span className="text-sm text-brun">Page Événements</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={site.recipes_page_enabled}
            onChange={async e => { if (await onPatch({ recipes_page_enabled: e.target.checked })) void onRefresh() }}
            className="rounded border-brun/20 text-orange focus:ring-orange/30" />
          <span className="text-sm text-brun">Page Recettes</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={site.about_page_enabled}
            onChange={async e => { if (await onPatch({ about_page_enabled: e.target.checked })) void onRefresh() }}
            className="rounded border-brun/20 text-orange focus:ring-orange/30" />
          <span className="text-sm text-brun">Page À propos</span>
        </label>
      </div>

      {/* Réseaux sociaux */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-serif text-lg text-brun">Réseaux sociaux</h2>
        {(["facebook_url", "instagram_url", "linkedin_url", "youtube_url", "tiktok_url"] as const).map(field => (
          <SocialField key={field} field={field} site={site} onPatch={onPatch} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  )
}

function SocialField({ field, site, onPatch, onRefresh }: {
  field: string; site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const labels: Record<string, string> = { facebook_url: "Facebook", instagram_url: "Instagram", linkedin_url: "LinkedIn", youtube_url: "YouTube", tiktok_url: "TikTok" }
  const value = (site as unknown as Record<string, unknown>)[field] as string | null
  const [val, setVal] = useState(value ?? "")
  return (
    <div>
      <label className="text-xs text-brun-light mb-1 block">{labels[field] ?? field}</label>
      <input type="url" value={val} onChange={e => setVal(e.target.value)}
        onBlur={async () => { if (val !== (value ?? "")) { if (await onPatch({ [field]: val.trim() || null })) void onRefresh() } }}
        className={INPUT} placeholder="https://..." />
    </div>
  )
}

// ---- CONTENT TAB (reusable for accueil, recettes, events, about) ----

function SeoCard({ site, prefix, label, onPatch, onRefresh }: {
  site: Site; prefix: string; label: string
  onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const seoTitleKey = `${prefix}_seo_title`
  const seoDescKey = `${prefix}_seo_desc`
  const seoImageKey = `${prefix}_seo_image`
  const s = site as unknown as Record<string, unknown>
  const [seoTitle, setSeoTitle] = useState((s[seoTitleKey] as string) ?? "")
  const [seoDesc, setSeoDesc] = useState((s[seoDescKey] as string) ?? "")
  const [seoImage, setSeoImage] = useState((s[seoImageKey] as string) ?? "")
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <h2 className="font-serif text-lg text-brun">SEO — {label}</h2>
      <div>
        <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Titre SEO</label>
        <input type="text" value={seoTitle} onChange={e => setSeoTitle(e.target.value)}
          onBlur={() => saveField(seoTitleKey, seoTitle.trim() || null)}
          className={INPUT} placeholder="Titre pour les moteurs de recherche" />
        <p className="text-[10px] text-brun-light mt-1">{seoTitle.length}/60 caractères recommandés</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Description SEO</label>
        <textarea value={seoDesc} onChange={e => setSeoDesc(e.target.value)}
          onBlur={() => saveField(seoDescKey, seoDesc.trim() || null)}
          rows={3} className={`${INPUT} resize-none`} placeholder="Description pour les moteurs de recherche" />
        <p className="text-[10px] text-brun-light mt-1">{seoDesc.length}/160 caractères recommandés</p>
      </div>
      <div>
        <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Image OG (Open Graph)</label>
        <input type="text" value={seoImage} onChange={e => setSeoImage(e.target.value)}
          onBlur={() => saveField(seoImageKey, seoImage.trim() || null)}
          className={INPUT} placeholder="URL de l'image de partage" />
        {seoImage && (
          <div className="mt-2 w-48 h-24 rounded-lg border border-brun/10 overflow-hidden">
            <img src={seoImage} alt="OG preview" className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
          </div>
        )}
      </div>
    </div>
  )
}

function ContentTab({ site, prefix, label, introField, pageTitleField, hideSeo, onPatch, onRefresh }: {
  site: Site; prefix: string; label: string; introField?: string; pageTitleField?: string; hideSeo?: boolean
  onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const introKey = introField ?? `${prefix}_intro`

  const s = site as unknown as Record<string, unknown>
  const [introText, setIntroText] = useState((s[introKey] as string) ?? "")
  const [pageTitle, setPageTitle] = useState(pageTitleField ? ((s[pageTitleField] as string) ?? "") : "")
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="space-y-4">
      {/* Page title */}
      {pageTitleField && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="font-serif text-lg text-brun mb-3">Titre de la page</h2>
          <input type="text" value={pageTitle} onChange={e => setPageTitle(e.target.value)}
            onBlur={() => saveField(pageTitleField, pageTitle.trim() || null)}
            className={INPUT} placeholder={`Titre affiché sur la page ${label}`} />
        </div>
      )}

      {/* Intro text */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-lg text-brun mb-3">
          {prefix === "about" ? "Texte principal" : `Texte d'introduction — ${label}`}
        </h2>
        <RichTextEditor
          value={introText}
          onChange={(html) => { setIntroText(html); saveField(introKey, html || null) }}
        />
      </div>

      {/* SEO — only if not handled externally */}
      {!hideSeo && <SeoCard site={site} prefix={prefix} label={label} onPatch={onPatch} onRefresh={onRefresh} />}
    </div>
  )
}

// ---- HOME TAB ----

function HomeTab({ site, onPatch, onRefresh }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [heroUploading, setHeroUploading] = useState(false)
  const { showToast } = useToast()

  async function uploadHero(file: File) {
    setHeroUploading(true)
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("prefix", "hero")
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      const json = await res.json()
      const url = json.data?.url ?? json.url
      if (url && await onPatch({ home_hero_image: url })) { showToast("Image uploadée"); void onRefresh() }
    } catch { showToast("Erreur upload", "error") } finally { setHeroUploading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Hero image */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-serif text-lg text-brun">Image principale (hero)</h2>
        {resolveImg(site.home_hero_image) ? (
          <div className="relative">
            <div className="w-full h-48 rounded-lg border border-brun/10 overflow-hidden">
              <img src={resolveImg(site.home_hero_image)} alt="Hero" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2 mt-2">
              <label className="px-3 py-1.5 text-xs bg-orange text-white rounded-lg hover:bg-orange-light transition-colors cursor-pointer">
                {heroUploading ? "Upload..." : "Changer l'image"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.target.value = "" }} />
              </label>
              <button type="button" onClick={async () => { if (await onPatch({ home_hero_image: null })) { showToast("Image supprimée"); void onRefresh() } }}
                className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-brun/20 rounded-lg cursor-pointer hover:border-orange/40 transition-colors bg-creme/50">
            <span className="text-brun-light text-sm">{heroUploading ? "Upload en cours..." : "Cliquer pour uploader une image"}</span>
            <span className="text-[10px] text-brun-light/60 mt-1">Format recommandé : 1920×600 px</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadHero(f); e.target.value = "" }} />
          </label>
        )}
      </div>

      <ContentTab site={site} prefix="home" label="Accueil" hideSeo onPatch={onPatch} onRefresh={onRefresh} />

      {/* Sections de la page d'accueil */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-6">
        <h2 className="font-serif text-lg text-brun">Sections de la page d&apos;accueil</h2>

        <HomeSectionBlock site={site} onPatch={onPatch} onRefresh={onRefresh}
          enabledField="home_events_enabled" titleField="home_events_title" subtitleField="home_events_subtitle"
          label="Événements à venir" />

        <hr className="border-brun/10" />

        <HomeSectionBlock site={site} onPatch={onPatch} onRefresh={onRefresh}
          enabledField="home_past_events_enabled" titleField="home_past_events_title" subtitleField="home_past_events_subtitle"
          label="Événements passés" />

        <hr className="border-brun/10" />

        <HomeSectionBlock site={site} onPatch={onPatch} onRefresh={onRefresh}
          enabledField="home_recipes_enabled" titleField="home_recipes_title" subtitleField="home_recipes_subtitle"
          label="Recettes" />

        <hr className="border-brun/10" />

        <HomeSectionBlock site={site} onPatch={onPatch} onRefresh={onRefresh}
          enabledField="home_about_enabled" titleField="home_about_title" subtitleField="home_about_text"
          label="À propos" subtitleLabel="Texte" />
      </div>

      <SeoCard site={site} prefix="home" label="Accueil" onPatch={onPatch} onRefresh={onRefresh} />
    </div>
  )
}

function HomeSectionBlock({ site, onPatch, onRefresh, enabledField, titleField, subtitleField, label, subtitleLabel = "Sous-titre" }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
  enabledField: string; titleField: string; subtitleField: string; label: string; subtitleLabel?: string
}) {
  const s = site as unknown as Record<string, unknown>
  const enabled = s[enabledField] as boolean
  const [title, setTitle] = useState((s[titleField] as string) ?? "")
  const [subtitle, setSubtitle] = useState((s[subtitleField] as string) ?? "")
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={enabled}
          onChange={async e => { if (await onPatch({ [enabledField]: e.target.checked })) { showToast("Enregistré"); void onRefresh() } }}
          className="rounded border-brun/20 text-orange focus:ring-orange/30" />
        <span className="text-sm font-medium text-brun">{label}</span>
      </label>
      {enabled && (
        <div className="grid grid-cols-2 gap-4 pl-6">
          <div>
            <label className="text-xs text-brun-light mb-1 block">Titre</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => saveField(titleField, title.trim() || null)}
              className={INPUT} />
          </div>
          <div>
            <label className="text-xs text-brun-light mb-1 block">{subtitleLabel}</label>
            <textarea value={subtitle} onChange={e => setSubtitle(e.target.value)}
              onBlur={() => saveField(subtitleField, subtitle.trim() || null)}
              rows={4} className={`${INPUT} resize-none`} />
          </div>
        </div>
      )}
    </div>
  )
}

// ---- ABOUT TAB ----

function AboutTab({ site, onPatch, onRefresh }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [headerUploading, setHeaderUploading] = useState(false)
  const { showToast } = useToast()

  async function uploadHeader(file: File) {
    setHeaderUploading(true)
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("prefix", "hero")
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      const json = await res.json()
      const url = json.data?.url ?? json.url
      if (url && await onPatch({ about_header_image: url })) { showToast("Image uploadée"); void onRefresh() }
    } catch { showToast("Erreur upload", "error") } finally { setHeaderUploading(false) }
  }

  return (
    <div className="space-y-4">
      {/* Image header */}
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-3">
        <h2 className="font-serif text-lg text-brun">Image d&apos;en-tête</h2>
        {resolveImg(site.about_header_image) ? (
          <div className="relative">
            <div className="w-full h-48 rounded-lg border border-brun/10 overflow-hidden">
              <img src={resolveImg(site.about_header_image)} alt="Header" className="w-full h-full object-cover" />
            </div>
            <div className="flex gap-2 mt-2">
              <label className="px-3 py-1.5 text-xs bg-orange text-white rounded-lg hover:bg-orange-light transition-colors cursor-pointer">
                {headerUploading ? "Upload..." : "Changer l'image"}
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeader(f); e.target.value = "" }} />
              </label>
              <button type="button" onClick={async () => { if (await onPatch({ about_header_image: null })) { showToast("Image supprimée"); void onRefresh() } }}
                className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                Supprimer
              </button>
            </div>
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-brun/20 rounded-lg cursor-pointer hover:border-orange/40 transition-colors bg-creme/50">
            <span className="text-brun-light text-sm">{headerUploading ? "Upload en cours..." : "Cliquer pour uploader une image"}</span>
            <span className="text-[10px] text-brun-light/60 mt-1">Image affichée en haut de la page À propos</span>
            <input type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadHeader(f); e.target.value = "" }} />
          </label>
        )}
      </div>

      <ContentTab site={site} prefix="about" label="À propos" introField="about_text" pageTitleField="about_page_title" hideSeo onPatch={onPatch} onRefresh={onRefresh} />
      <AboutValuesSection site={site} onPatch={onPatch} onRefresh={onRefresh} />
      <AboutTeamSection site={site} onPatch={onPatch} onRefresh={onRefresh} />
      <AboutContactSection site={site} onPatch={onPatch} onRefresh={onRefresh} />
      <SeoCard site={site} prefix="about" label="À propos" onPatch={onPatch} onRefresh={onRefresh} />
    </div>
  )
}

function AboutValuesSection({ site, onPatch, onRefresh }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [title, setTitle] = useState(site.about_values_title ?? "")
  const [values, setValues] = useState<{ title: string; text: string; icon: string }[]>(site.about_values ?? [])
  const [uploading, setUploading] = useState<number | null>(null)
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  function updateValue(index: number, key: "title" | "text" | "icon", val: string) {
    const next = [...values]
    next[index] = { ...next[index], [key]: val }
    setValues(next)
  }

  async function saveValues(updated?: typeof values) {
    const v = updated ?? values
    await saveField("about_values", v.length ? v : null)
  }

  function addValue() {
    const next = [...values, { title: "", text: "", icon: "" }]
    setValues(next)
  }

  async function removeValue(index: number) {
    const next = values.filter((_, i) => i !== index)
    setValues(next)
    await saveValues(next)
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-brun">Nos valeurs</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={site.about_values_enabled}
            onChange={async e => { if (await onPatch({ about_values_enabled: e.target.checked })) { showToast("Enregistré"); void onRefresh() } }}
            className="rounded border-brun/20 text-orange focus:ring-orange/30" />
          <span className="text-xs text-brun-light">Activé</span>
        </label>
      </div>

      {site.about_values_enabled && (
        <>
          <div>
            <label className="text-xs text-brun-light mb-1 block">Titre de la section</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => saveField("about_values_title", title.trim() || null)}
              className={INPUT} placeholder="Nos valeurs" />
          </div>

          <div className="space-y-3">
            {values.map((v, i) => (
              <div key={i} className="border border-brun/10 rounded-xl p-3 space-y-2">
                <div className="flex gap-3 items-start">
                  {/* Picto */}
                  <div className="flex-shrink-0">
                    {resolveImg(v.icon) ? (
                      <div className="w-14 h-14 rounded-lg border border-brun/10 overflow-hidden bg-creme">
                        <img src={resolveImg(v.icon)} alt="" className="w-full h-full object-contain"
                          onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                      </div>
                    ) : (
                      <div className="w-14 h-14 rounded-lg border border-dashed border-brun/20 flex items-center justify-center bg-creme">
                        <span className="text-lg text-brun-light/40">✦</span>
                      </div>
                    )}
                    <label className="mt-1 block text-center">
                      <span className="text-[10px] text-orange cursor-pointer hover:text-orange-light">
                        {uploading === i ? "..." : "Picto"}
                      </span>
                      <input type="file" accept="image/*" className="hidden"
                        onChange={async e => {
                          const file = e.target.files?.[0]; if (!file) return
                          setUploading(i)
                          try {
                            const fd = new FormData(); fd.append("file", file); fd.append("prefix", "valeurs")
                            const res = await fetch("/api/upload-image", { method: "POST", body: fd })
                            const json = await res.json()
                            const url = json.data?.url ?? json.url
                            if (url) { updateValue(i, "icon", url); const next = [...values]; next[i] = { ...next[i], icon: url }; await saveValues(next); showToast("Picto uploadé") }
                          } catch { showToast("Erreur upload", "error") } finally { setUploading(null); e.target.value = "" }
                        }} />
                    </label>
                  </div>
                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="text" value={v.title} onChange={e => updateValue(i, "title", e.target.value)}
                        onBlur={() => saveValues()} className={`${INPUT} flex-1`} placeholder="Titre de la valeur" />
                      <button type="button" onClick={() => removeValue(i)}
                        className="px-2 py-1 text-red-400 hover:text-red-600 transition-colors text-sm">✕</button>
                    </div>
                    <textarea value={v.text} onChange={e => updateValue(i, "text", e.target.value)}
                      onBlur={() => saveValues()} rows={4} className={`${INPUT} resize-none`} placeholder="Description de la valeur" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addValue}
            className="text-sm text-orange hover:text-orange-light transition-colors">
            + Ajouter une valeur
          </button>
        </>
      )}
    </div>
  )
}

function AboutTeamSection({ site, onPatch, onRefresh }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [title, setTitle] = useState(site.about_team_title ?? "")
  const [members, setMembers] = useState<{ name: string; role: string; text: string; image_url: string }[]>(site.about_team_members ?? [])
  const [uploading, setUploading] = useState<number | null>(null)
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  function updateMember(index: number, key: "name" | "role" | "text" | "image_url", val: string) {
    const next = [...members]
    next[index] = { ...next[index], [key]: val }
    setMembers(next)
  }

  async function saveMembers(updated?: typeof members) {
    const m = updated ?? members
    await saveField("about_team_members", m.length ? m : null)
  }

  function addMember() {
    const next = [...members, { name: "", role: "", text: "", image_url: "" }]
    setMembers(next)
  }

  async function removeMember(index: number) {
    const next = members.filter((_, i) => i !== index)
    setMembers(next)
    await saveMembers(next)
  }

  async function uploadImage(index: number, file: File) {
    setUploading(index)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("prefix", "equipe")
      const res = await fetch("/api/upload-image", { method: "POST", body: formData })
      const json = await res.json()
      const url = json.data?.url ?? json.url
      if (url) {
        const next = [...members]
        next[index] = { ...next[index], image_url: url }
        setMembers(next)
        await saveMembers(next)
        showToast("Image uploadée")
      }
    } catch {
      showToast("Erreur upload", "error")
    } finally {
      setUploading(null)
    }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-brun">Équipe</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={site.about_team_enabled}
            onChange={async e => { if (await onPatch({ about_team_enabled: e.target.checked })) { showToast("Enregistré"); void onRefresh() } }}
            className="rounded border-brun/20 text-orange focus:ring-orange/30" />
          <span className="text-xs text-brun-light">Activé</span>
        </label>
      </div>

      {site.about_team_enabled && (
        <>
          <div>
            <label className="text-xs text-brun-light mb-1 block">Titre de la section</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => saveField("about_team_title", title.trim() || null)}
              className={INPUT} placeholder="Notre équipe" />
          </div>

          <div className="space-y-4">
            {members.map((m, i) => (
              <div key={i} className="border border-brun/10 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4 items-start flex-1">
                    {/* Photo */}
                    <div className="flex-shrink-0">
                      {resolveImg(m.image_url) ? (
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-brun/10">
                          <img src={resolveImg(m.image_url)} alt={m.name} className="w-full h-full object-cover"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-lg border border-dashed border-brun/20 flex items-center justify-center bg-creme">
                          <span className="text-2xl text-brun-light/40">👤</span>
                        </div>
                      )}
                      <label className="mt-1 block text-center">
                        <span className="text-[10px] text-orange cursor-pointer hover:text-orange-light">
                          {uploading === i ? "Upload..." : "Photo"}
                        </span>
                        <input type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(i, f); e.target.value = "" }} />
                      </label>
                    </div>
                    {/* Infos */}
                    <div className="flex-1 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input type="text" value={m.name} onChange={e => updateMember(i, "name", e.target.value)}
                          onBlur={() => saveMembers()} className={INPUT} placeholder="Nom" />
                        <input type="text" value={m.role} onChange={e => updateMember(i, "role", e.target.value)}
                          onBlur={() => saveMembers()} className={INPUT} placeholder="Rôle / Fonction" />
                      </div>
                      <textarea value={m.text ?? ""} onChange={e => updateMember(i, "text", e.target.value)}
                        onBlur={() => saveMembers()} rows={4} className={`${INPUT} resize-none`} placeholder="Description / Bio" />
                    </div>
                  </div>
                  <button type="button" onClick={() => removeMember(i)}
                    className="px-2 py-1 text-red-400 hover:text-red-600 transition-colors text-sm ml-2">✕</button>
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={addMember}
            className="text-sm text-orange hover:text-orange-light transition-colors">
            + Ajouter un membre
          </button>
        </>
      )}
    </div>
  )
}

function AboutContactSection({ site, onPatch, onRefresh }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [title, setTitle] = useState(site.about_contact_title ?? "")
  const [text, setText] = useState(site.about_contact_text ?? "")
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-lg text-brun">Contact</h2>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={site.about_contact_enabled}
            onChange={async e => { if (await onPatch({ about_contact_enabled: e.target.checked })) { showToast("Enregistré"); void onRefresh() } }}
            className="rounded border-brun/20 text-orange focus:ring-orange/30" />
          <span className="text-xs text-brun-light">Activé</span>
        </label>
      </div>

      {site.about_contact_enabled && (
        <>
          <div>
            <label className="text-xs text-brun-light mb-1 block">Titre de la section</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => saveField("about_contact_title", title.trim() || null)}
              className={INPUT} placeholder="Contactez-nous" />
          </div>
          <div>
            <label className="text-xs text-brun-light mb-1 block">Texte</label>
            <RichTextEditor
              value={text}
              onChange={(html) => { setText(html); saveField("about_contact_text", html || null) }}
            />
          </div>
        </>
      )}
    </div>
  )
}

// ---- FOOTER TAB ----

function FooterTab({ site, onPatch, onRefresh }: {
  site: Site; onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const [email, setEmail] = useState(site.contact_email ?? "")
  const [phone, setPhone] = useState(site.contact_phone ?? "")
  const [address, setAddress] = useState(site.contact_address ?? "")
  const [footerText, setFooterText] = useState(site.footer_text ?? "")
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="font-serif text-lg text-brun">Contact</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              onBlur={() => saveField("contact_email", email.trim() || null)}
              className={INPUT} placeholder="contact@monsite.fr" />
          </div>
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Téléphone</label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              onBlur={() => saveField("contact_phone", phone.trim() || null)}
              className={INPUT} placeholder="06 12 34 56 78" />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Adresse</label>
          <input type="text" value={address} onChange={e => setAddress(e.target.value)}
            onBlur={() => saveField("contact_address", address.trim() || null)}
            className={INPUT} placeholder="123 rue du Chef, 75001 Paris" />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-lg text-brun mb-3">Texte du footer</h2>
        <RichTextEditor
          value={footerText}
          onChange={(html) => { setFooterText(html); saveField("footer_text", html || null) }}
        />
      </div>
    </div>
  )
}
