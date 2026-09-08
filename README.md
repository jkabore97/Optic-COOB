# COOB Optique — site web

Site vitrine et outils métier pour **COOB, Centre d'Optique et d'Optométrie du Burkina**
(agences Koulouba et Gounghin à Ouagadougou, agence Bobo à Bobo-Dioulasso).

Fonctionnalités :

- **Catalogue de montures** géré dans l'espace équipe (photo du produit, prix, caractéristiques),
  avec filtres (forme, matière, genre, budget) et fiches détaillées. Tant qu'aucune monture n'a été
  ajoutée, le site affiche des modèles de démonstration.
- **Essayage virtuel** : détection du visage dans le navigateur (MediaPipe Face Landmarker), en
  direct (caméra) ou sur une photo, capture à partager. Aucune image n'est envoyée au serveur.
  Deux rendus : **3D** (modèle GLB de la monture posé sur le visage avec three.js, suit
  l'orientation de la tête, branches masquées derrière le visage, exposition calée sur la vidéo)
  ou **photo** (image de la monture inclinée avec la tête) quand la monture n'a pas de modèle 3D.
- **Prise de rendez-vous** pour un examen de vue, par agence, avec créneaux en temps réel,
  SMS de confirmation immédiat et SMS de rappel la veille.
- **Suivi de commande** côté client (référence + téléphone).
- **Vue 3D animée** des montures (three.js, modèles construits à partir du catalogue) :
  rotation automatique sur la page d'accueil, manipulation au doigt sur chaque fiche.
- **Espace équipe** (`/admin`) : montures du catalogue, rendez-vous du jour, création et suivi des
  commandes, et **SMS automatique au client quand ses lunettes sont prêtes**. Journal des SMS.

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
Les montures de démonstration sont dans `src/lib/frames.ts` ; leurs visuels sont générés par
`npm run frames` dans `public/frames/`. Les vraies montures se gèrent dans `/admin/montures`.

### Ajouter une monture (espace équipe → Montures)

1. **Photo** : de face, monture ouverte, sur fond blanc ou uni. L'option « Rendre le fond clair
   transparent » détoure automatiquement les photos sur fond blanc (un PNG déjà détouré donne le
   meilleur résultat).
2. **Calibrage** : cliquer sur le centre du verre gauche, puis du verre droit. Ces deux points sont
   alignés sur les pupilles lors de l'essayage virtuel.
3. **Fiche** : nom, marque, prix, forme, matière, coloris, tailles, description.

Les photos sont stockées dans la base de données et servies par `/api/frames/:id/image` avec un
cache long.

### Modèles 3D (essayage réaliste)

Dans la même fiche, section « Modèle 3D », deux possibilités :

**Générer depuis la photo** (bouton « Générer le modèle 3D depuis la photo ») : la photo détourée
(fond et verres transparents) est convertie en modèle 3D dans le navigateur, en moins d'une
seconde : contour de la monture extrait (`src/lib/contour.ts`), extrudé avec l'épaisseur et un galbe,
texturé avec la photo, verres transparents dans les trous, branches et charnières paramétriques
(`src/lib/frame-builder.ts`). Renseignez les tailles verre / pont / branche avant de générer pour
une échelle exacte. Le résultat est un GLB d'environ 0,5 à 1 Mo.

**Importer un fichier** : un **`.glb`** (glTF binaire) de la monture,
**3 Mo maximum** (limite des requêtes Vercel). Conventions : face avant vers +Z, branches vers
−Z, monture ouverte, à l'échelle réelle ; l'origine est recalculée automatiquement (milieu des
verres). Un aperçu tournant vérifie l'orientation avant l'enregistrement. Le modèle est servi par
`/api/frames/:id/model`.

Pour alléger un GLB : `npx @gltf-transform/cli optimize in.glb out.glb --compress draco --texture-size 1024`.

Sources de modèles : fournisseurs (demander les assets 3D), modélisation par un artiste 3D, ou
scan photogrammétrique. Tant qu'une monture n'a pas de modèle, l'essayage utilise sa photo.

Variables d'environnement (voir `.env.example`) :

| Variable | Rôle |
| --- | --- |
| `ADMIN_PASSWORD` | Active l'espace équipe (obligatoire en production). |
| `DATABASE_URL` (ou `POSTGRES_URL`) | PostgreSQL (Neon via Vercel Storage, Supabase…). Les tables sont créées automatiquement. Sur Cloudflare, le binding D1 `DB` est utilisé à la place ; sinon : fichier JSON local. |
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

### Vercel (configuration actuelle)

Le site est déployé sur Vercel depuis la branche `main`. Le système de fichiers de Vercel étant
éphémère, une base PostgreSQL est indispensable pour conserver les montures, rendez-vous et
commandes :

1. Tableau de bord Vercel → projet → **Storage** → *Create Database* → **Neon (Postgres)**, plan
   gratuit. Vercel ajoute automatiquement `DATABASE_URL` / `POSTGRES_URL` au projet.
2. **Settings → Environment Variables** : `ADMIN_PASSWORD` (espace équipe) et `CRON_SECRET`
   (rappels de rendez-vous, cron dans `vercel.json`).
3. Redéployer (*Deployments* → *Redeploy*). Les tables sont créées au premier accès.

### Cloudflare Workers

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

Les tables D1 sont créées automatiquement au premier accès.

Test en local, identique à la production (worker + D1 locale) :

```bash
npm run preview:cf
```

Depuis un poste connecté à Cloudflare (`npx wrangler login`), `npm run deploy:cf` construit et
déploie en une commande.

### Serveur classique

Sur un serveur classique (VPS), le stockage JSON local suffit pour démarrer ; `DATA_FILE` permet
de choisir l'emplacement du fichier (les photos sont enregistrées à côté, dans `data/frames/`).

## Structure

```
src/app/            pages (accueil, montures, essayage, rendez-vous, suivi, admin) et API
src/components/     en-tête, pied de page, TryOn, BookingForm, OrderTracker, admin
src/lib/config.ts   agences, horaires, réglages métier
src/lib/frames.ts   catalogue
src/lib/catalog.ts  catalogue public (base de données, ou démonstration si vide)
src/lib/db/         stockage (Cloudflare D1, PostgreSQL ou fichier JSON) + schémas SQL (schema.ts)
src/lib/tryon-math.ts  placement d'un visuel photo sur les pupilles ; src/lib/image-tools.ts  détourage
src/lib/tryon-3d.ts    moteur d'essayage 3D (three.js) ; src/lib/tryon-3d-math.ts  géométrie testée
src/lib/sms/        fournisseurs SMS et modèles de messages
src/lib/glasses-scene.ts  scène 3D three.js ; src/lib/lens-outline.ts  contours des verres
cloudflare/         point d'entrée du Worker (site + cron) ; wrangler.jsonc, open-next.config.ts
scripts/            génération des visuels de montures, copie des fichiers MediaPipe
tests/              tests unitaires (Vitest)
```

## À compléter par COOB

- Adresses exactes et liens Google Maps des trois agences, horaires réels.
- Vraies montures avec photos, dans l'espace équipe (`/admin/montures`).
- Identifiants SMS (Orange ou Twilio) et mot de passe de l'espace équipe.
- Liens Facebook / Instagram.
