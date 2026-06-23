# 🌙 Rêve Mieux — Journal & Cartographie des Rêves Lucides

## Vision du Projet
Rêve Mieux est une plateforme web complète dédiée à l'optimisation du rappel des rêves et à la pratique des rêves lucides. Basée sur la recherche scientifique en sommeil, elle encourage la tenue d'un journal de rêves — pratique qui renforce significativement le rappel onirique — tout en offrant une cartographie intelligente permettant d'explorer visuellement l'univers de ses rêves.

## Fonctionnalités Implémentées

### Comptes Utilisateurs & Sécurité
- Inscription / connexion sécurisée avec hashing SHA-256 + sel
- Tokens JWT (HMAC-SHA256) avec expiration 30 jours
- Données isolées par utilisateur (vie privée respectée)

### Journal de Rêves
- **Saisie ultra-rapide** pensée pour le réveil (interface mobile-first)
- **Dictée vocale** (Web Speech API — Chrome/Edge)
- Horodatage, classement chronologique, recherche textuelle
- Filtrage par type de rêve
- **Liaison aux séries** directement depuis le formulaire de création/édition

### Catégorisation Riche
- **Types de rêves** : normal, lucide, cauchemar, récurrent, hypnagogique, faux éveil
- **Émotions** avec intensité (1-5) : joie, peur, anxiété, émerveillement, tristesse, colère, confusion, paix, excitation, amour, nostalgie
- **Tags multi-catégories** : personnes, lieux, thèmes, symboles, tags personnalisés — sélection par catégories avec emojis
- **Niveaux** : lucidité (0-5), clarté du souvenir (1-5)

### Cartographie Interactive (D3.js)
- **Graphe force-directed** où chaque rêve est un nœud et chaque relation un lien
- Types de connexions : suite, continuation, personnage/lieu/thème commun
- Force de connexion paramétrable (1-5)
- Navigation visuelle avec zoom, drag, tooltips
- Coloration par type de rêve et appartenance aux séries

### Séries de Rêves & Incubation
- Regroupement de rêves en séries narratives ordonnées
- **Création de rêve directement depuis une série** (pré-lié)
- **Mode Incubation** : résumé du dernier épisode + formulation d'intention pré-sommeil
- Basé sur la technique d'incubation (Barrett, 1993 — ~50% de succès)

### Dashboard Statistiques
- Rêves totaux, lucides, taux de lucidité, streak journalier
- Graphique hebdomadaire (Chart.js)
- Répartition des émotions (doughnut), types de rêves (polar area)
- Tags les plus utilisés
- Heatmap calendrier 365 jours (D3.js)

### Aide à la Lucidité
- **Reality Checks** enregistrables (mains, texte, heure, nez pincé, gravité, interrupteur)
- Guides techniques : MILD, WBTB, Reality Testing, SSILD, Incubation, Journal
- **Bases scientifiques documentées** avec références (Schredl, LaBerge, Stumbrys, Barrett, Tholey)

## URLs
- **Production** : https://www.revemieux.app
- **Cloudflare Pages** : https://reve-mieux.pages.dev
- **GitHub** : https://github.com/romainfalanga/revemieux

## Architecture Technique

### Stack
- **Backend** : Hono (TypeScript) sur Cloudflare Workers/Pages
- **Base de données** : Cloudflare D1 (SQLite distribué)
- **Frontend** : SPA vanilla JS + Tailwind CSS (CDN) + D3.js + Chart.js
- **Auth** : JWT custom avec Web Crypto API
- **Voix** : Web Speech API (SpeechRecognition)

### API Routes
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Inscription |
| POST | `/api/auth/login` | Connexion |
| GET | `/api/auth/me` | Profil utilisateur |
| GET/POST | `/api/dreams` | Lister / Créer des rêves |
| GET/PUT/DELETE | `/api/dreams/:id` | Détail / Modifier / Supprimer |
| GET/POST/DELETE | `/api/tags` | Gestion des tags |
| GET/POST/DELETE | `/api/connections` | Connexions entre rêves |
| GET | `/api/connections/graph` | Données du graphe (nœuds + liens) |
| GET/POST/PUT/DELETE | `/api/series` | Séries de rêves |
| POST/DELETE | `/api/series/:id/dreams` | Ajouter/retirer un rêve d'une série |
| GET/POST/PUT | `/api/incubation` | Intentions d'incubation |
| GET | `/api/incubation/tonight` | Intention active ce soir |
| GET/POST | `/api/reality-checks` | Reality checks |
| GET | `/api/reality-checks/stats` | Stats des reality checks |
| GET | `/api/stats` | Dashboard statistiques |
| GET | `/api/stats/heatmap` | Heatmap calendrier |

### Schéma de Base de Données
- `users` — Comptes utilisateurs
- `dreams` — Journal des rêves (contenu, type, niveaux, dates)
- `dream_emotions` — Émotions associées avec intensité
- `tags` — Tags multi-catégories
- `dream_tags` — Association rêves ↔ tags
- `dream_connections` — Connexions entre rêves (le cœur de la cartographie)
- `dream_series` — Séries narratives
- `series_dreams` — Membres d'une série (ordonnés)
- `incubation_intents` — Intentions d'incubation pré-sommeil
- `reality_checks` — Log des contrôles de réalité
- `sessions` — Sessions JWT

## Bases Scientifiques

| Affirmation | Source | Statut |
|-------------|--------|--------|
| Le journal de rêves améliore le rappel onirique | Schredl & Erlacher (2004) | ✅ Validé |
| La combinaison MILD + WBTB est la plus efficace pour les rêves lucides | Stumbrys et al. (2012), méta-analyse | ✅ Validé |
| L'incubation de rêves influence le contenu (~50% de succès) | Barrett (1993), Harvard | ✅ Validé |
| Les reality checks réguliers favorisent la lucidité | Tholey (1983), LaBerge (1985) | ✅ Validé |
| La technique SSILD induit des rêves lucides | Communauté (CosmicIron) | ⚠️ Exploratoire |

## Déploiement & Infrastructure

> **IMPORTANT POUR LES AGENTS IA** : Ce projet est hébergé sur le **compte Cloudflare personnel de Romain** (PAS sur Genspark).
> - **NE JAMAIS utiliser `gsk hosted deploy`** — c'est l'ancienne infra Genspark, abandonnée.
> - **Le workflow de déploiement est : `git push origin main`** → Cloudflare Pages build automatiquement depuis GitHub.
> - La D1 est sur le compte CF de Romain (ID: `c6ceb37d-633f-4fbd-b609-3e4c7786c5fb`).
> - Pour modifier la DB en CLI : `npx wrangler d1 execute revemieux-production --remote` (nécessite le token CF de Romain via `CLOUDFLARE_API_TOKEN`).

- **Plateforme** : Cloudflare Pages (compte personnel Romain)
- **Repo GitHub** : `romainfalanga/revemieux` (branche `main`)
- **CI/CD** : GitHub → Cloudflare Pages (auto-deploy sur push)
- **Base de données** : Cloudflare D1 `revemieux-production` (compte Romain)
- **Domaine** : `www.revemieux.app` + `revemieux.app` (DNS sur Cloudflare, zone de Romain)
- **Status** : ✅ Production
- **Tech Stack** : Hono + TypeScript + D1 + TailwindCSS + D3.js + Chart.js
- **Last Updated** : 2026-06-23
