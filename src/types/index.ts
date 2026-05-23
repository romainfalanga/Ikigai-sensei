// ============================================================
// Types pour Ikigai Sensei V2
// Comptes utilisateurs + Mémoire arborescente (Graphe de Conscience)
// ============================================================

// ===== USER & AUTH =====
export interface User {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  created_at?: string;
  updated_at?: string;
  last_login_at?: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
}

// ===== MEMORY NODES (Nœuds de conscience) =====
export type NodeType =
  | 'concept'     // Une idée, un concept abstrait
  | 'project'     // Un projet concret réalisé ou en cours
  | 'experience'  // Une expérience vécue
  | 'skill'       // Une compétence spécifique
  | 'value'       // Une valeur personnelle
  | 'goal'        // Un objectif futur
  | 'fear'        // Une peur ou blocage
  | 'story'       // Une anecdote personnelle
  | 'insight';    // Une prise de conscience/révélation

export interface MemoryNode {
  id?: number;
  user_id: string;
  session_id?: string | null;

  // Contenu
  title: string;
  description?: string;
  content: NodeContent; // JSON riche

  // Classification Ikigai
  category: CategoryKey;
  confidence: number;
  source: 'user' | 'ai' | 'research' | 'system';

  // Arborescence
  parent_id?: number | null;
  depth: number;
  sort_order: number;

  // Statut
  is_expanded: number;  // SQLite boolean
  is_archived: number;  // SQLite boolean
  node_type: NodeType;

  created_at?: string;
  updated_at?: string;

  // Relations chargées (pas en DB)
  children?: MemoryNode[];
  relations?: MemoryRelation[];
  tags?: MemoryTag[];
}

// Métadonnées riches d'un nœud
export interface NodeContent {
  // Pour les compétences
  proficiency_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert' | 'master';
  years_experience?: number;
  tools_used?: string[];

  // Pour les projets
  project_url?: string;
  project_status?: 'idea' | 'in_progress' | 'completed' | 'abandoned';
  project_outcome?: string;

  // Pour les expériences
  experience_date?: string;
  experience_location?: string;
  emotional_impact?: 'low' | 'medium' | 'high' | 'transformative';

  // Pour les valeurs/goals
  priority?: number; // 1-10
  target_date?: string;
  progress_percent?: number;

  // Pour tous
  keywords?: string[];
  related_people?: string[];
  media_urls?: string[];

  // Pour les peurs/blocages
  intensity?: number; // 1-10
  is_overcome?: boolean;
  coping_strategy?: string;

  // Insights
  revelation_moment?: string;
  actionable_takeaway?: string;

  [key: string]: any;
}

// ===== RELATIONS =====
export type RelationType =
  | 'nourrit'              // A nourrit/cultive B
  | 'contraste_avec'       // A et B sont en tension
  | 'decoule_de'           // B découle de A
  | 'renforce'             // A renforce B mutuellement
  | 'contredit'            // A contredit B
  | 'inspire'              // A inspire B
  | 'collabore_avec'       // A et B peuvent collaborer
  | 'est_une_sous_partie_de'; // A est une sous-partie de B

export const RELATION_TYPES: Record<RelationType, { label: string; emoji: string; inverse: string }> = {
  nourrit:              { label: 'Nourrit',              emoji: '🌱', inverse: 'Est nourri par' },
  contraste_avec:       { label: 'Contraste avec',       emoji: '⚡', inverse: 'Contraste avec' },
  decoule_de:           { label: 'Découle de',           emoji: '🔄', inverse: 'Est la source de' },
  renforce:             { label: 'Renforce',             emoji: '💪', inverse: 'Est renforcé par' },
  contredit:            { label: 'Contredit',            emoji: '⚠️', inverse: 'Est contredit par' },
  inspire:              { label: 'Inspire',              emoji: '💡', inverse: 'Est inspiré par' },
  collabore_avec:       { label: 'Collabore avec',       emoji: '🤝', inverse: 'Collabore avec' },
  est_une_sous_partie_de: { label: 'Sous-partie de',     emoji: '🧩', inverse: 'Contient' },
};

export interface MemoryRelation {
  id?: number;
  user_id: string;
  source_node_id: number;
  target_node_id: number;
  relation_type: RelationType;
  strength: number;
  description?: string;
  source: 'user' | 'ai' | 'system';
  created_at?: string;

  // Jointure (pas en DB)
  source_node?: MemoryNode;
  target_node?: MemoryNode;
}

// ===== TAGS =====
export interface MemoryTag {
  id?: number;
  user_id: string;
  name: string;
  color: string;
}

// ===== Categories (unchanged) =====
export type CategoryKey = 'passion' | 'mission' | 'vocation' | 'profession';

export const IKIGAI_CATEGORIES = {
  passion: {
    id: 'passion', label: 'Ce que tu aimes', emoji: '❤️',
    color: '#E74C3C', bgColor: '#FDEDEC', borderColor: '#E74C3C',
    description: 'Tes passions, ce qui te fait vibrer',
  },
  mission: {
    id: 'mission', label: 'Ce dont le monde a besoin', emoji: '🌍',
    color: '#2ECC71', bgColor: '#E8F8F5', borderColor: '#2ECC71',
    description: 'Les besoins auxquels tu peux répondre',
  },
  vocation: {
    id: 'vocation', label: 'Ce pour quoi tu peux être payé', emoji: '💰',
    color: '#F39C12', bgColor: '#FEF5E7', borderColor: '#F39C12',
    description: 'Ce qui a de la valeur sur le marché',
  },
  profession: {
    id: 'profession', label: 'Ce dans quoi tu es bon', emoji: '🎯',
    color: '#3498DB', bgColor: '#EBF5FB', borderColor: '#3498DB',
    description: 'Tes compétences et talents',
  },
} as const;

// ===== SESSION (updated for V2) =====
export interface Session {
  id: string;
  user_id?: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface SessionState {
  session_id: string;
  current_phase: PhaseType;
  completed_categories: string[];
  interaction_count: number;
  last_web_search?: string;
  focused_node_id?: number;
  graph_context?: string;
}

export interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  phase?: string;
  created_at?: string;
}

export type PhaseType =
  | 'amorcage'
  | 'exploration_passion' | 'exploration_mission'
  | 'exploration_vocation' | 'exploration_profession'
  | 'classification' | 'challenge' | 'synthese' | 'complete';

// ===== API RESPONSES =====
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ChatResponse {
  message: Message;
  detected_nodes: MemoryNode[];
  new_relations: MemoryRelation[];
  current_phase: PhaseType;
  phase_progress: number;
  web_search_used?: boolean;
}

export interface SessionFullState {
  session: Session;
  state: SessionState;
  memory_tree: MemoryNode[];
  recentMessages: Message[];
}

export interface MemoryExport {
  user: User;
  tree: MemoryNode[];
  relations: MemoryRelation[];
  tags: MemoryTag[];
  sessions: Session[];
  exported_at: string;
}

// ===== BINDINGS =====
export interface Bindings {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
  JWT_SECRET: string;
}
