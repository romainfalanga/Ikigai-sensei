-- Migration V2 : Comptes utilisateurs + Mémoire arborescente (Graphe de Conscience)
-- Cette migration complexifie massivement le système de mémoire

-- ============================================================
-- TABLE: users - Comptes utilisateurs
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- UUID
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT 'Explorateur',
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================================
-- TABLE: memory_nodes - Nœuds de la mémoire arborescente
-- C'est le cœur du nouveau système. Chaque élément découvert
-- devient un nœud dans un graphe de connaissance personnel.
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_nodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  session_id TEXT, -- peut être NULL si créé hors session

  -- Contenu
  title TEXT NOT NULL,          -- Titre court (ex: "Design graphique")
  description TEXT,              -- Description détaillée
  content JSON DEFAULT '{}',    -- Métadonnées riches (voir ci-dessous)

  -- Classification Ikigai
  category TEXT NOT NULL,       -- passion, mission, vocation, profession
  confidence REAL DEFAULT 0.5, -- 0.0 à 1.0
  source TEXT DEFAULT 'ai',     -- user, ai, research, system

  -- Arborescence
  parent_id INTEGER,            -- ID du nœud parent (NULL = racine)
  depth INTEGER DEFAULT 0,     -- Profondeur dans l'arbre
  sort_order INTEGER DEFAULT 0, -- Ordre d'affichage parmi les siblings

  -- Statut
  is_expanded INTEGER DEFAULT 1, -- Pour l'UI : déplié par défaut
  is_archived INTEGER DEFAULT 0, -- Soft delete
  node_type TEXT DEFAULT 'concept', -- concept, project, experience, skill, value, goal, fear

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES memory_nodes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_user ON memory_nodes(user_id);
CREATE INDEX IF NOT EXISTS idx_nodes_parent ON memory_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_nodes_category ON memory_nodes(user_id, category);
CREATE INDEX IF NOT EXISTS idx_nodes_session ON memory_nodes(session_id);

-- ============================================================
-- TABLE: memory_relations - Connexions entre nœuds
-- Permet de créer des liens typés entre n'importe quels nœuds,
-- même de catégories différentes.
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_relations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  source_node_id INTEGER NOT NULL,
  target_node_id INTEGER NOT NULL,

  -- Type de relation
  relation_type TEXT NOT NULL, -- nourrit, contraste_avec, decoule_de, renforce, contredit, inspire, collabore_avec, est_une_sous_partie_de

  -- Métadonnées de la relation
  strength REAL DEFAULT 0.5,   -- 0.0 à 1.0, force de la connexion
  description TEXT,             -- Pourquoi cette connexion existe
  source TEXT DEFAULT 'ai',    -- user, ai, system

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (source_node_id) REFERENCES memory_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (target_node_id) REFERENCES memory_nodes(id) ON DELETE CASCADE,

  -- Une seule relation de même type entre deux nœuds
  UNIQUE(source_node_id, target_node_id, relation_type),
  -- Éviter les auto-références
  CHECK(source_node_id != target_node_id)
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON memory_relations(source_node_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON memory_relations(target_node_id);
CREATE INDEX IF NOT EXISTS idx_relations_user ON memory_relations(user_id);

-- ============================================================
-- TABLE: memory_tags - Tags pour catégoriser les nœuds
-- Permet un tagging libre au-delà des 4 catégories Ikigai
-- ============================================================
CREATE TABLE IF NOT EXISTS memory_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,           -- Nom du tag (ex: "tech", "social", "remote")
  color TEXT DEFAULT '#6366F1', -- Couleur du tag

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, name)
);

-- Table de liaison nœuds <-> tags
CREATE TABLE IF NOT EXISTS memory_node_tags (
  node_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (node_id, tag_id),
  FOREIGN KEY (node_id) REFERENCES memory_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES memory_tags(id) ON DELETE CASCADE
);

-- ============================================================
-- MISE À JOUR: sessions - Ajout user_id
-- ============================================================
-- On recrée la table sessions pour ajouter user_id
-- Note: les données existantes seront perdues (migration destructive pour sessions)

-- Sauvegarde temporaire des sessions (optionnel, dépend du contexte)
ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id);

-- ============================================================
-- MISE À JOUR: session_state - Ajout champ pour le graphe
-- ============================================================
-- On garde la table existante mais on ajoute des champs liés au graphe
ALTER TABLE session_state ADD COLUMN focused_node_id INTEGER REFERENCES memory_nodes(id);
ALTER TABLE session_state ADD COLUMN graph_context TEXT; -- JSON: contexte du graphe pour l'IA

-- ============================================================
-- VUES UTILES
-- ============================================================

-- Vue: Arbre complet d'un utilisateur
CREATE VIEW IF NOT EXISTS v_memory_tree AS
WITH RECURSIVE tree AS (
  -- Racines (pas de parent)
  SELECT id, title, description, category, confidence, parent_id, depth, node_type,
         title as path, 0 as level
  FROM memory_nodes
  WHERE parent_id IS NULL AND is_archived = 0

  UNION ALL

  -- Enfants
  SELECT n.id, n.title, n.description, n.category, n.confidence, n.parent_id, n.depth, n.node_type,
         t.path || ' > ' || n.title, t.level + 1
  FROM memory_nodes n
  JOIN tree t ON n.parent_id = t.id
  WHERE n.is_archived = 0
)
SELECT * FROM tree;

-- Vue: Résumé des connexions
CREATE VIEW IF NOT EXISTS v_memory_graph_summary AS
SELECT
  n.user_id,
  n.category,
  COUNT(DISTINCT n.id) as node_count,
  COUNT(DISTINCT r.id) as relation_count,
  AVG(n.confidence) as avg_confidence
FROM memory_nodes n
LEFT JOIN memory_relations r ON (r.source_node_id = n.id OR r.target_node_id = n.id)
WHERE n.is_archived = 0
GROUP BY n.user_id, n.category;

-- ============================================================
-- TYPES DE RELATIONS (documentation)
-- ============================================================
-- nourrit: A nourrit/cultive B (ex: "La curiosité nourrit l'apprentissage")
-- contraste_avec: A et B sont en tension (ex: "Sécurité vs Aventure")
-- decoule_de: B découle de A (ex: "Leadership découle de Communication")
-- renforce: A renforce B mutuellement
-- contredit: A contredit B (tension/dilemme)
-- inspire: A inspire B
-- collabore_avec: A et B peuvent collaborer
-- est_une_sous_partie_de: B est une sous-partie de A
