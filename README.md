# COOB Optique — site web

Site vitrine et outils métier pour **COOB, Centre d'Optique et d'Optométrie du Burkina**
(agences Koulouba et Gounghin à Ouagadougou, agence Bobo à Bobo-Dioulasso).

Fonctionnalités :

- **Catalogue de montures** avec filtres (forme, matière, genre, budget) et fiches détaillées.
- **Essayage virtuel** : détection du visage dans le navigateur (MediaPipe Face Landmarker),
  superposition de la monture en direct (caméra) ou sur une photo, capture à partager.
  Aucune image n'est envoyée au serveur.
- **Prise de rendez-vous** pour un examen de vue, par agence, avec créneaux en temps réel,
  SMS de confirmation immédiat et SMS de rappel la veille.
- **Suivi de commande** côté client (référence + téléphone).
- **Espace équipe** (`/admin`) : rendez-vous du jour, création et suivi des commandes, et
  **SMS automatique au client quand ses lunettes sont prêtes**. Journal des SMS.

Stack : Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Zod, `postgres` (pure JS),
`@mediapipe/tasks-vision`, Vitest.

## Démarrer

```bash
npm install          # copie aussi les fichiers WASM MediaPipe dans public/mediapipe/wasm
cp .env.example .env.local
# renseigner au minimum ADMIN_PASSWORD
npm run dev
```

- Site : http://localhost:3000
- Espace équipe : http://localhost:3000/admin

Sans base de données configurée, les données sont stockées dans `data/store.json`.
Sans fournisseur SMS configuré, les SMS sont affichés dans la console du serveur.

## Vérifications

```bash
npm run check   # typecheck + lint + tests
npm run build
```

## Configuration

Tout ce qui est propre à COOB est dans `src/lib/config.ts` : agences (noms, téléphones),
horaires d'ouverture, durée et capacité des créneaux, motifs de rendez-vous, marques.
Le catalogue est dans `src/lib/frames.ts` (prix indicatifs à ajuster) ; les visuels des montures
sont générés par `npm run frames` dans `public/frames/`.

Variables d'environnement (voir `.env.example`) :

| Variable | Rôle |
| --- | --- |
| `ADMIN_PASSWORD` | Active l'espace équipe (obligatoire en production). |
| `DATABASE_URL` | PostgreSQL (Supabase, Neon…). Appliquer `src/lib/db/schema.sql` une fois. Sinon : fichier JSON local. |
| `SMS_PROVIDER` | `console` (défaut), `twilio` ou `orange`. |
| `TWILIO_*` / `ORANGE_*` | Identifiants du fournisseur SMS choisi. |
| `CRON_SECRET` | Protège `/api/cron/reminders` (rappels de RDV la veille, planifié dans `vercel.json`). |
| `NEXT_PUBLIC_ADDRESS_*`, `NEXT_PUBLIC_MAPS_*` | Adresses exactes et liens Google Maps des agences. |
| `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_FACEBOOK_URL`, `NEXT_PUBLIC_INSTAGRAM_URL` | Contacts et réseaux. |

### SMS

Deux fournisseurs sont intégrés (`src/lib/sms/`) :

- **Orange SMS API** (developer.orange.com), disponible au Burkina Faso — recommandé pour les
  numéros Orange, tarif local.
- **Twilio**, couverture internationale dont le +226.

Les modèles de messages sont dans `src/lib/sms/templates.ts` (sans accents pour rester en
encodage GSM-7, 1 à 2 segments). Chaque envoi est journalisé (table `sms_log` / onglet
« Journal SMS » de l'espace équipe) ; un échec n'empêche jamais l'enregistrement d'un
rendez-vous ou d'une commande, et le bouton « Renvoyer le SMS » permet de réessayer.

### Flux « lunettes prêtes »

1. L'équipe crée la commande dans `/admin/commandes` (client, téléphone, agence de retrait,
   monture, verres, acompte). Le client reçoit sa référence `COOB-XXXXX` par SMS.
2. Statuts : Commande reçue → En fabrication → **Prête à retirer** → Retirée.
3. Le passage à « Prête » envoie automatiquement le SMS au client. Le client peut aussi suivre
   sa commande sur `/suivi`.

## Déploiement

Le projet est prêt pour Vercel (cron des rappels dans `vercel.json`). Avec Vercel, le système
de fichiers est éphémère : définir `DATABASE_URL` (Supabase par exemple) et appliquer
`src/lib/db/schema.sql`. Sur un serveur classique (VPS), le stockage JSON local suffit pour
démarrer ; `DATA_FILE` permet de choisir l'emplacement du fichier.

## Structure

```
src/app/            pages (accueil, montures, essayage, rendez-vous, suivi, admin) et API
src/components/     en-tête, pied de page, TryOn, BookingForm, OrderTracker, admin
src/lib/config.ts   agences, horaires, réglages métier
src/lib/frames.ts   catalogue
src/lib/db/         stockage (fichier JSON ou PostgreSQL) + schéma SQL
src/lib/sms/        fournisseurs SMS et modèles de messages
scripts/            génération des visuels de montures, copie des fichiers MediaPipe
tests/              tests unitaires (Vitest)
```

## À compléter par COOB

- Adresses exactes et liens Google Maps des trois agences, horaires réels.
- Prix et références réelles des montures (`src/lib/frames.ts`), visuels photo si disponibles.
- Identifiants SMS (Orange ou Twilio) et mot de passe de l'espace équipe.
- Liens Facebook / Instagram.
