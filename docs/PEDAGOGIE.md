# Séance pédagogique – Central SSI virtuel

Cette séance vise à entraîner un binôme apprenant à la gestion d'une alarme incendie sur CMSI catégorie A, avec supervision par un formateur.

## Objectifs pédagogiques

- Connaître la chaîne événementielle : détection (DM/DAI) → T1 → T2 → UGA.
- Acquérir les bons réflexes d'exploitation (acquittement, arrêt évacuation, réarmement).
- Diagnostiquer et lever les défauts (DAS hors position, coupure secteur, batterie faible).
- Utiliser le journal et la timeline pour produire un compte rendu détaillé.

## Déroulé type (45 min)

| Phase | Durée | Acteurs | Description |
| --- | --- | --- | --- |
| Briefing | 5 min | Formateur | Rappel du contexte SSI, présentation du poste central et des raccourcis. |
| Scénario 1 (DM + UGA) | 10 min | Binôme | Déclenchement DM → observation T1/T2 → évacuation. Contrôle des actions et des délais. |
| Scénario 2 (DAS) | 10 min | Binôme | DAI en zone désenfumage, défaut position DAS. Diagnostic par lecture LCD/journal, remise en service. |
| Scénario 3 (Alimentation) | 10 min | Binôme | Coupure secteur, bascule batterie, retour secteur. Validation des voyants et du journal. |
| Replay & débrief | 10 min | Formateur + binôme | Lecture timeline, analyse des marqueurs, export PDF et commentaire individuel. |

## Critères d'évaluation

1. **Temps d'acquittement** : < T1 pour éviter l'UGA (score maximal). Au-delà de T2, pénalité majeure.
2. **Ordre des actions** : Acquittement → Diagnostic → Arrêt UGA → Réarmement. Toute inversion critique déclenche un malus.
3. **Gestion des défauts** : capacité à identifier les voyants actifs, à consulter le journal et à lever le défaut (DAS, secteur, batterie).
4. **Utilisation du journal** : enregistrement systématique des actions, ajout de commentaires si requis.
5. **Esprit d'équipe** : communication claire entre chef de manœuvre (apprenant A) et opérateur (apprenant B).

## Matériel / supports

- Monorepo `ssi-sim/` lancé via `npm run dev`.
- 2 postes apprenants (un pour la console, un pour la façade central) + 1 poste formateur.
- Casque audio ou haut-parleurs dédiés au central.
- Paperboard ou fiche d'analyse pour noter les temps clés.

## Conseils au formateur

- Utiliser les marqueurs (bookmarks) pour signaler les instants pédagogiques importants.
- Varier les paramètres T1/T2 et activer le mode examen en fin de séance pour retirer les aides visuelles.
- Exploiter l'export PDF comme trace écrite dans le livret stagiaire.
- En cas de latence réseau, privilégier un réseau local dédié ou désactiver les clients inutiles.

## Annexes

- Mapping touches : voir README.md.
- Diagrammes d'état détaillés : `docs/state-diagrams.md`.
- Barème chiffré : `packages/shared-models/src/index.ts` (`initialScoreRules`).
