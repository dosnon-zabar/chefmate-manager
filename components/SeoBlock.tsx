"use client"

import { useState } from "react"
import { useToast } from "@/components/Toaster"
import { getAdminBase } from "@/lib/admin-url"

const INPUT = "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

function CharCounter({ value, min, ideal, max }: { value: string; min: number; ideal: number; max: number }) {
  const len = value.length
  let color = "text-brun-light"
  let status = "Trop court"
  if (len === 0) {
    color = "text-brun-light/60"
    status = "Vide"
  } else if (len < min) {
    color = "text-orange"
    status = `Trop court (min ${min})`
  } else if (len <= ideal) {
    color = "text-green-600"
    status = "Bonne longueur"
  } else if (len <= max) {
    color = "text-green-600"
    status = "Limite haute"
  } else {
    color = "text-rose"
    status = `Trop long (max ${max})`
  }
  return (
    <p className={`text-[10px] mt-1 flex items-center gap-2 ${color}`}>
      <span>{len} caractère{len > 1 ? "s" : ""}</span>
      <span className="text-brun-light/40">·</span>
      <span>{status}</span>
      <span className="text-brun-light/40 ml-auto">Idéal : {min}-{max}</span>
    </p>
  )
}

type Props = {
  seoTitle: string | null
  seoDesc: string | null
  seoImage: string | null
  onPatch: (body: Record<string, unknown>) => Promise<boolean>
  onRefresh?: () => void | Promise<void>
  uploadPrefix?: string
}

export default function SeoBlock({ seoTitle, seoDesc, seoImage, onPatch, onRefresh, uploadPrefix = "seo" }: Props) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(seoTitle ?? "")
  const [desc, setDesc] = useState(seoDesc ?? "")
  const [image, setImage] = useState(seoImage ?? "")
  const [uploading, setUploading] = useState(false)
  const { showToast } = useToast()

  async function save(field: string, value: unknown) {
    if (await onPatch({ [field]: value })) { showToast("Enregistré"); void onRefresh?.() }
  }

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("prefix", uploadPrefix)
      const res = await fetch("/api/upload-image", { method: "POST", body: fd })
      const json = await res.json()
      const url = json.data?.url ?? json.url
      if (url) {
        setImage(url)
        await save("seo_image", url)
      }
    } catch { showToast("Erreur upload", "error") } finally { setUploading(false) }
  }

  function resolveImg(url: string): string {
    if (!url || url.startsWith("http")) return url
    return `${getAdminBase()}${url}`
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-6 hover:bg-brun/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-4 h-4 text-brun-light transition-transform ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h2 className="font-serif text-lg text-brun">SEO & Partage</h2>
        </div>
        <span className="text-xs text-brun-light">{open ? "Fermer" : "Personnaliser"}</span>
      </button>

      {open && (
        <div className="p-6 pt-0 space-y-4">
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Titre SEO</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => save("seo_title", title.trim() || null)}
              className={INPUT} placeholder="Laisser vide pour utiliser le titre + nom du site" />
            <CharCounter value={title} min={30} ideal={55} max={60} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Description SEO</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)}
              onBlur={() => save("seo_desc", desc.trim() || null)}
              rows={3} className={`${INPUT} resize-none`} placeholder="Laisser vide pour utiliser le texte d'introduction" />
            <CharCounter value={desc} min={70} ideal={150} max={160} />
          </div>
          <div>
            <label className="text-xs font-semibold text-brun-light uppercase tracking-wide mb-1 block">Image de partage (OG)</label>
            {image ? (
              <div className="space-y-2">
                <div className="w-full h-40 rounded-lg border border-brun/10 overflow-hidden bg-creme">
                  <img src={resolveImg(image)} alt="OG" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <label className="px-3 py-1.5 text-xs bg-orange text-white rounded-lg hover:bg-orange-light transition-colors cursor-pointer">
                    {uploading ? "Upload..." : "Changer"}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = "" }} />
                  </label>
                  <button type="button" onClick={() => { setImage(""); void save("seo_image", null) }}
                    className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors">
                    Supprimer
                  </button>
                </div>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-brun/20 rounded-lg cursor-pointer hover:border-orange/40 transition-colors bg-creme/50">
                <span className="text-brun-light text-sm">{uploading ? "Upload en cours..." : "Cliquer pour uploader une image"}</span>
                <span className="text-[10px] text-brun-light/60 mt-1">Laisser vide pour utiliser l&apos;image principale</span>
                <input type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = "" }} />
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
