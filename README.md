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
- **Vue 3D animée** des montures (three.js, modèles construits à partir du catalogue) :
  rotation automatique sur la page d'accueil, manipulation au doigt sur chaque fiche.
- **Espace équipe** (`/admin`) : rendez-vous du jour, création et suivi des commandes, et
  **SMS automatique au client quand ses lunettes sont prêtes**. Journal des SMS.

Stack : Next.js 16 (App Router), TypeScript, Tailwind CSS 4, Zod, three.js,
`@mediapipe/tasks-vision`, Cloudflare D1 / PostgreSQL (`postgres`, pure JS), Vitest.

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
| `DATABASE_URL` | PostgreSQL (Supabase, Neon…). Appliquer `src/lib/db/schema.sql` une fois. Sur Cloudflare, le binding D1 `DB` est utilisé à la place ; sinon : fichier JSON local. |
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

### Cloudflare Workers (configuration actuelle)

Le site tourne sur Cloudflare Workers via l'adaptateur [OpenNext](https://opennext.js.org/cloudflare),
avec une base **D1** (`optic-coob`) pour les rendez-vous, commandes et le journal SMS, et un
**Cron Trigger** quotidien pour les SMS de rappel. Tout est décrit dans `wrangler.jsonc`.

Dans le tableau de bord Cloudflare → Workers → `optic-coob` → *Settings* → *Build* :

| Réglage | Valeur |
| --- | --- |
| Build command | `npm run build:cf` |
| Deploy command | `npx wrangler deploy` |

Sans build command, `wrangler deploy` ne trouve rien à déployer (c'est l'erreur
« Could not detect a directory containing static files »).

Secrets à définir une fois (*Settings* → *Variables and Secrets*, ou `npx wrangler secret put NOM`) :
`ADMIN_PASSWORD`, `CRON_SECRET`, puis les identifiants SMS (`SMS_PROVIDER=orange` ou `twilio`
et les variables associées). La variable `NEXT_PUBLIC_SITE_URL` de `wrangler.jsonc` doit
pointer vers l'URL réelle du site (domaine personnalisé ou `*.workers.dev`).

Le schéma D1 a déjà été appliqué sur la base de production. Pour le rejouer ou l'appliquer
en local :

```bash
npx wrangler d1 execute optic-coob --remote --file=src/lib/db/schema.sqlite.sql
npx wrangler d1 execute optic-coob --local  --file=src/lib/db/schema.sqlite.sql   # dev local
```

Test en local, identique à la production (worker + D1 locale) :

```bash
npm run preview:cf
```

Depuis un poste connecté à Cloudflare (`npx wrangler login`), `npm run deploy:cf` construit et
déploie en une commande.

### Vercel ou serveur classique

Le projet fonctionne aussi sur Vercel (cron des rappels dans `vercel.json`) : le système de
fichiers y est éphémère, définir `DATABASE_URL` (Supabase par exemple) et appliquer
`src/lib/db/schema.sql`. Sur un serveur classique (VPS), le stockage JSON local suffit pour
démarrer ; `DATA_FILE` permet de choisir l'emplacement du fichier.

## Structure

```
src/app/            pages (accueil, montures, essayage, rendez-vous, suivi, admin) et API
src/components/     en-tête, pied de page, TryOn, BookingForm, OrderTracker, admin
src/lib/config.ts   agences, horaires, réglages métier
src/lib/frames.ts   catalogue
src/lib/db/         stockage (Cloudflare D1, PostgreSQL ou fichier JSON) + schémas SQL
src/lib/sms/        fournisseurs SMS et modèles de messages
src/lib/glasses-scene.ts  scène 3D three.js ; src/lib/lens-outline.ts  contours des verres
cloudflare/         point d'entrée du Worker (site + cron) ; wrangler.jsonc, open-next.config.ts
scripts/            génération des visuels de montures, copie des fichiers MediaPipe
tests/              tests unitaires (Vitest)
```

## À compléter par COOB

- Adresses exactes et liens Google Maps des trois agences, horaires réels.
- Prix et références réelles des montures (`src/lib/frames.ts`), visuels photo si disponibles.
- Identifiants SMS (Orange ou Twilio) et mot de passe de l'espace équipe.
- Liens Facebook / Instagram.
