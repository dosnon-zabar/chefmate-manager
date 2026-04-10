"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface DocFile {
  file: string
  domain: string
  isFollowup: boolean
}

interface GuidePage {
  id: string
  title: string
  parent_id: string | null
  sort_order: number
}

export default function DocumentationPage() {
  // MD docs
  const [docFiles, setDocFiles] = useState<DocFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [mdContent, setMdContent] = useState<string>("")
  const [loadingMd, setLoadingMd] = useState(false)

  // BlockNote guides
  const [guides, setGuides] = useState<GuidePage[]>([])
  const [selectedGuide, setSelectedGuide] = useState<string | null>(null)
  const [guideContent, setGuideContent] = useState<unknown>(null)
  const [guideTitle, setGuideTitle] = useState("")
  const [loadingGuide, setLoadingGuide] = useState(false)

  const [activeTab, setActiveTab] = useState<"tech" | "guides">("tech")

  // Load file list + guide list on mount
  useEffect(() => {
    fetch("/api/docs")
      .then((r) => r.json())
      .then((json) => setDocFiles(json.data ?? []))
      .catch(() => {})

    fetch("/api/docs/guides")
      .then((r) => r.json())
      .then((json) => setGuides(json.data ?? []))
      .catch(() => {})
  }, [])

  // Group MD files by domain
  const groupedDocs = useMemo(() => {
    const map = new Map<
      string,
      { rules?: DocFile; followups?: DocFile }
    >()
    for (const f of docFiles) {
      const entry = map.get(f.domain) || {}
      if (f.isFollowup) entry.followups = f
      else entry.rules = f
      map.set(f.domain, entry)
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[0].localeCompare(b[0])
    )
  }, [docFiles])

  // Guide tree (root pages)
  const rootGuides = useMemo(
    () =>
      guides
        .filter((g) => !g.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [guides]
  )
  const childGuides = useMemo(() => {
    const map = new Map<string, GuidePage[]>()
    for (const g of guides) {
      if (g.parent_id) {
        const list = map.get(g.parent_id) || []
        list.push(g)
        map.set(g.parent_id, list)
      }
    }
    return map
  }, [guides])

  // Load a specific MD file
  const loadMdFile = useCallback(async (file: string) => {
    setSelectedFile(file)
    setSelectedGuide(null)
    setLoadingMd(true)
    try {
      const res = await fetch(`/api/docs?file=${encodeURIComponent(file)}`)
      const json = await res.json()
      setMdContent(json.data?.content || "Fichier non trouvé")
    } catch {
      setMdContent("Erreur de chargement")
    } finally {
      setLoadingMd(false)
    }
  }, [])

  // Load a specific guide
  const loadGuide = useCallback(async (id: string, title: string) => {
    setSelectedGuide(id)
    setSelectedFile(null)
    setGuideTitle(title)
    setLoadingGuide(true)
    try {
      const res = await fetch(`/api/docs/guides?id=${id}`)
      const json = await res.json()
      setGuideContent(json.data?.content)
    } catch {
      setGuideContent(null)
    } finally {
      setLoadingGuide(false)
    }
  }, [])

  const domainLabels: Record<string, string> = {
    "user-management": "Utilisateurs",
    "team-management": "Équipes",
    "site-management": "Sites",
    "referentials-ingredients": "Référentiels & Ingrédients",
    evolutions: "Évolutions",
    "technical-health": "Santé technique",
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brun">Documentation</h1>
        <p className="text-sm text-brun-light mt-1">
          Documentation technique et guides utilisateur
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("tech")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === "tech"
              ? "bg-orange text-white"
              : "bg-white text-brun hover:bg-creme"
          }`}
        >
          Documentation technique
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("guides")}
          className={`px-4 py-2 text-sm rounded-lg transition-colors ${
            activeTab === "guides"
              ? "bg-orange text-white"
              : "bg-white text-brun hover:bg-creme"
          }`}
        >
          Guides utilisateur
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar nav */}
        <div className="w-56 flex-shrink-0">
          {activeTab === "tech" && (
            <nav className="space-y-4">
              {groupedDocs.map(([domain, files]) => (
                <div key={domain}>
                  <h3 className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1.5">
                    {domainLabels[domain] || domain}
                  </h3>
                  <div className="space-y-0.5">
                    {files.rules && (
                      <button
                        type="button"
                        onClick={() => loadMdFile(files.rules!.file)}
                        className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                          selectedFile === files.rules!.file
                            ? "bg-orange/10 text-orange font-medium"
                            : "text-brun hover:bg-creme"
                        }`}
                      >
                        Règles métier
                      </button>
                    )}
                    {files.followups && (
                      <button
                        type="button"
                        onClick={() => loadMdFile(files.followups!.file)}
                        className={`block w-full text-left px-2 py-1 text-xs rounded transition-colors ${
                          selectedFile === files.followups!.file
                            ? "bg-orange/10 text-orange font-medium"
                            : "text-brun-light hover:bg-creme"
                        }`}
                      >
                        Follow-ups
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </nav>
          )}

          {activeTab === "guides" && (
            <nav className="space-y-1">
              {rootGuides.map((guide) => {
                const children = childGuides.get(guide.id) || []
                return (
                  <div key={guide.id}>
                    <button
                      type="button"
                      onClick={() => loadGuide(guide.id, guide.title)}
                      className={`block w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                        selectedGuide === guide.id
                          ? "bg-orange/10 text-orange font-medium"
                          : "text-brun hover:bg-creme font-medium"
                      }`}
                    >
                      {guide.title}
                    </button>
                    {children
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() =>
                            loadGuide(child.id, child.title)
                          }
                          className={`block w-full text-left px-4 py-1 text-xs rounded transition-colors ${
                            selectedGuide === child.id
                              ? "bg-orange/10 text-orange"
                              : "text-brun-light hover:bg-creme"
                          }`}
                        >
                          {child.title}
                        </button>
                      ))}
                  </div>
                )
              })}
              {guides.length === 0 && (
                <p className="text-xs text-brun-light italic px-2">
                  Aucun guide disponible
                </p>
              )}
            </nav>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          {!selectedFile && !selectedGuide && (
            <div className="bg-white rounded-2xl p-8 text-center">
              <p className="text-brun-light text-sm">
                Sélectionnez un document dans le menu de gauche.
              </p>
            </div>
          )}

          {/* Markdown content */}
          {selectedFile && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              {loadingMd ? (
                <p className="text-sm text-brun-light italic">
                  Chargement...
                </p>
              ) : (
                <article className="prose prose-sm max-w-none text-brun prose-headings:text-brun prose-headings:font-serif prose-a:text-orange prose-strong:text-brun prose-table:text-sm prose-th:text-brun-light prose-th:font-semibold prose-td:text-brun">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {mdContent}
                  </ReactMarkdown>
                </article>
              )}
            </div>
          )}

          {/* BlockNote guide content */}
          {selectedGuide && (
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-serif text-xl text-brun mb-4">
                {guideTitle}
              </h2>
              {loadingGuide ? (
                <p className="text-sm text-brun-light italic">
                  Chargement...
                </p>
              ) : guideContent ? (
                <div className="text-sm text-brun leading-relaxed">
                  <BlockNoteRenderer content={guideContent} />
                </div>
              ) : (
                <p className="text-sm text-brun-light italic">
                  Contenu vide ou non disponible.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Simple BlockNote JSON renderer. BlockNote stores content as an array
 * of blocks, each with type, content (inline), and children (nested).
 * We render a simplified HTML version without loading the full editor.
 */
function BlockNoteRenderer({ content }: { content: unknown }) {
  if (!Array.isArray(content)) {
    return <p className="text-brun-light italic">Format non reconnu</p>
  }

  return (
    <div className="space-y-2">
      {content.map((block: Record<string, unknown>, i: number) => {
        const type = block.type as string
        const inlineContent = block.content as
          | Array<{ type: string; text?: string; styles?: Record<string, boolean> }>
          | undefined

        const text = inlineContent
          ?.map((ic) => ic.text || "")
          .join("") || ""

        switch (type) {
          case "heading": {
            const level = (block.props as Record<string, unknown>)?.level
            if (level === 1)
              return (
                <h2 key={i} className="font-serif text-lg text-brun mt-4 mb-2">
                  {text}
                </h2>
              )
            if (level === 2)
              return (
                <h3 key={i} className="font-semibold text-brun mt-3 mb-1">
                  {text}
                </h3>
              )
            return (
              <h4 key={i} className="font-medium text-brun mt-2 mb-1">
                {text}
              </h4>
            )
          }
          case "bulletListItem":
            return (
              <li key={i} className="ml-4 list-disc">
                {text}
              </li>
            )
          case "numberedListItem":
            return (
              <li key={i} className="ml-4 list-decimal">
                {text}
              </li>
            )
          case "paragraph":
          default:
            if (!text) return <div key={i} className="h-2" />
            return <p key={i}>{text}</p>
        }
      })}
    </div>
  )
}
