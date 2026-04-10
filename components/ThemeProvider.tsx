"use client"

import { useEffect, useState } from "react"
import {
  DEFAULT_THEME_ID,
  getThemeById,
  THEMES,
} from "@/lib/themes"

const STORAGE_KEY = "chefmate-theme"

/**
 * Map from CSS variable name → Tailwind color name used in classes.
 */
const VAR_TO_COLOR: Record<string, string> = {
  "--color-orange": "orange",
  "--color-orange-light": "orange-light",
  "--color-jaune": "jaune",
  "--color-jaune-light": "jaune-light",
  "--color-peche": "peche",
  "--color-peche-light": "peche-light",
  "--color-rose": "rose",
  "--color-vert-eau": "vert-eau",
  "--color-vert-eau-light": "vert-eau-light",
  "--color-bleu-gris": "bleu-gris",
  "--color-bleu-gris-light": "bleu-gris-light",
  "--color-creme": "creme",
  "--color-creme-dark": "creme-dark",
  "--color-brun": "brun",
  "--color-brun-light": "brun-light",
}

/**
 * Tailwind v4 compiles utility classes to static color values at build
 * time (e.g. `.bg-brun { background-color: rgb(61,50,41) }`), NOT
 * `var(--color-brun)`. Changing CSS variables alone has no effect.
 *
 * We generate a <style> block that overrides every Tailwind utility
 * class that references a theme color with !important.
 */
function buildThemeCSS(themeId: string): string {
  const theme = getThemeById(themeId)
  const rules: string[] = []

  // CSS variables (for any code that reads them directly)
  const varDecls = Object.entries(theme.vars)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ")
  rules.push(`:root { ${varDecls} }`)

  // Body background
  if (theme.vars["--color-creme"]) {
    rules.push(`body { background-color: ${theme.vars["--color-creme"]} !important; }`)
  }

  // Override Tailwind utilities per color
  for (const [varName, color] of Object.entries(VAR_TO_COLOR)) {
    const hex = theme.vars[varName]
    if (!hex) continue

    const esc = color.replace("-", "\\-")

    // Solid utilities
    rules.push(`.bg-${esc} { background-color: ${hex} !important; }`)
    rules.push(`.text-${esc} { color: ${hex} !important; }`)
    rules.push(`.border-${esc} { border-color: ${hex} !important; }`)

    // Opacity variants used in the codebase: /5 /10 /15 /20 /30 /40 /50 /60 /70 /80 /90 /95
    for (const op of [5, 10, 15, 20, 30, 40, 50, 60, 70, 80, 90, 95]) {
      const mixed = `color-mix(in srgb, ${hex} ${op}%, transparent)`
      rules.push(`.bg-${esc}\\/${op} { background-color: ${mixed} !important; }`)
      rules.push(`.text-${esc}\\/${op} { color: ${mixed} !important; }`)
      rules.push(`.border-${esc}\\/${op} { border-color: ${mixed} !important; }`)
    }
  }

  // Gradient: from-brun (used in sidebar fade)
  if (theme.vars["--color-brun"]) {
    rules.push(`.from-brun { --tw-gradient-from: ${theme.vars["--color-brun"]} !important; }`)
  }

  // Focus ring for orange
  if (theme.vars["--color-orange"]) {
    rules.push(`.focus\\:ring-orange\\/30:focus { --tw-ring-color: color-mix(in srgb, ${theme.vars["--color-orange"]} 30%, transparent) !important; }`)
    rules.push(`.ring-orange\\/30 { --tw-ring-color: color-mix(in srgb, ${theme.vars["--color-orange"]} 30%, transparent) !important; }`)
  }

  return rules.join("\n")
}

function applyTheme(themeId: string) {
  let styleEl = document.getElementById(
    "theme-override"
  ) as HTMLStyleElement | null
  if (!styleEl) {
    styleEl = document.createElement("style")
    styleEl.id = "theme-override"
    document.head.appendChild(styleEl)
  }
  styleEl.textContent = buildThemeCSS(themeId)
}

/**
 * Reads saved theme from localStorage on mount and applies it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME_ID
    applyTheme(saved)
  }, [])

  return <>{children}</>
}

/**
 * Compact theme selector — standalone via localStorage + DOM.
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
        return (
          <button
            key={t.id}
            type="button"
            title={t.name}
            onClick={() => handleSelect(t.id)}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110"
            style={{
              backgroundColor: t.preview[2],
              outline: isActive
                ? "2px solid white"
                : "2px solid transparent",
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
