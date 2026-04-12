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
  facebook_url: string | null
  instagram_url: string | null
  linkedin_url: string | null
  youtube_url: string | null
  tiktok_url: string | null
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
  about_text: string | null
  about_seo_title: string | null
  about_seo_desc: string | null
  about_seo_image: string | null
  contact_email: string | null
  contact_phone: string | null
  contact_address: string | null
  footer_text: string | null
  lifecycle_status: string
}

type TabKey = "general" | "accueil" | "recettes" | "evenements" | "apropos" | "footer"

const INPUT = "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

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
    { key: "recettes", label: "Recettes" },
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
      {activeTab === "accueil" && <ContentTab site={site} prefix="home" label="Accueil" onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "recettes" && <ContentTab site={site} prefix="recipes" label="Recettes" onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "evenements" && <ContentTab site={site} prefix="events" label="Événements" onPatch={patchSite} onRefresh={loadSite} />}
      {activeTab === "apropos" && <ContentTab site={site} prefix="about" label="À propos" introField="about_text" onPatch={patchSite} onRefresh={loadSite} />}
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

function ContentTab({ site, prefix, label, introField, onPatch, onRefresh }: {
  site: Site; prefix: string; label: string; introField?: string
  onPatch: (b: Record<string, unknown>) => Promise<boolean>; onRefresh: () => Promise<void>
}) {
  const introKey = introField ?? `${prefix}_intro`
  const seoTitleKey = `${prefix}_seo_title`
  const seoDescKey = `${prefix}_seo_desc`
  const seoImageKey = `${prefix}_seo_image`

  const s = site as unknown as Record<string, unknown>
  const [introText, setIntroText] = useState((s[introKey] as string) ?? "")
  const [seoTitle, setSeoTitle] = useState((s[seoTitleKey] as string) ?? "")
  const [seoDesc, setSeoDesc] = useState((s[seoDescKey] as string) ?? "")
  const [seoImage, setSeoImage] = useState((s[seoImageKey] as string) ?? "")
  const { showToast } = useToast()

  async function saveField(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh() }
  }

  return (
    <div className="space-y-4">
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

      {/* SEO */}
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
