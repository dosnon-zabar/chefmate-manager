"use client"

import Link from "next/link"
import { useState, type FormEvent } from "react"

/**
 * /mot-de-passe-oublie (manager) — step 1 du reset.
 *
 * Réplique visuelle de /login côté manager. Appelle le proxy manager
 * /api/auth/reset-password/request qui ajoute `app: "manager"` avant
 * de forwarder à admin. Le lien dans l'email pointera vers
 * manager/reset-password.
 *
 * Route publique (déclarée dans middleware.ts PUBLIC_PAGE_PATHS).
 */
export default function MotDePasseOubliePage() {
  const [email, setEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        // La route renvoie 200 dans le flow normal ; si on est là c'est
        // une vraie erreur serveur côté admin.
        setError("Erreur serveur, réessaie dans quelques instants.")
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
            alt="ChefMate"
            className="h-10 mx-auto mb-3"
          />
          <p className="text-xs uppercase tracking-[0.2em] text-brun-light/60">
            Manager
          </p>
        </div>

        {done ? (
          <div className="bg-white rounded-2xl p-6 shadow-sm space-y-4">
            <div className="bg-vert-eau-light/40 text-brun text-sm px-4 py-3 rounded-lg">
              <p className="font-medium mb-1">Email envoyé.</p>
              <p className="text-xs text-brun-light">
                Si cette adresse est enregistrée, tu reçois dans
                quelques minutes un lien pour choisir un nouveau mot
                de passe. Pense à vérifier les spams.
              </p>
            </div>
            <Link
              href="/login"
              className="block text-center text-sm text-orange hover:text-orange-light transition-colors"
            >
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
          >
            <h1 className="font-serif text-xl text-brun mb-1">
              Mot de passe oublié
            </h1>
            <p className="text-sm text-brun-light">
              Entre l&apos;adresse email associée à ton compte. Nous
              enverrons un lien pour choisir un nouveau mot de passe.
            </p>

            {error && (
              <div className="bg-rose/10 text-rose text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-brun mb-1"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-brun/10 bg-creme text-sm text-brun placeholder:text-brun-light/40 focus:outline-none focus:ring-2 focus:ring-orange/30"
                placeholder="votre@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
            >
              {pending ? "Envoi..." : "Envoyer le lien"}
            </button>

            <div className="text-center pt-1">
              <Link
                href="/login"
                className="text-xs text-brun-light hover:text-orange transition-colors"
              >
                ← Retour à la connexion
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
