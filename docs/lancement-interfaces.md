# Lancement des interfaces

Cette notice décrit comment démarrer les deux interfaces web du simulateur :

- **Poste Apprenant** (`apps/trainee-station`) qui émule la façade CMSI et les périphériques SDI.
- **Console Formateur** (`apps/trainer-console`) qui permet la supervision et l'orchestration des scénarios.

## 1. Pré-requis

1. Node.js 20 (ou version LTS la plus récente) et npm installés localement.
2. Dépendances installées à la racine du monorepo :

   ```bash
   npm install
   ```

3. Base de données SQLite initialisée pour le serveur en exécutant :

   ```bash
   npm run prisma:deploy
   ```

## 2. Lancement groupé (mode développeur)

La commande suivante lance simultanément le serveur backend ainsi que les deux interfaces via `concurrently` :

```bash
npm run dev
```

- **Serveur API + WebSocket** : http://localhost:4500
- **Poste Apprenant** : http://localhost:5300
- **Console Formateur** : http://localhost:5301

Chaque application Vite se reconnecte automatiquement au serveur WebSocket lorsque ce dernier redémarre.

## 3. Lancement individuel

Si nécessaire, chaque composant peut être lancé séparément (ports identiques qu'en mode groupé) :

```bash
# Serveur Express + WebSocket
npm run dev -w apps/server

# Interface Apprenant (Vite)
npm run dev -w apps/trainee-station

# Interface Formateur (Vite)
npm run dev -w apps/trainer-console
```

Cette approche est utile pour n'observer que les logs d'une application ou attacher un débogueur.

## 4. Configuration réseau

Les interfaces consomment deux variables d'environnement Vite lors du build ou du dev server :

- `VITE_SERVER_API` : URL HTTP utilisée pour les appels REST (par défaut `http://localhost:4500`).
- `VITE_SERVER_WS` : URL WebSocket utilisée pour le temps réel (par défaut `ws://localhost:4500`).

Créez un fichier `.env.local` à la racine de chaque interface pour personnaliser ces valeurs si le serveur tourne sur une autre machine ou un autre port :

```bash
# apps/trainee-station/.env.local
VITE_SERVER_API=https://ssi.example.com/api
VITE_SERVER_WS=wss://ssi.example.com/ws
```

Les mêmes clés peuvent être définies pour la console formateur.

## 5. Dépannage rapide

| Symptôme | Piste de résolution |
| --- | --- |
| Les interfaces affichent « Connexion perdue » | Vérifier que `npm run dev -w apps/server` écoute bien sur le port 4500 et que le pare-feu autorise l'accès. |
| Erreur « Failed to fetch » dans la console navigateur | S'assurer que `VITE_SERVER_API` pointe vers le bon hôte et que CORS est autorisé (activé par défaut dans Express). |
| Ports 5300/5301 déjà utilisés | Relancer Vite avec `--port` et mettre à jour les variables `VITE_SERVER_*` pour refléter les nouvelles URLs. |

Avec ces étapes, les deux interfaces restent synchronisées avec le serveur SSI pour les sessions de formation.
