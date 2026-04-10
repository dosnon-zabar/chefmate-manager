"use client"

import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/auth-context"
import { useToast } from "./Toaster"
import ConfirmDialog from "./ConfirmDialog"

interface ApiKey {
  id: string
  key_prefix: string
  name: string
  is_active: boolean
  last_used_at: string | null
  created_at: string
  revoked_at: string | null
  creator?: { id: string; first_name: string; last_name: string } | null
}

interface Props {
  teamId: string
}

const INPUT_CLASS =
  "w-full px-3 py-2 rounded-lg border border-brun/10 bg-creme text-sm text-brun focus:outline-none focus:ring-2 focus:ring-orange/30"

/**
 * API keys section displayed inside a team card. Only rendered when
 * the caller has the right to manage API keys on this team (the parent
 * checks `can("read", "api_key", { ownerTeamIds: [teamId] })`).
 */
export default function TeamApiKeys({ teamId }: Props) {
  const { showToast } = useToast()

  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)

  // Create form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [createPassword, setCreatePassword] = useState("")
  const [creating, setCreating] = useState(false)
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)

  // Revoke
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null)
  const [revokePassword, setRevokePassword] = useState("")
  const [revoking, setRevoking] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/api-keys`)
      if (!res.ok) return
      const json = await res.json()
      setKeys(json.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [teamId])

  useEffect(() => {
    void loadKeys()
  }, [loadKeys])

  async function handleCreate() {
    if (!newKeyName.trim() || !createPassword) return
    setCreating(true)
    try {
      const res = await fetch(`/api/teams/${teamId}/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          password: createPassword,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur")

      const created = json.data || {}
      setNewKeyValue(created.key || null)
      showToast(`Clé API "${newKeyName.trim()}" créée.`)
      setNewKeyName("")
      setCreatePassword("")
      void loadKeys()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget || !revokePassword) return
    setRevoking(true)
    try {
      const res = await fetch(
        `/api/teams/${teamId}/api-keys/${revokeTarget.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: revokePassword }),
        }
      )
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Erreur")

      showToast(`Clé "${revokeTarget.name}" révoquée.`)
      setShowRevokeDialog(false)
      setRevokeTarget(null)
      setRevokePassword("")
      void loadKeys()
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Erreur", "error")
    } finally {
      setRevoking(false)
    }
  }

  const activeKeys = keys.filter((k) => k.is_active)
  const revokedKeys = keys.filter((k) => !k.is_active)

  return (
    <div className="border-t border-brun/5">
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-xs font-semibold text-brun-light uppercase tracking-wide">
          Clés API ({activeKeys.length})
        </span>
        <button
          type="button"
          onClick={() => {
            setShowCreateForm((v) => !v)
            setNewKeyValue(null)
          }}
          className="text-xs text-orange hover:text-orange-light font-medium transition-colors"
        >
          {showCreateForm ? "Fermer" : "+ Nouvelle clé"}
        </button>
      </div>

      {/* New key created — show the value once */}
      {newKeyValue && (
        <div className="mx-5 mb-3 bg-vert-eau/20 rounded-lg px-3 py-2 text-xs">
          <p className="font-semibold text-brun mb-1">
            Clé créée — copiez-la maintenant, elle ne sera plus affichée :
          </p>
          <code className="block bg-white rounded px-2 py-1.5 text-brun font-mono text-xs break-all select-all">
            {newKeyValue}
          </code>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && !newKeyValue && (
        <div className="mx-5 mb-3 bg-creme rounded-lg p-3 space-y-2">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nom de la clé (ex: Production)"
            className={INPUT_CLASS}
          />
          <input
            type="password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
            placeholder="Votre mot de passe (confirmation)"
            className={INPUT_CLASS}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newKeyName.trim() || !createPassword}
            className="w-full px-3 py-2 bg-orange text-white text-xs font-semibold rounded-lg hover:bg-orange-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? "Génération..." : "Générer la clé"}
          </button>
        </div>
      )}

      {loading ? (
        <p className="px-5 pb-4 text-xs text-brun-light italic">
          Chargement...
        </p>
      ) : activeKeys.length === 0 && !showCreateForm ? (
        <p className="px-5 pb-4 text-xs text-brun-light italic">
          Aucune clé API active.
        </p>
      ) : (
        <>
          {activeKeys.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-creme/50 text-[11px] font-semibold text-brun-light uppercase tracking-wide">
                  <th className="text-left px-5 py-2">Nom</th>
                  <th className="text-left px-5 py-2">Préfixe</th>
                  <th className="text-left px-5 py-2">Créée le</th>
                  <th className="text-right px-5 py-2 w-20">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeKeys.map((key, idx) => (
                  <tr
                    key={key.id}
                    className={idx % 2 === 0 ? "bg-white" : "bg-creme/30"}
                  >
                    <td className="px-5 py-2.5 text-brun">{key.name}</td>
                    <td className="px-5 py-2.5 text-brun-light font-mono text-xs">
                      {key.key_prefix}
                    </td>
                    <td className="px-5 py-2.5 text-brun-light text-xs">
                      {new Date(key.created_at).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setRevokeTarget(key)
                          setRevokePassword("")
                          setShowRevokeDialog(true)
                        }}
                        className="text-xs text-rose hover:text-rose/70 font-medium transition-colors"
                      >
                        Révoquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}

      {/* Revoke dialog — needs password confirmation */}
      {showRevokeDialog && revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-brun/40 backdrop-blur-sm"
            onClick={() => !revoking && setShowRevokeDialog(false)}
          />
          <div
            role="alertdialog"
            aria-modal
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6 animate-slide-in"
          >
            <div className="mx-auto w-10 h-10 rounded-full flex items-center justify-center mb-4 bg-rose/10">
              <svg
                className="w-5 h-5 text-rose"
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
              Révoquer la clé
            </h3>
            <p className="text-center text-sm text-brun-light mb-4">
              La clé &quot;{revokeTarget.name}&quot; ({revokeTarget.key_prefix})
              sera désactivée définitivement.
            </p>
            <input
              type="password"
              value={revokePassword}
              onChange={(e) => setRevokePassword(e.target.value)}
              placeholder="Votre mot de passe (confirmation)"
              className={`${INPUT_CLASS} mb-4`}
              onKeyDown={(e) => {
                if (e.key === "Enter" && revokePassword && !revoking) {
                  void handleRevoke()
                }
              }}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowRevokeDialog(false)}
                disabled={revoking}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-brun border border-brun/10 rounded-lg hover:bg-creme transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRevoke}
                disabled={revoking || !revokePassword}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors bg-rose text-white hover:bg-rose/80 disabled:opacity-50"
              >
                {revoking ? "..." : "Révoquer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
