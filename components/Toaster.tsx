"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"

/**
 * Minimal in-app toast system.
 *
 * - `useToast()` exposes `showToast(message, variant?)`.
 * - Toasts auto-dismiss after 6 s by default and can also be closed
 *   manually via their × button.
 * - Stacked bottom-right, slide-in animation reuses the existing
 *   `.animate-slide-in` keyframes from globals.css.
 */

export type ToastVariant = "success" | "error" | "info"

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 6000

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  // Keep track of timeouts so we can clear them on manual dismiss or unmount.
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())
  const idRef = useRef(0)

  const removeToast = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) clearTimeout(t)
    timers.current.delete(id)
    setToasts((prev) => prev.filter((x) => x.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, variant: ToastVariant = "success") => {
      idRef.current += 1
      const id = idRef.current
      setToasts((prev) => [...prev, { id, message, variant }])
      const timer = setTimeout(() => removeToast(id), DEFAULT_DURATION_MS)
      timers.current.set(id, timer)
    },
    [removeToast]
  )

  // Clear any pending timers on unmount so we don't setState after unmount.
  useEffect(() => {
    const current = timers.current
    return () => {
      for (const t of current.values()) clearTimeout(t)
      current.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastItem
  onClose: () => void
}) {
  const styles: Record<ToastVariant, string> = {
    success: "bg-vert-eau/95 text-brun border-vert-eau",
    error: "bg-rose/95 text-white border-rose",
    info: "bg-creme-dark text-brun border-brun/10",
  }

  const icon =
    toast.variant === "error" ? (
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
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
    ) : (
      <svg
        className="w-4 h-4 mt-0.5 flex-shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    )

  return (
    <div
      className={`pointer-events-auto animate-slide-in border rounded-lg shadow-lg px-4 py-3 flex items-start gap-2 text-sm ${styles[toast.variant]}`}
      role={toast.variant === "error" ? "alert" : "status"}
    >
      {icon}
      <span className="flex-1 break-words">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return ctx
}
