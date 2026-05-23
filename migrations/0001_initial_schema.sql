-- Ikigai Agent: Schema initial
-- Tables pour la persistance des sessions et de la mémoire

-- Sessions utilisateur (une par utilisateur/navigateur)
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  name TEXT DEFAULT 'Explorateur',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' -- active, completed, archived
);

-- Éléments de l'Ikigai (chaque élément découvert)
CREATE TABLE IF NOT EXISTS ikigai_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL, -- passion, mission, vocation, profession
  confidence REAL DEFAULT 0.5, -- 0.0 à 1.0, niveau de confiance de l'IA
  source TEXT DEFAULT 'user', -- user, ai, research
  notes TEXT, -- notes additionnelles de l'IA
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Historique des messages de la conversation
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- user, assistant, system
  content TEXT NOT NULL,
  phase TEXT, -- amorcage, exploration_passion, exploration_mission, etc.
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- État de la session (quelle phase, quels cercles sont les plus remplis, etc.)
CREATE TABLE IF NOT EXISTS session_state (
  session_id TEXT PRIMARY KEY,
  current_phase TEXT DEFAULT 'amorcage',
  completed_categories TEXT DEFAULT '[]', -- JSON array: ["passion", "mission"]
  interaction_count INTEGER DEFAULT 0,
  last_web_search TEXT, -- dernière recherche web effectuée
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- Index
CREATE INDEX IF NOT EXISTS idx_elements_session ON ikigai_elements(session_id);
CREATE INDEX IF NOT EXISTS idx_elements_category ON ikigai_elements(session_id, category);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
