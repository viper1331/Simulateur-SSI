# Recette fonctionnelle – Central SSI virtuel

Cette recette couvre la façade CMSI virtuelle, la synchronisation multi-postes et la génération d'un rapport PDF enrichi.
Chaque test doit être réalisé sur une session `npm run dev` avec deux navigateurs (poste apprenant et façade central) et la console formateur.

## Préparation

1. Exécuter `npm run db:reset && npm run prisma:deploy && npm run seed`.
2. Lancer le serveur et les interfaces : `npm run dev`.
3. Créer ou sélectionner une session depuis la console formateur, inviter un apprenant et ouvrir la façade `apps/central-panel` (port 5400).
4. Vérifier que le hub audio est armé (bouton « Activer audio ») et que les raccourcis clavier sont fonctionnels.

## Campagne de tests (10 cas)

| # | Cas de test | Procédure | Résultat attendu |
| --- | --- | --- | --- |
| 1 | **DM → T1 → T2 → UGA** | Injecter un DM via la console. Ne pas acquitter avant T2. | Voyant Alarme rouge actif, T1 puis T2 décrémentent, UGA s'active (voyant + son BAAS). |
| 2 | **Acquittement dans T1** | Injecter un DM, acquitter au clavier (touche `A`) avant la fin de T1. | Retour à l'état idle, chronos remis à zéro, journal façade mentionne « Acquittement opérateur ». |
| 3 | **Arrêt évacuation & Réarmement** | Reprendre cas #1 mais acquitter après UGA, appuyer sur `S`, puis `R`. | Buzzer coupé, UGA arrêtée, réarmement accepté uniquement après retour DM + DAS. |
| 4 | **Défaut DAS** | Depuis la console, signaler un défaut de position DAS. | Voyant Défaut orange, LCD affiche « Défaut position DAS », journal synchronisé sur les trois interfaces. |
| 5 | **Retour DAS** | Réarmer le DAS depuis la façade (bouton « Réarmement DAS » sur console ou touche dédiée). | Voyant Défaut s'éteint, LCD affiche « DAS confirmé en position », réarmement CMSI possible. |
| 6 | **Coupure secteur** | Console formateur → couper le secteur, attendre bascule batterie. | Voyant Secteur s'éteint, voyant Batterie orange + buzzer, LCD affiche « SUR BATTERIE ». |
| 7 | **Retour secteur** | Après #6, restaurer le secteur. | Voyants Secteur/Batterie reviennent à l'état normal, buzzer silencieux. |
| 8 | **Masquage zone** | Depuis la façade, masquer ZD1 (bouton ou touche `M`). | Voyant Hors service actif, LCD mentionne la zone masquée, journal trace l'action apprenant. |
| 9 | **Mode Examen** | Activer le mode examen dans la console (cache les aides). | Raccourcis masqués côté façade, messages LCD minimalistes, scoring mis à jour. |
| 10 | **Replay & export PDF** | Finir un scénario, utiliser le module Replay puis exporter le rapport PDF. | Timeline interactive avec marqueurs, PDF contenant chronologie, graphes T1/T2 et score détaillé. |

## Validation

- Capturer les journaux (`events`) et vérifier qu'ils contiennent l'horodatage et le type (`system`, `action`, `inject`).
- Vérifier que le scoring live reflète les délais d'acquittement et les erreurs critiques (coupure secteur non traitée, DAS non remis, etc.).
- Confirmer que le rapport PDF inclut la courbe T1/T2, les actions clés (ACK, UGA, RESET) et les totaux temps.

## Rejouabilité

1. Depuis la console formateur, placer des marqueurs (bookmarks) pendant la session.
2. À la fin du scénario, lancer le replay, vérifier la navigation par marqueur et la synchronisation façade/console.
3. Exporter le PDF et archiver le fichier dans la fiche de séance.

## Notes

- Mode kiosque : ajouter `?kiosk=1` à l'URL du central pour passer en plein écran (ESC pour sortir).
- Pour les essais audio en salle, brancher un casque dédié sur le poste central.
- En cas de dérive temporelle > 100 ms entre les postes, vérifier la charge CPU et le réseau avant de rejouer les scénarios.
