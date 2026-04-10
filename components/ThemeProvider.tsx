"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  DEFAULT_THEME_ID,
  getThemeById,
  THEMES,
  type ThemeDefinition,
} from "@/lib/themes"

const STORAGE_KEY = "chefmate-theme"

interface ThemeContextValue {
  theme: ThemeDefinition
  setThemeId: (id: string) => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: getThemeById(DEFAULT_THEME_ID),
  setThemeId: () => {},
})

function applyTheme(theme: ThemeDefinition) {
  const root = document.documentElement
  for (const [key, value] of Object.entries(theme.vars)) {
    root.style.setProperty(key, value)
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemeDefinition>(
    getThemeById(DEFAULT_THEME_ID)
  )

  // On mount, read from localStorage and apply
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const t = getThemeById(saved)
      setTheme(t)
      applyTheme(t)
    }
  }, [])

  const setThemeId = useCallback((id: string) => {
    const t = getThemeById(id)
    setTheme(t)
    applyTheme(t)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}

/**
 * Compact theme selector showing colored dots.
 * Click a dot to switch theme. The active theme has a ring.
 */
export function ThemeSelector() {
  const { theme, setThemeId } = useTheme()

  return (
    <div className="flex items-center gap-1.5">
      {THEMES.map((t) => {
        const isActive = t.id === theme.id
        return (
          <button
            key={t.id}
            type="button"
            title={t.name}
            onClick={() => setThemeId(t.id)}
            className={`w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center ${
              isActive
                ? "border-white scale-110"
                : "border-transparent opacity-60 hover:opacity-100 hover:scale-105"
            }`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: t.preview[0] }}
            />
          </button>
        )
      })}
    </div>
  )
}
