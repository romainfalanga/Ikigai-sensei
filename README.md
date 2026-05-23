# Ikigai Sensei - Découvre ta raison d'être

## Présentation

**Ikigai Sensei** est un outil conversationnel propulsé par IA qui t'aide à découvrir ton Ikigai — ce point d'intersection parfait entre ce que tu aimes, ce dans quoi tu es bon, ce pour quoi tu peux être payé, et ce dont le monde a besoin.

L'agent IA (via OpenRouter) te guide à travers une conversation progressive, détecte automatiquement les éléments pertinents, les classe dans les 4 cercles de l'Ikigai, et peut même effectuer des recherches web pour enrichir la discussion.

## Fonctionnalités

### ✅ Implémentées
- **Agent IA conversationnel** avec stratégie de découverte en 5 phases (Amorçage → Exploration → Classification → Challenge → Synthèse)
- **Diagramme interactif des 4 cercles** de l'Ikigai (SVG) avec visualisation en temps réel
- **Panneau de mémoire** affichant tous les éléments classés par catégorie
- **Détection automatique** des éléments par l'IA avec le format `[ELEMENT:categorie:confiance]`
- **Recherche web contextuelle** tous les 3 messages pour enrichir avec des tendances marché
- **Persistance D1** (SQLite) pour sauvegarder sessions, messages et éléments
- **Édition manuelle** des éléments (suppression, modification de catégorie)
- **Export JSON** des résultats de la session
- **Réinitialisation** de session
- **Progression visuelle** (barre de progression + badge de phase)
- **Quick replies** pour relancer la conversation

### 🚧 À venir
- Drag & drop des éléments entre les cercles
- Export PDF du diagramme final
- Suggestions d'Ikigai automatiques basées sur les intersections
- Mode multi-sessions (comparer/archiver des sessions)
- Support du mode vocal (Web Speech API)
- Analyse des sentiments sur les réponses

## Architecture

```
Ikigai Sensei
├── Frontend SPA (Vanilla JS + TailwindCSS)
│   ├── Chat interactif avec l'agent
│   ├── Diagramme SVG des 4 cercles
│   └── Panneau de mémoire classé par catégorie
│
├── Backend Hono (Cloudflare Workers)
│   ├── POST /api/chat        → Conversation avec l'agent IA
│   ├── GET  /api/session/:id → État complet de la session
│   ├── PUT  /api/elements/:id → Modifier un élément
│   ├── DELETE /api/elements/:id → Supprimer un élément
│   ├── POST /api/session/reset → Réinitialiser
│   └── GET  /api/session/:id/export → Export JSON
│
├── Agent IA (OpenRouter - Gemini 2.0 Flash)
│   ├── Prompt système spécialisé Ikigai
│   ├── Classification automatique [ELEMENT:...]
│   └── Recherche web contextuelle
│
└── Persistance (Cloudflare D1 - SQLite)
    ├── sessions
    ├── ikigai_elements
    ├── messages
    └── session_state
```

## URLs

- **Production** : [https://ikigai-sensei.pages.dev](https://ikigai-sensei.pages.dev)
- **API** : `/api/*`
- **Session** : Chaque utilisateur a un ID de session unique stocké en localStorage
- **Statut** : ✅ Déployé et opérationnel

## Guide d'utilisation

1. Lance la conversation : l'agent te pose une première question
2. Réponds naturellement, comme si tu parlais à un coach
3. L'IA détecte automatiquement les éléments et les place dans les cercles
4. Observe le diagramme se remplir en temps réel
5. L'agent te challenge et approfondit chaque cercle
6. Quand tous les cercles sont bien remplis, l'IA propose des pistes d'Ikigai

**Astuces :**
- Sois honnête et précis dans tes réponses
- Utilise les "quick replies" si tu es bloqué
- Tu peux supprimer manuellement des éléments dans le panneau mémoire
- Le bouton 🔄 réinitialise ta session

## Configuration

### Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `OPENROUTER_API_KEY` | Clé API OpenRouter (format `sk-or-v1-...`) |

### Déploiement local

```bash
# Installer les dépendances
npm install

# Appliquer les migrations D1
npm run db:migrate:local

# Configurer la clé API dans .dev.vars
echo "OPENROUTER_API_KEY=sk-or-v1-ta-cle" > .dev.vars

# Builder et lancer
npm run build
npm run dev:sandbox
```

### Déploiement Cloudflare Pages

```bash
# Créer la base D1
npx wrangler d1 create ikigai-sensei-production

# Ajouter database_id dans wrangler.jsonc

# Appliquer les migrations
npx wrangler d1 migrations apply ikigai-sensei-production --remote

# Configurer le secret OpenRouter
echo "sk-or-v1-ta-cle" | npx wrangler pages secret put OPENROUTER_API_KEY --project-name ikigai-sensei

# Déployer
npm run build && npx wrangler pages deploy dist --project-name ikigai-sensei
```

## Stack technique

- **Runtime** : Cloudflare Pages / Workers
- **Framework** : Hono v4
- **IA** : OpenRouter API (Gemini 2.0 Flash)
- **Base de données** : Cloudflare D1 (SQLite) — `ikigai-sensei-production`
- **Frontend** : Vanilla JS + TailwindCSS CDN
- **Build** : Vite + @hono/vite-build
- **Déploiement** : Wrangler

## Data Models

- **Session** : `{ id, name, status, created_at }`
- **IkigaiElement** : `{ id, session_id, content, category (passion|mission|vocation|profession), confidence, source, notes }`
- **Message** : `{ id, session_id, role, content, phase }`
- **SessionState** : `{ session_id, current_phase, completed_categories, interaction_count }`

---

*Ikigai Sensei · Inspiré de la philosophie japonaise · 生きがい先生*
