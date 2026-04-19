"use client"

/**
 * FaviconBlock — favicon management UI for a site.
 *
 * Flow:
 *  1. If a favicon is already set, show mini previews at common sizes
 *     (16, 32, 180) + "Changer" and "Supprimer" buttons.
 *  2. If not, show a drop zone + hint ("carré, min 512×512").
 *  3. When the user picks a file, we load it in a cropper modal with
 *     a locked 1:1 aspect ratio. The user confirms the square region.
 *  4. Crop happens client-side via canvas → PNG blob → POST to
 *     /api/sites/[id]/favicon (multipart). The server validates,
 *     generates all sizes, stores on Blobs, updates the DB.
 *  5. Server errors (TOO_SMALL, NOT_SQUARE, UNSUPPORTED_FORMAT, etc.)
 *     are surfaced as user-readable toasts.
 *
 * Source rules enforced client-side BEFORE cropping (to avoid a roundtrip):
 *  - Type: PNG / JPG / WebP only (SVG rejected even if user picks one)
 *  - Max 5 MB for the source file
 *  - After crop: the cropped square must be at least 512×512 natural px
 *
 * react-image-crop does aspect lock & overlay; canvas does the actual bytes.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type SyntheticEvent,
} from "react"
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop"
import "react-image-crop/dist/ReactCrop.css"
import { useToast } from "./Toaster"
import { getAdminBase } from "@/lib/admin-url"

export interface FaviconUrls {
  source?: string
  ico?: string
  "16"?: string
  "32"?: string
  "48"?: string
  "180"?: string
  "192"?: string
  "512"?: string
}

interface Props {
  siteId: string
  faviconUrls: FaviconUrls | null
  /** Called after a successful upload/delete so the parent can refresh. */
  onChange: () => void | Promise<void>
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]
const MAX_SOURCE_BYTES = 5 * 1024 * 1024
const MIN_CROPPED_SIDE = 512

function resolveUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (url.startsWith("http")) return url
  return `${getAdminBase()}${url}`
}

