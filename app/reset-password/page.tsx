"use client"

import Link from "next/link"
import { Suspense, useState, type FormEvent } from "react"
import { useSearchParams } from "next/navigation"

/**
 * /reset-password?token=xxx (manager) — step 2 du reset.
 *
 * Appelle le proxy manager /api/auth/reset-password/confirm qui
 * forward à admin. Le token est consommé côté admin (validation +
 * set_user_password + bump session_version).
 *
 * Suspense wrapper nécessaire pour useSearchParams (prérender
 * statique Next 15/16 — pareil que /login).
 *
 * Route publique (déclarée dans middleware.ts PUBLIC_PAGE_PATHS).
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<ResetPasswordBody token="" />}>
      <WithToken />
    </Suspense>
  )
}

function WithToken() {
  const token = useSearchParams().get("token") ?? ""
  return <ResetPasswordBody token={token} />
}

function ResetPasswordBody({ token }: { token: string }) {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [show, setShow] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError("Lien invalide — token manquant. Redemande un nouveau lien.")
      return
    }
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.")
      return
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.")
      return
    }

    setPending(true)
    try {
      const res = await fetch("/api/auth/reset-password/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success) {
        setDone(true)
      } else {
        setError(data.error || "Ce lien est invalide ou a expiré.")
      }
    } catch {
      setError("Erreur réseau")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img
            src="/chefmate-logo.svg"
            alt="Brigades"
            className="h-10 mx-auto mb-3"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-brun-light/60">
            Manager
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <div className="bg-vert-eau-light/40 text-brun text-sm px-4 py-3 rounded-lg">
              <p className="font-medium mb-1">Mot de passe mis à jour.</p>
              <p className="text-xs text-brun-light">
                Tu peux te connecter avec ton nouveau mot de passe. Tes
                sessions précédentes (si tu étais connecté ailleurs) ont
                été révoquées.
              </p>
            </div>
            <Link
              href="/login"
              className="block w-full text-center py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm"
            >
              Se connecter
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
          >
            <h1 className="font-serif text-xl text-brun mb-1">
              Nouveau mot de passe
            </h1>

            {error && (
              <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-brun mb-1"
              >
                Nouveau mot de passe
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={6}
                  autoFocus
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Au moins 6 caractères"
                  className="w-full px-3 py-2.5 pr-16 rounded-lg border border-brun/10 bg-creme text-sm text-brun placeholder:text-brun-light/40 focus:outline-none focus:ring-2 focus:ring-orange/30"
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brun-light/50 hover:text-brun-light transition-colors text-xs"
                  aria-label={show ? "Masquer" : "Afficher"}
                  tabIndex={-1}
                >
                  {show ? "Masquer" : "Afficher"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm"
                className="block text-sm font-medium text-brun mb-1"
              >
                Confirmation
              </label>
              <input
                id="confirm"
                type={show ? "text" : "password"}
                required
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Retape le mot de passe"
                className="w-full px-3 py-2.5 rounded-lg border border-brun/10 bg-creme text-sm text-brun placeholder:text-brun-light/40 focus:outline-none focus:ring-2 focus:ring-orange/30"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
            >
              {pending ? "Mise à jour..." : "Définir le nouveau mot de passe"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
