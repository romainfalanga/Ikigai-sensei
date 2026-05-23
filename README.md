# Ikigai Sensei V2.1 — Découvre ta raison d'être

## Présentation

**Ikigai Sensei** est un coach IA conversationnel qui t'aide à découvrir ton Ikigai — l'intersection parfaite entre ce que tu aimes, ce dans quoi tu es bon, ce pour quoi tu peux être payé, et ce dont le monde a besoin.

La V2.1 introduit une **mémoire arborescente complexe** (Graphe de Conscience), un système de comptes utilisateurs, et un moteur d'analyse IA capable de générer des insights, clusters et détecter des tensions créatives.

## ✅ Fonctionnalités V2.1

### 🔐 Authentification
- **Création de compte** avec email/mot de passe (hashé SHA-256)
- **Login/Logout** avec JWT natif (Web Crypto API)
- **Session persistante** via cookies HttpOnly (7 jours)
- **Données utilisateur persistantes** dans D1

### 🧠 Mémoire Arborescente (Graphe de Conscience)
- **9 types de nœuds** : concept, skill, experience, project, value, goal, fear, story, insight
- **Arborescence profonde** : hiérarchie parent/enfant illimitée
- **NodeContent riche** : niveau de compétence, statut projet, impact émotionnel, priorité, mots-clés...
- **8 types de relations** : nourrit, contraste_avec, decoule_de, renforce, contredit, inspire, collabore_avec, est_une_sous_partie_de
- **Tags libres** pour catégorisation transversale
- **Export JSON** complet de la mémoire

### 🤖 Agent IA Enrichi
- **Prompt système V2** : détection automatique de nœuds [NODE:...], relations [RELATION:...], clusters [CLUSTER:...]
- **Contexte mémoire complet** envoyé à l'IA : arbre entier + NodeContent détaillé + relations
- **Recherche web contextuelle** pour enrichir avec des tendances marché
- **9 phases de découverte** : Amorçage → 4 explorations → Classification → Challenge → Synthèse → Complete

### 💡 Insights & Clustering
- **POST /api/insight/generate** : analyse complète de la carte de conscience
- Détection de **clusters thématiques** (groupes de 3+ nœuds)
- Identification de **tensions créatives** (dilemmes productifs)
- Génération de **révélations** (insights personnalisés)
- Suggestions de **prochaines étapes** concrètes

### 🎨 Interface Utilisateur
- **Login/Register** avec design immersif
- **3 tabs** : Chat | Explorateur Mémoire | Insights
- **Diagramme SVG interactif** des 4 cercles avec relations visibles
- **Explorateur arborescent** avec expand/collapse, filtres par catégorie et type
- **Détail de nœud** avec métadonnées et connexions
- **Barre de stats** en temps réel (nœuds par cercle)
- **Sidebar utilisateur** avec déconnexion

## 🏗 Architecture

```
Ikigai Sensei V2.1
├── Frontend SPA : Vanilla JS + TailwindCSS CDN
│   ├── Login/Register (email + password)
│   ├── Chat conversationnel avec IA
│   ├── Explorateur mémoire arborescent
│   ├── Panneau Insights (clusters, tensions, révélations)
│   └── Diagramme Ikigai SVG interactif
│
├── Backend Hono (Cloudflare Workers)
│   ├── /api/auth/*           → Auth (register, login, logout, me)
│   ├── /api/chat             → Conversation avec agent IA
│   ├── /api/memory/*         → CRUD nœuds, relations, tags, export
│   ├── /api/insight/generate → Analyse IA de la mémoire
│   └── /api/session/*        → Gestion sessions
│
├── Agent IA (OpenRouter - Gemini 2.0 Flash)
│   ├── Prompt système V2 enrichi (phases, clusters, relations)
│   ├── Parsing [NODE:...], [RELATION:...], [CLUSTER:...], [INSIGHT:...]
│   ├── Contexte mémoire complet (arbre + NodeContent + relations)
│   └── Recherche web contextuelle
│
├── Persistance (Cloudflare D1 - SQLite)
│   ├── users + password_hash
│   ├── memory_nodes (arborescence)
│   ├── memory_relations (connexions typées)
│   ├── memory_tags + memory_node_tags
│   ├── sessions + session_state
│   ├── messages (historique)
│   └── vues: v_memory_tree, v_memory_graph_summary
```

## 📡 API Routes

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| POST | `/api/auth/register` | Non | Créer un compte |
| POST | `/api/auth/login` | Non | Se connecter |
| POST | `/api/auth/logout` | Non | Se déconnecter |
| GET | `/api/auth/me` | Oui | Profil utilisateur |
| POST | `/api/chat` | Oui | Envoyer un message à l'IA |
| GET | `/api/session/:id` | Oui | État complet session |
| POST | `/api/session/reset` | Oui | Réinitialiser session |
| GET | `/api/memory/tree` | Oui | Arbre mémoire complet |
| GET | `/api/memory/nodes` | Oui | Nœuds (filtrable) |
| GET | `/api/memory/nodes/:id` | Oui | Détail nœud + relations |
| POST | `/api/memory/nodes` | Oui | Créer un nœud |
| PUT | `/api/memory/nodes/:id` | Oui | Modifier un nœud |
| DELETE | `/api/memory/nodes/:id` | Oui | Supprimer (soft) |
| POST | `/api/memory/relations` | Oui | Créer une relation |
| DELETE | `/api/memory/relations/:id` | Oui | Supprimer une relation |
| GET | `/api/memory/tags` | Oui | Lister les tags |
| POST | `/api/memory/nodes/:id/tags` | Oui | Tagger un nœud |
| GET | `/api/memory/stats` | Oui | Statistiques mémoire |
| GET | `/api/memory/export` | Oui | Export JSON complet |
| POST | `/api/insight/generate` | Oui | Générer analyse IA |

## 🚀 URLs

- **Production** : `https://ikigai-sensei.pages.dev`
- **Statut** : ✅ Déployé

## ⚙️ Configuration

### .dev.vars (local)
```
OPENROUTER_API_KEY=sk-or-v1-...
JWT_SECRET=ikigai-sensei-dev-secret-key-2026
```

### Secrets Cloudflare (production)
```bash
npx wrangler pages secret put OPENROUTER_API_KEY --project-name ikigai-sensei
npx wrangler pages secret put JWT_SECRET --project-name ikigai-sensei
```

## 🛠️ Développement local

```bash
npm install
npm run build
npx wrangler d1 migrations apply ikigai-sensei-production --local
npm run dev:sandbox  # wrangler pages dev dist --d1=ikigai-sensei-production --local --ip 0.0.0.0 --port 3000
```

## 📊 Data Models

### MemoryNode
- `id, user_id, title, description, content (JSON riche), category (passion|mission|vocation|profession), confidence, source, parent_id, depth, sort_order, is_expanded, is_archived, node_type (9 types)`

### MemoryRelation
- `id, user_id, source_node_id, target_node_id, relation_type (8 types), strength, description, source`

### MemoryTag / NodeContent — voir `src/types/index.ts`

## 🔮 Prochaines étapes
- Dashboard analytics (graphique d'évolution de la mémoire)
- Mode vocal (Web Speech API)
- Partage de carte de conscience (lien public)
- Export PDF du diagramme Ikigai
- Intégration Calendly/Notion pour les actions concrètes

---
*Ikigai Sensei V2.1 · Inspiré de la philosophie japonaise · 生きがい先生*
