import { readSession } from "@/lib/session"

export default async function DashboardPage() {
  const session = await readSession()
  const user = session?.user

  return (
    <div>
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-brun">Tableau de bord</h1>
        <p className="text-sm text-brun-light mt-1">
          Bienvenue {user?.first_name} {user?.last_name}
        </p>
      </header>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-serif text-lg text-brun mb-3">Vos rôles</h2>
        {session?.user.role_assignments && session.user.role_assignments.length > 0 ? (
          <div className="space-y-2">
            {session.user.role_assignments.map((a, i) => (
              <div key={i} className="text-sm">
                <span className="font-semibold text-brun">{a.role}</span>
                <span className="text-brun-light">
                  {" "}
                  — {a.teamId === null ? "global" : `team ${a.teamId}`}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-brun-light italic">Aucun rôle attribué</p>
        )}
      </div>
    </div>
  )
}
