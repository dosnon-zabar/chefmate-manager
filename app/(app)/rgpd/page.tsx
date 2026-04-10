export default function RGPDPage() {
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-serif text-3xl text-brun">RGPD / Clean</h1>
        <p className="text-sm text-brun-light mt-1">
          Procédures de nettoyage et de conformité des données
          personnelles
        </p>
      </header>

      <div className="space-y-6">
        {/* Performance alert */}
        <div className="bg-rose/10 border border-rose/20 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-rose/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-rose" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-serif text-lg text-brun mb-2">
                Performance en production
              </h2>
              <p className="text-sm text-brun leading-relaxed mb-3">
                <strong>L&apos;application est lente en production</strong> en
                raison de l&apos;architecture double-hop serverless
                (Manager Netlify → Admin Netlify → Supabase). Chaque
                requête subit potentiellement deux cold starts de 1 à 3
                secondes chacun.
              </p>
              <div className="text-xs text-brun-light space-y-1.5">
                <p className="font-semibold text-brun">Actions recommandées (par priorité) :</p>
                <p>1. <strong>Héberger le manager sur un VPS</strong> (~5€/mois Hetzner/Railway) — process Node permanent, zéro cold start côté manager.</p>
                <p>2. <strong>Ajouter du cache</strong> sur les données stables (référentiels, rôles, teams) — réduit les appels API de 80%.</p>
                <p>3. <strong>Batcher les appels N+1</strong> (page équipes : 1 appel au lieu de N pour les membres).</p>
                <p>4. <strong>Passer Supabase en Pro</strong> ($25/mois) — DB dédiée, jamais en pause.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Intro */}
        <div className="bg-white rounded-2xl p-6">
          <p className="text-sm text-brun leading-relaxed">
            Cette page recense les procédures de nettoyage
            irréversible (hard delete) et de conformité RGPD. Chaque
            procédure devra être implémentée sous forme d&apos;action
            déclenchable depuis cette interface, avec confirmation par
            mot de passe et journalisation dans l&apos;audit log.
          </p>
          <p className="text-xs text-brun-light mt-3">
            Toutes les actions décrites ici sont réservées à
            l&apos;Admin global.
          </p>
        </div>

        {/* Procedure 1: Hard delete user */}
        <ProcedureCard
          number={1}
          title="Suppression définitive d'un utilisateur"
          status="todo"
          description="Suppression physique d'un utilisateur et anonymisation de toutes ses traces dans le système."
          steps={[
            "Vérifier que l'utilisateur est déjà en statut 'deleted' (soft delete préalable obligatoire).",
            "Supprimer toutes les lignes user_roles de cet utilisateur.",
            "Supprimer toutes les lignes user_teams de cet utilisateur.",
            "Anonymiser la ligne users : remplacer email par deleted-{id}@chefmate.local, nullifier phone, remplacer first_name par 'Utilisateur' et last_name par 'Supprimé', vider password_hash.",
            "Vérifier les FK : recipe.creator_id, recipe.modifier_id, event_testimonials, notes — ne PAS supprimer ces lignes, mais s'assurer que l'affichage gère un user anonymisé (nom générique).",
            "Journaliser l'action dans l'audit log avec l'ID de l'admin qui a déclenché, la date et l'ID du user anonymisé.",
            "Confirmer par toast et afficher un récapitulatif des éléments nettoyés.",
          ]}
          considerations={[
            "L'anonymisation est préférable au DELETE physique pour préserver l'intégrité référentielle (recettes, événements, commentaires).",
            "Un user anonymisé ne peut plus être réactivé — c'est irréversible.",
            "Penser au droit à l'oubli RGPD : le user peut demander cette action par écrit.",
            "Les données supprimées doivent inclure toute donnée personnelle : email, phone, nom, prénom. Les ID techniques sont conservés.",
          ]}
        />

        {/* Procedure 2: Hard delete team */}
        <ProcedureCard
          number={2}
          title="Suppression définitive d'une équipe"
          status="todo"
          description="Suppression physique d'une équipe et nettoyage de toutes les données associées."
          steps={[
            "Vérifier que l'équipe est déjà en statut 'deleted' (soft delete préalable obligatoire — les membres et rôles ont déjà été détachés par la cascade).",
            "Supprimer toutes les lignes team_api_keys (même révoquées) de cette équipe.",
            "Supprimer les lignes recipe_teams pour cette équipe (les recettes restent, elles perdent juste le lien à cette équipe).",
            "Supprimer les lignes event_teams pour cette équipe (idem).",
            "Supprimer les sites liés (sites.team_id = cette équipe) — ou les réattacher à une autre équipe si nécessaire.",
            "Supprimer les éventuelles lignes user_roles et user_teams résiduelles (normalement déjà nettoyées par la cascade soft delete, mais sécurité).",
            "Supprimer physiquement la ligne teams.",
            "Journaliser l'action dans l'audit log.",
          ]}
          considerations={[
            "La suppression d'une équipe orpheline (0 membre, 0 recette, 0 événement) est sans risque.",
            "Si l'équipe a encore des recettes/événements liés, il faut décider : les réattacher à une autre équipe ou les rendre orphelins (visibles uniquement en Admin global).",
            "Les clés API révoquées contiennent des hash — pas de donnée personnelle, mais le préfixe peut identifier l'équipe.",
            "Vérifier que le site web associé (s'il existe) est bien hors ligne avant de supprimer.",
          ]}
        />

        {/* Procedure 3: Identify orphan users */}
        <ProcedureCard
          number={3}
          title="Identification des utilisateurs orphelins"
          status="todo"
          description="Lister les utilisateurs qui ne sont liés à aucune équipe et n'ont aucun rôle, pour décider de leur sort."
          steps={[
            "Requête : SELECT users WHERE id NOT IN (SELECT user_id FROM user_teams) AND id NOT IN (SELECT user_id FROM user_roles).",
            "Afficher la liste avec : nom, email, statut, date de création, date de dernière modification.",
            "Pour chaque orphelin, proposer les actions : réattacher à une équipe, passer en inactive, passer en deleted, ou lancer la procédure de hard delete (procédure 1).",
            "Permettre un traitement en lot (sélection multiple + action groupée).",
          ]}
          considerations={[
            "Un user orphelin peut résulter de la suppression de sa seule équipe (cascade soft delete).",
            "Un user créé récemment mais pas encore attaché à une équipe n'est PAS un orphelin à nettoyer — vérifier la date de création.",
            "Les Admin global sans équipe ne sont PAS des orphelins (ils ont un rôle global). Exclure les users ayant au moins un rôle global.",
            "Cette vue devrait être un outil de monitoring régulier, pas uniquement une procédure ponctuelle.",
          ]}
        />

        {/* Procedure 4: Audit trail */}
        <ProcedureCard
          number={4}
          title="Journal des actions RGPD"
          status="todo"
          description="Historique de toutes les actions de nettoyage RGPD effectuées sur la plateforme."
          steps={[
            "Créer une table rgpd_audit_log (id, admin_user_id, action_type, target_type, target_id, details jsonb, created_at).",
            "Enregistrer automatiquement chaque hard delete / anonymisation.",
            "Afficher un tableau consultable avec filtres par date, par type d'action, par admin.",
            "Export CSV pour archivage / preuve de conformité.",
          ]}
          considerations={[
            "Ce journal est la preuve légale que les demandes de suppression ont été traitées.",
            "Il ne doit PAS contenir de données personnelles (pas le nom/email du user supprimé — seulement son ancien ID).",
            "Rétention recommandée : 3 ans (délai de prescription RGPD).",
            "L'accès au journal est limité à l'Admin global.",
          ]}
        />
        {/* Procedure 5: Deduplicate ingredients */}
        <ProcedureCard
          number={5}
          title="Dédoublonnage des ingrédients"
          status="todo"
          description="Identifier et fusionner les ingrédients en doublon dans le catalogue (ex: 'Tomate' et 'Tomates', 'Crème fraîche' et 'Crème fraiche')."
          steps={[
            "Lister les doublons potentiels : requête sur les noms proches (distance de Levenshtein, ou similarité trigram pg_trgm).",
            "Afficher les paires candidates avec pour chaque doublon : nom, nombre de recettes liées, rayons, unité par défaut.",
            "L'admin choisit l'ingrédient à conserver (le 'maître') et celui à fusionner (le 'doublon').",
            "Transférer toutes les liaisons du doublon vers le maître : UPDATE recipe_ingredients SET ingredient_id = maître WHERE ingredient_id = doublon.",
            "Transférer les ingredient_aisles et ingredient_units manquants (éviter les doublons de junction).",
            "Soft-delete l'ingrédient doublon (lifecycle_status = 'deleted').",
            "Journaliser la fusion dans l'audit log.",
          ]}
          considerations={[
            "Ne pas supprimer physiquement le doublon : le garder en deleted pour traçabilité.",
            "Vérifier les conversions d'unités (ingredient_conversions) : fusionner ou supprimer celles du doublon.",
            "La détection automatique peut proposer des faux positifs — toujours exiger une validation humaine.",
            "Envisager un mode 'dry run' qui montre l'impact avant d'exécuter.",
            "L'extension pg_trgm doit être activée sur Supabase pour la recherche de similarité.",
          ]}
        />

        {/* Procedure 6: Deduplicate tags */}
        <ProcedureCard
          number={6}
          title="Dédoublonnage des tags"
          status="todo"
          description="Identifier et fusionner les tags en doublon (ex: 'végétarien' et 'Végétarien', 'sans gluten' et 'Sans Gluten')."
          steps={[
            "Lister les doublons potentiels : grouper par lower(name) et identifier les groupes avec plus d'un tag.",
            "Afficher les paires avec pour chaque tag : nom, couleur, nombre de recettes liées.",
            "L'admin choisit le tag à conserver et celui à fusionner.",
            "Transférer les liaisons : UPDATE recipe_tags SET tag_id = maître WHERE tag_id = doublon (en ignorant les conflits de clé unique si la recette a déjà le tag maître).",
            "Supprimer le tag doublon (hard delete — les tags n'ont pas de lifecycle_status).",
            "Journaliser la fusion.",
          ]}
          considerations={[
            "La comparaison case-insensitive (lower(name)) détecte les doublons les plus évidents.",
            "Pour les variantes orthographiques (accents, tirets), envisager unaccent + trim.",
            "Contrairement aux ingrédients, les tags sont hard-deleted car pas de lifecycle_status. Prévoir un soft-delete sur les tags si on veut garder une trace.",
            "Le transfert de recipe_tags peut créer des doublons de junction — utiliser INSERT ON CONFLICT DO NOTHING.",
          ]}
        />
      </div>
    </div>
  )
}

