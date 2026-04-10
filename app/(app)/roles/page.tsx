export default function RolesPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brun">
          Rôles et permissions
        </h1>
        <p className="text-sm text-brun-light mt-1">
          Vue d&apos;ensemble des rôles de la plateforme et de leurs
          droits associés
        </p>
      </header>

      <div className="space-y-6">
        {/* Principes */}
        <Section title="Principes">
          <ul className="space-y-2 text-sm text-brun">
            <li className="flex gap-2">
              <Bullet />
              <span>
                Les droits sont <strong>additifs</strong> : si un
                utilisateur cumule plusieurs rôles, il bénéficie de
                l&apos;union de tous les droits.
              </span>
            </li>
            <li className="flex gap-2">
              <Bullet />
              <span>
                Un rôle <strong>global</strong> s&apos;applique à toute la
                plateforme. Un rôle <strong>d&apos;équipe</strong>{" "}
                s&apos;applique uniquement au périmètre de l&apos;équipe
                concernée.
              </span>
            </li>
            <li className="flex gap-2">
              <Bullet />
              <span>
                Il doit toujours exister au moins un{" "}
                <strong>Admin global</strong> actif dans le système.
              </span>
            </li>
          </ul>
        </Section>

        {/* Rôles */}
        <Section title="Les rôles">
          <div className="space-y-4">
            <RoleCard
              name="Admin global"
              scope="global"
              color="orange"
              description="Accès total à la plateforme. Gère les utilisateurs, les équipes, les sites, les contenus, les référentiels et l'administration."
              abilities={[
                "Gérer toutes les recettes et événements (CRU, publication, réattribution, soft delete)",
                "Gérer tous les ingrédients et référentiels (unités, rayons, types de recette, tags, saisons)",
                "Gérer les utilisateurs : création, attribution aux équipes, définition des rôles, changement de statut",
                "Gérer les équipes : création, modification, changement de statut, soft delete",
                "Gérer les sites : création, modification, soft delete",
                "Gérer les clés API de n'importe quelle équipe",
                "Accéder aux pages d'administration (Documentation, Gestion BDD, Notes d'évolution, RGPD)",
              ]}
            />

            <RoleCard
              name="Admin contenu"
              scope="global"
              color="orange"
              description="Gère les éléments structurels liés au contenu, partagés entre toutes les équipes."
              abilities={[
                "CRUD sur les ingrédients",
                "CRUD sur les référentiels : unités, rayons, types de recette, tags",
                "Lecture seule sur les saisons",
              ]}
              restrictions={[
                "Ne peut pas gérer les recettes, événements, équipes, utilisateurs ou sites",
              ]}
            />

            <RoleCard
              name="Team manager"
              scope="team"
              color="vert-eau"
              description="Gère l'organisation d'une équipe : ses membres, leurs rôles et les clés API (avec Website manager)."
              abilities={[
                "Modifier l'équipe (nom, description)",
                "Gérer les membres de l'équipe : ajout, retrait, modification des rôles d'équipe",
                "Peut nommer d'autres Team managers sur son équipe (auto-délégation)",
                "Gérer les clés API de l'équipe (si aussi Website manager)",
              ]}
              restrictions={[
                "Ne peut pas créer ou supprimer une équipe",
                "Ne peut pas attribuer de rôles globaux",
                "Ne peut pas modifier le statut d'un utilisateur",
                "Ne peut pas modifier les infos d'un utilisateur ayant des rôles hors de son périmètre",
              ]}
            />

            <RoleCard
              name="Website manager"
              scope="team"
              color="vert-eau"
              description="Gère les sites web rattachés à une équipe."
              abilities={[
                "Créer des sites rattachés à l'équipe",
                "Modifier les sites de l'équipe",
                "Gérer les clés API de l'équipe (si aussi Team manager)",
              ]}
              restrictions={[
                "Ne peut pas supprimer un site (réservé Admin global)",
              ]}
            />

            <RoleCard
              name="Traiteur"
              scope="team"
              color="vert-eau"
              description="Gère les événements de l'équipe et la sélection des recettes associées."
              abilities={[
                "CRUD + publication sur les événements de l'équipe",
                "Sélectionner les recettes et ingrédients pour un événement",
                "Lecture des recettes de son équipe",
                "Utiliser les recettes publiques d'autres équipes dans ses événements",
              ]}
              restrictions={[
                "Ne peut pas créer ou modifier les recettes",
              ]}
            />

            <RoleCard
              name="Contributeur"
              scope="team"
              color="vert-eau"
              description="Crée et gère les recettes de l'équipe."
              abilities={[
                "CRUD + publication sur les recettes de l'équipe",
                "Attribuer une recette à plusieurs équipes (si Contributeur sur celles-ci)",
                "Définir l'auteur d'une recette",
                "Lier les ingrédients à une recette",
                "Lecture des événements de son équipe",
              ]}
              restrictions={[
                "Ne peut pas gérer les événements",
              ]}
            />
          </div>
        </Section>

        {/* Matrice contenus structurels */}
        <Section title="Matrice — Contenus structurels (globaux)">
          <p className="text-xs text-brun-light mb-3">
            C = Créer, R = Lire, U = Modifier, D = Supprimer (soft), —
            = Aucun
          </p>
          <Table
            headers={[
              "Domaine",
              "Admin global",
              "Admin contenu",
              "Autres",
            ]}
            rows={[
              ["Ingrédients", "CRUD", "CRUD", "R"],
              [
                "Unités, Rayons, Types, Tags",
                "CRUD",
                "CRUD",
                "R",
              ],
              ["Saisons", "CRUD", "R", "R"],
            ]}
          />
        </Section>

        {/* Matrice contenus d'équipe */}
        <Section title="Matrice — Contenus d'équipe">
          <Table
            headers={[
              "Domaine",
              "Admin global",
              "Traiteur",
              "Contributeur",
              "Autre membre",
            ]}
            rows={[
              [
                "Recettes (équipe)",
                "CRUD + publish",
                "R",
                "CRUD + publish",
                "R",
              ],
              [
                "Recettes (autres)",
                "CRUD",
                "R si publique",
                "R si publique",
                "R si publique",
              ],
              [
                "Événements (équipe)",
                "CRUD + publish",
                "CRUD + publish",
                "R",
                "R",
              ],
              [
                "Événements (autres)",
                "CRUD",
                "—",
                "—",
                "—",
              ],
            ]}
          />
        </Section>

        {/* Matrice administration */}
        <Section title="Matrice — Administration d'équipe">
          <Table
            headers={[
              "Domaine",
              "Admin global",
              "Team manager",
              "Website mgr",
              "Autre",
            ]}
            rows={[
              ["Créer une équipe", "C", "—", "—", "—"],
              [
                "Modifier une équipe",
                "U (toutes)",
                "U (sa team)",
                "—",
                "—",
              ],
              ["Supprimer une équipe", "D", "—", "—", "—"],
              [
                "Utilisateurs (équipe)",
                "Tout",
                "CRUD + rôles",
                "—",
                "R",
              ],
              ["Statut utilisateur", "Tout", "—", "—", "—"],
              ["Sites", "CRUD", "—", "CR + U", "—"],
              ["Clés API", "CRUD", "CRUD *", "CRUD *", "—"],
            ]}
          />
          <p className="text-xs text-brun-light mt-2">
            * Clés API : nécessite{" "}
            <strong>Team manager ET Website manager</strong> sur la même
            équipe.
          </p>
        </Section>

        {/* Règles spéciales */}
        <Section title="Règles spéciales">
          <div className="space-y-3">
            <Rule title="Lecture cross-team">
              Un utilisateur ne voit que les contenus de ses équipes,
              sauf les recettes marquées publiques (visibles par tous)
              et l&apos;Admin global qui voit tout.
            </Rule>
            <Rule title="Sélection de recettes dans un événement">
              Un Traiteur peut ajouter à un événement : les recettes de
              son équipe, les recettes publiques, ou les recettes
              d&apos;une autre équipe s&apos;il est aussi Contributeur
              sur celle-ci.
            </Rule>
            <Rule title="Auto-délégation Team manager">
              Un Team manager peut nommer d&apos;autres Team managers
              sur sa propre équipe. La propagation est horizontale, sans
              hiérarchie.
            </Rule>
            <Rule title="Sites : pas de hard delete">
              Même un Admin global ne peut que soft-delete un site. Cela
              protège contre la perte de domaines DNS sans trace.
            </Rule>
            <Rule title="Clés API : intersection de rôles">
              La gestion des clés API est le seul endroit qui exige deux
              rôles simultanés (Team manager + Website manager) sur la
              même équipe.
            </Rule>
            <Rule title="Anti-escalade sur la modification d'utilisateur">
              Un Team manager ne peut modifier les infos de base ou le
              mot de passe d&apos;un utilisateur que si celui-ci n&apos;a
              aucun rôle en dehors des équipes qu&apos;il manage. Cela
              empêche de reset le mot de passe d&apos;un Admin global.
            </Rule>
          </div>
        </Section>
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl p-6">
      <h2 className="font-serif text-lg text-brun mb-4">{title}</h2>
      {children}
    </div>
  )
}