export function FaviconBlock({ siteId, faviconUrls, onChange }: Props) {
  const { showToast } = useToast()

  // --- State --------------------------------------------------------
  /** Data URL of the loaded source shown in the cropper. */
  const [sourceDataUrl, setSourceDataUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop>()
  const [pixelCrop, setPixelCrop] = useState<PixelCrop | null>(null)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const imgRef = useRef<HTMLImageElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const closeCropper = useCallback(() => {
    setSourceDataUrl(null)
    setCrop(undefined)
    setPixelCrop(null)
  }, [])

  // --- File selection → cropper ------------------------------------
  const onFileSelected = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      // Reset the input so picking the same file twice re-fires change.
      e.target.value = ""
      if (!file) return

      if (!ACCEPTED_TYPES.includes(file.type)) {
        showToast(
          "Format non supporté. Utilisez PNG, JPG ou WebP (le SVG n'est pas accepté).",
          "error"
        )
        return
      }
      if (file.size > MAX_SOURCE_BYTES) {
        showToast(
          `Fichier trop volumineux (max ${Math.round(
            MAX_SOURCE_BYTES / 1024 / 1024
          )} Mo).`,
          "error"
        )
        return
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () =>
          reject(reader.error ?? new Error("Lecture du fichier impossible"))
        reader.readAsDataURL(file)
      }).catch((err: Error) => {
        showToast(err.message, "error")
        return null
      })

      if (dataUrl) setSourceDataUrl(dataUrl)
    },
    [showToast]
  )

  // When the image loads in the cropper, center a max square crop.
  const onImageLoad = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget
    const initial = centerCrop(
      makeAspectCrop({ unit: "%", width: 100 }, 1, width, height),
      width,
      height
    )
    setCrop(initial)
  }, [])

  // --- Crop → PNG blob via canvas ----------------------------------
  const makeCroppedBlob = useCallback(
    async (img: HTMLImageElement, crop: PixelCrop): Promise<Blob> => {
      // Map display-pixel crop to natural-pixel crop.
      const scaleX = img.naturalWidth / img.width
      const scaleY = img.naturalHeight / img.height
      const sx = Math.round(crop.x * scaleX)
      const sy = Math.round(crop.y * scaleY)
      const sWidth = Math.round(crop.width * scaleX)
      const sHeight = Math.round(crop.height * scaleY)

      // Force a square output (in case of rounding drift).
      const side = Math.min(sWidth, sHeight)

      const canvas = document.createElement("canvas")
      canvas.width = side
      canvas.height = side
      const ctx = canvas.getContext("2d")
      if (!ctx) throw new Error("Canvas 2D non supporté")
      ctx.drawImage(img, sx, sy, side, side, 0, 0, side, side)

      return await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Encodage PNG échoué"))),
          "image/png"
        )
      })
    },
    []
  )

  const onConfirmCrop = useCallback(async () => {
    const img = imgRef.current
    if (!img || !pixelCrop) return

    // Client-side check on the cropped natural size before uploading.
    const scaleX = img.naturalWidth / img.width
    const croppedSide = Math.round(pixelCrop.width * scaleX)
    if (croppedSide < MIN_CROPPED_SIDE) {
      showToast(
        `La zone sélectionnée fait ${croppedSide}×${croppedSide}px — au moins ${MIN_CROPPED_SIDE} requis. Agrandis la sélection ou choisis une image source plus grande.`,
        "error"
      )
      return
    }

    setUploading(true)
    try {
      const blob = await makeCroppedBlob(img, pixelCrop)
      const fd = new FormData()
      fd.append("file", blob, "favicon.png")

      const res = await fetch(`/api/sites/${siteId}/favicon`, {
        method: "POST",
        body: fd,
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        showToast(json.error || "Erreur lors de l'upload du favicon", "error")
        return
      }

      showToast("Favicon mis à jour", "success")
      closeCropper()
      await onChange()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erreur inattendue",
        "error"
      )
    } finally {
      setUploading(false)
    }
  }, [pixelCrop, siteId, showToast, makeCroppedBlob, closeCropper, onChange])

  const onDelete = useCallback(async () => {
    if (!faviconUrls) return
    if (!confirm("Supprimer le favicon de ce site ?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/sites/${siteId}/favicon`, {
        method: "DELETE",
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(json.error || "Erreur lors de la suppression", "error")
        return
      }
      showToast("Favicon supprimé", "success")
      await onChange()
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Erreur inattendue",
        "error"
      )
    } finally {
      setDeleting(false)
    }
  }, [faviconUrls, siteId, showToast, onChange])

  // Handy derived values for the preview row.
  const preview180 = useMemo(() => resolveUrl(faviconUrls?.["180"]), [faviconUrls])
  const preview32 = useMemo(() => resolveUrl(faviconUrls?.["32"]), [faviconUrls])
  const preview16 = useMemo(() => resolveUrl(faviconUrls?.["16"]), [faviconUrls])

  // Escape closes the cropper (standard modal UX).
  useEffect(() => {
    if (!sourceDataUrl) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !uploading) closeCropper()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [sourceDataUrl, uploading, closeCropper])

  // --- Render ------------------------------------------------------

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-lg text-brun">Favicon</h2>
          <p className="text-xs text-brun-light mt-1">
            Icône affichée dans l&apos;onglet du navigateur et en raccourci
            mobile. Format carré (PNG/JPG/WebP), au minimum 512×512px
            recommandé pour un rendu net sur tous les supports. Idéalement
            un logo simple avec un fond opaque.
          </p>
        </div>
      </div>

      {faviconUrls ? (
        <div className="flex items-center gap-6 py-2">
          {/* Previews at realistic browser/home-screen sizes */}
          <div className="flex items-end gap-4">
            {preview180 && (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview180}
                  alt="Favicon 180×180"
                  className="w-[60px] h-[60px] rounded-lg border border-brun/10 bg-creme object-contain"
                />
                <span className="text-[10px] text-brun-light">iOS · 180px</span>
              </div>
            )}
            {preview32 && (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview32}
                  alt="Favicon 32×32"
                  className="w-8 h-8 rounded border border-brun/10 bg-creme object-contain"
                />
                <span className="text-[10px] text-brun-light">Onglet · 32px</span>
              </div>
            )}
            {preview16 && (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview16}
                  alt="Favicon 16×16"
                  className="w-4 h-4 rounded border border-brun/10 bg-creme object-contain"
                />
                <span className="text-[10px] text-brun-light">Classique · 16px</span>
              </div>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex gap-2">
            <label className="px-3 py-1.5 text-xs bg-orange text-white rounded-lg hover:bg-orange-light transition-colors cursor-pointer">
              Changer
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                className="hidden"
                onChange={onFileSelected}
              />
            </label>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {deleting ? "…" : "Supprimer"}
            </button>
          </div>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-brun/20 rounded-lg cursor-pointer hover:border-orange/40 transition-colors bg-creme/50">
          <span className="text-brun-light text-sm">
            Cliquer pour uploader une image
          </span>
          <span className="text-[10px] text-brun-light/60 mt-1">
            PNG, JPG ou WebP — au moins 512×512px après recadrage
          </span>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={onFileSelected}
          />
        </label>
      )}

      {/* --- Cropper modal (shown when sourceDataUrl is set) --- */}
      {sourceDataUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={(e) => {
            // Backdrop click to close, but not clicks inside the card.
            if (e.target === e.currentTarget && !uploading) closeCropper()
          }}
        >
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full max-h-[90vh] flex flex-col gap-4 shadow-xl">
            <div>
              <h3 className="font-serif text-lg text-brun">
                Recadrer en carré
              </h3>
              <p className="text-xs text-brun-light mt-1">
                Ajustez la zone pour garder l&apos;essentiel. Minimum{" "}
                {MIN_CROPPED_SIDE}×{MIN_CROPPED_SIDE}px après recadrage.
              </p>
            </div>

            <div className="flex-1 overflow-auto bg-creme/50 rounded-lg p-2 flex items-center justify-center">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setPixelCrop(c)}
                aspect={1}
                keepSelection
                minWidth={50}
                minHeight={50}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={sourceDataUrl}
                  alt="Source à recadrer"
                  onLoad={onImageLoad}
                  style={{ maxHeight: "60vh" }}
                />
              </ReactCrop>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={closeCropper}
                disabled={uploading}
                className="px-4 py-2 text-sm text-brun border border-brun/10 rounded-lg hover:bg-creme disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={onConfirmCrop}
                disabled={!pixelCrop || uploading}
                className="px-4 py-2 text-sm bg-orange text-white rounded-lg hover:bg-orange-light disabled:opacity-50"
              >
                {uploading ? "Upload en cours…" : "Utiliser cette zone"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
