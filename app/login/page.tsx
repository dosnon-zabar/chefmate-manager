"use client"

import { Suspense, useState, type FormEvent } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { getAdminBase } from "@/lib/admin-url"

// Next 15/16 requires a Suspense boundary around any component that
// reads useSearchParams() or the static prerender fails at build time.
// We isolate the search-params read into a leaf and keep the form
// statically renderable in the fallback.
export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageBody expired={false} />}>
      <LoginPageWithParams />
    </Suspense>
  )
}

function LoginPageWithParams() {
  const searchParams = useSearchParams()
  const expired = searchParams.get("expired") === "1"
  return <LoginPageBody expired={expired} />
}

function LoginPageBody({ expired }: { expired: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || "Échec de la connexion")
        return
      }
      // Redirect to home on success — middleware will forward to first allowed page.
      router.push("/")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur réseau")
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

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-6 shadow-sm space-y-4"
        >
          {expired && !error && (
            <div className="bg-ocre/15 text-brun text-sm px-4 py-3 rounded-lg">
              Votre session a expiré. Merci de vous reconnecter.
            </div>
          )}

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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-brun/10 bg-creme text-sm text-brun placeholder:text-brun-light/40 focus:outline-none focus:ring-2 focus:ring-orange/30"
              placeholder="votre@email.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-brun mb-1"
            >
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-brun/10 bg-creme text-sm text-brun placeholder:text-brun-light/40 focus:outline-none focus:ring-2 focus:ring-orange/30"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brun-light/50 hover:text-brun-light transition-colors text-xs"
                aria-label={
                  showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                }
              >
                {showPassword ? "Masquer" : "Afficher"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full py-2.5 bg-orange text-white font-semibold rounded-lg hover:bg-orange-light transition-colors text-sm disabled:opacity-50"
          >
            {pending ? "Connexion..." : "Se connecter"}
          </button>

          {/*
            Le flow de reset vit sur le BO admin (authority de l'auth), donc
            on envoie le user vers l'URL admin absolue. getAdminBase() se
            résout à http://localhost:3000 en dev et https://admin.brigades.fr
            en prod.
          */}
          <div className="text-center pt-1">
            <a
              href={`${getAdminBase()}/mot-de-passe-oublie`}
              className="text-xs text-brun-light hover:text-orange transition-colors"
            >
              Mot de passe oublié ?
            </a>
          </div>
        </form>
      </div>
    </div>
  )
}
