"use client"

import { useEffect } from "react"
import type { ReactNode } from "react"

interface SidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  /** Optional content shown right after the title (e.g. step indicator). */
  titleAside?: ReactNode
  /** Footer content (typically the action buttons). */
  footer?: ReactNode
  /** Maximum width of the panel. Defaults to a comfortable form size. */
  width?: "sm" | "md" | "lg"
  children: ReactNode
}

const WIDTH_CLASSES: Record<NonNullable<SidePanelProps["width"]>, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
}

/**
 * Right-side slide-in panel.
 *
 * Renders an overlay + a fixed panel anchored to the right edge of the
 * viewport. Closes on overlay click and on Escape. Body scroll is locked
 * while the panel is open.
 *
 * Layout:
 *   ┌──────────── header ────────────┐
 *   │  title          [titleAside]  │
 *   │  subtitle (optional)          │
 *   ├────────────── body ─────────────┤
 *   │  children (scrollable)         │
 *   ├──────────── footer ─────────────┤
 *   │  footer (optional, typically    │
 *   │  action buttons)                │
 *   └─────────────────────────────────┘
 */
export default function SidePanel({
  open,
  onClose,
  title,
  subtitle,
  titleAside,
  footer,
  width = "md",
  children,
}: SidePanelProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <>
      {/* Overlay */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 bg-brun/40 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed top-0 right-0 h-screen w-full ${WIDTH_CLASSES[width]} bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <header className="px-6 py-5 border-b border-brun/10 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-2xl text-brun truncate">{title}</h2>
              {titleAside}
            </div>
            {subtitle && (
              <p className="text-sm text-brun-light mt-1">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-brun-light hover:text-brun transition-colors flex-shrink-0"
            aria-label="Fermer"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.75}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {/* Footer */}
        {footer && (
          <footer className="px-6 py-4 border-t border-brun/10 flex justify-end gap-3">
            {footer}
          </footer>
        )}
      </aside>
    </>
  )
}
