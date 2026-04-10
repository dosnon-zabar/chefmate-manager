"use client"

import { useEffect, useState } from "react"
import {
  DEFAULT_THEME_ID,
  getThemeById,
  THEMES,
} from "@/lib/themes"

const STORAGE_KEY = "chefmate-theme"

function applyTheme(themeId: string) {
  const theme = getThemeById(themeId)
  // Inject a <style> block in the head. Tailwind v4's @theme inline
  // declarations live inside @layer; a non-layered <style> wins.
  let styleEl = document.getElementById(
    "theme-override"
  ) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "theme-override"
    document.head.appendChild(styleEl)
  }
  const vars = Object.entries(theme.vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ")
  styleEl.textContent = `:root { ${vars} }`
}

/**
 * Reads saved theme from localStorage on mount and applies it.
 * Must be rendered once in the layout (before any themed content).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID
    applyTheme(saved)
  }, [])

  return <>{children}</>
}

/**
 * Compact theme selector — works standalone via localStorage + DOM,
 * no React context needed. Each dot shows the sidebar color (most
 * visually distinct between themes).
 */
export function ThemeSelector() {
  const [activeId, setActiveId] = useState(DEFAULT_THEME_ID)

  useEffect(() => {
    setActiveId(localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID)
  }, [])

  function handleSelect(id: string) {
    setActiveId(id)
    applyTheme(id)
    localStorage.setItem(STORAGE_KEY, id)
  }

  return (
    <div className="flex items-center gap-1.5">
      {THEMES.map((t) => {
        const isActive = t.id === activeId
        // Show sidebar color (preview[2]) as outer ring + accent (preview[0]) as inner dot
        return (
          <button
            key={t.id}
            type="button"
            title={t.name}
            onClick={() => handleSelect(t.id)}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{
              backgroundColor: t.preview[2],
              outline: isActive ? "2px solid white" : "2px solid transparent",
              outlineOffset: "1px",
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: t.preview[0] }}
            />
          </button>
        )
      })}
    </div>
  )
}
