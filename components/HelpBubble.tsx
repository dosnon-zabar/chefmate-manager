"use client"

import { useState, useRef, useEffect } from "react"

/**
 * Small "?" icon that shows a help tooltip on hover.
 * Reusable across the app — just pass `text`.
 */
export default function HelpBubble({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const triggerRef = useRef<HTMLSpanElement>(null)

  // Decide whether to show above or below based on available space
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      setAbove(spaceBelow < 120)
    }
  }, [open])

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="w-4 h-4 rounded-full bg-brun/10 text-brun-light text-[10px] font-semibold inline-flex items-center justify-center cursor-help select-none">
        ?
      </span>

      {open && (
        <span
          className={`absolute z-30 left-1/2 -translate-x-1/2 w-56 px-3 py-2 text-xs text-brun bg-white border border-brun/10 rounded-lg shadow-lg leading-relaxed pointer-events-none ${
            above ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  )
}