function ProcedureCard({
  number,
  title,
  status,
  description,
  steps,
  considerations,
}: {
  number: number
  title: string
  status: "todo" | "in-progress" | "done"
  description: string
  steps: string[]
  considerations: string[]
}) {
  const statusLabel = {
    todo: "À implémenter",
    "in-progress": "En cours",
    done: "Implémenté",
  }
  const statusColor = {
    todo: "bg-brun/10 text-brun-light",
    "in-progress": "bg-orange/10 text-orange",
    done: "bg-vert-eau/20 text-brun",
  }

  return (
    <div className="bg-white rounded-2xl overflow-hidden">
      <div className="p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-full bg-brun text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
              {number}
            </span>
            <h2 className="font-serif text-lg text-brun">{title}</h2>
          </div>
          <span
            className={`text-xs font-medium rounded-full px-2.5 py-1 flex-shrink-0 ${statusColor[status]}`}
          >
            {statusLabel[status]}
          </span>
        </div>

        <p className="text-sm text-brun-light mb-5">{description}</p>

        <div className="mb-5">
          <h3 className="text-xs font-semibold text-brun uppercase tracking-wide mb-2">
            Étapes
          </h3>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-sm text-brun">
                <span className="text-brun-light font-mono text-xs mt-0.5 flex-shrink-0">
                  {i + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="bg-creme rounded-lg p-4">
          <h3 className="text-xs font-semibold text-brun uppercase tracking-wide mb-2">
            Points d&apos;attention
          </h3>
          <ul className="space-y-1.5">
            {considerations.map((c, i) => (
              <li
                key={i}
                className="flex gap-2 text-xs text-brun-light"
              >
                <span className="text-orange mt-0.5 flex-shrink-0">
                  &bull;
                </span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