function Bullet() {
  return (
    <span className="text-orange mt-1 flex-shrink-0 text-xs leading-none">
      &#9679;
    </span>
  )
}

function RoleCard({
  name,
  scope,
  color,
  description,
  abilities,
  restrictions,
}: {
  name: string
  scope: "global" | "team"
  color: string
  description: string
  abilities: string[]
  restrictions?: string[]
}) {
  return (
    <div className="border border-brun/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${
            color === "orange"
              ? "bg-orange/10 text-orange"
              : "bg-vert-eau/20 text-brun"
          }`}
        >
          {name}
        </span>
        <span className="text-[10px] text-brun-light uppercase tracking-wide">
          {scope === "global" ? "Global" : "Par équipe"}
        </span>
      </div>
      <p className="text-sm text-brun-light mb-3">{description}</p>
      <div className="space-y-1">
        {abilities.map((a, i) => (
          <div key={i} className="flex gap-2 text-xs text-brun">
            <span className="text-vert-eau mt-0.5 flex-shrink-0">
              +
            </span>
            <span>{a}</span>
          </div>
        ))}
        {restrictions?.map((r, i) => (
          <div key={i} className="flex gap-2 text-xs text-brun-light">
            <span className="text-rose mt-0.5 flex-shrink-0">-</span>
            <span>{r}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Table({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-creme/50 text-[11px] font-semibold text-brun-light uppercase tracking-wide">
            {headers.map((h, i) => (
              <th
                key={i}
                className={`px-3 py-2 ${i === 0 ? "text-left" : "text-center"}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className={ri % 2 === 0 ? "bg-white" : "bg-creme/30"}
            >
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className={`px-3 py-2 ${
                    ci === 0
                      ? "text-left text-brun font-medium"
                      : "text-center text-brun-light"
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Rule({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-creme rounded-lg px-4 py-3">
      <h4 className="text-xs font-semibold text-brun mb-1">{title}</h4>
      <p className="text-xs text-brun-light">{children}</p>
    </div>
  )
}
