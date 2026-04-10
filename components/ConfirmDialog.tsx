"use client"

import { useEffect, useRef } from "react"

interface Props {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "warning"
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Styled confirmation dialog with an overlay backdrop.
 * Closes on Escape key or clicking the overlay.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  cancelLabel = "Annuler",
  variant = "danger",
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !loading) onCancel()
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [open, loading, onCancel])

  // Focus trap: auto-focus the cancel button on open
  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  if (!open) return null

  const confirmColors =
    variant === "danger"
      ? "bg-rose text-white hover:bg-rose/80"
      : "bg-orange text-white hover:bg-orange-light"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-brun/40 backdrop-blur-sm"
        onClick={() => !loading && onCancel()}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal
        tabIndex={-1}
        className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 animate-slide-in"
      >
        {/* Icon */}
        <div
          className={`mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-4 ${
            variant === "danger" ? "bg-rose/10" : "bg-orange/10"
          }`}
        >
          <svg
            className={`w-5 h-5 ${
              variant === "danger" ? "text-rose" : "text-orange"
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h3 className="text-center font-serif text-lg text-brun mb-2">
          {title}
        </h3>
        <p className="text-center text-sm text-brun-light mb-6">
          {message}
        </p>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-brun border border-brun/10 rounded-lg hover:bg-creme transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${confirmColors}`}
          >
            {loading ? "..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
