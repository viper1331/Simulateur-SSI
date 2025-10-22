# Modèle de données Prisma

| Table      | Champs clés | Description |
|------------|-------------|-------------|
| `User`     | `id`, `name`, `role` | Comptes formateur / apprenant. |
| `Scenario` | `id`, `name`, `description`, `config` | Définition pédagogique et paramètres T1/T2, ZD/ZF, DAS. |
| `Event`    | `id`, `scenarioId`, `type`, `payload`, `offset` | Événements injectables (DM, DAI, défauts). |
| `Run`      | `id`, `scenarioId`, `traineeId`, `trainerId`, `score`, `status` | Session de formation chronométrée. |
| `Action`   | `id`, `runId`, `type`, `payload` | Actions réalisées par l'apprenant (acquittement, reset, etc.). |
| `Score`    | `id`, `runId`, `label`, `delta` | Points accordés / retirés selon le barème. |

La colonne `config` de `Scenario` contient le mapping complet ZD ↔ ZF ↔ DAS ainsi que les canaux UGA.
