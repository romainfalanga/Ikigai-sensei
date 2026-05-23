// Types pour l'application Ikigai

export interface IkigaiElement {
  id?: number;
  session_id: string;
  content: string;
  category: 'passion' | 'mission' | 'vocation' | 'profession';
  confidence: number;
  source: 'user' | 'ai' | 'research';
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id?: number;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  phase?: string;
  created_at?: string;
}

export interface SessionState {
  session_id: string;
  current_phase: PhaseType;
  completed_categories: string[];
  interaction_count: number;
  last_web_search?: string;
}

export interface Session {
  id: string;
  name: string;
  status: 'active' | 'completed' | 'archived';
  created_at?: string;
  updated_at?: string;
}

// Phases de l'agent
export type PhaseType =
  | 'amorcage'
  | 'exploration_passion'
  | 'exploration_mission'
  | 'exploration_vocation'
  | 'exploration_profession'
  | 'classification'
  | 'challenge'
  | 'synthese'
  | 'complete';

// Catégories de l'Ikigai
export const IKIGAI_CATEGORIES = {
  passion: {
    id: 'passion',
    label: 'Ce que tu aimes',
    emoji: '❤️',
    color: '#E74C3C',
    bgColor: '#FDEDEC',
    borderColor: '#E74C3C',
    description: 'Tes passions, ce qui te fait vibrer',
  },
  mission: {
    id: 'mission',
    label: 'Ce dont le monde a besoin',
    emoji: '🌍',
    color: '#2ECC71',
    bgColor: '#E8F8F5',
    borderColor: '#2ECC71',
    description: 'Les besoins auxquels tu peux répondre',
  },
  vocation: {
    id: 'vocation',
    label: 'Ce pour quoi tu peux être payé',
    emoji: '💰',
    color: '#F39C12',
    bgColor: '#FEF5E7',
    borderColor: '#F39C12',
    description: 'Ce qui a de la valeur sur le marché',
  },
  profession: {
    id: 'profession',
    label: 'Ce dans quoi tu es bon',
    emoji: '🎯',
    color: '#3498DB',
    bgColor: '#EBF5FB',
    borderColor: '#3498DB',
    description: 'Tes compétences et talents',
  },
} as const;

export type CategoryKey = keyof typeof IKIGAI_CATEGORIES;

// Intersections de l'Ikigai
export const IKIGAI_INTERSECTIONS = {
  passion_mission: { label: 'Ce qui te passionne et sert le monde', categories: ['passion', 'mission'] },
  passion_profession: { label: 'Ce que tu aimes et dans quoi tu excelles', categories: ['passion', 'profession'] },
  mission_vocation: { label: 'Ce dont le monde a besoin et qui paie', categories: ['mission', 'vocation'] },
  vocation_profession: { label: 'Ce qui paie et dans quoi tu es bon', categories: ['vocation', 'profession'] },
  ikigai: { label: '✨ IKIGAI ✨', categories: ['passion', 'mission', 'vocation', 'profession'] },
} as const;

// Réponse API standard
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// Réponse du chat
export interface ChatResponse {
  message: Message;
  detected_elements: IkigaiElement[];
  current_phase: PhaseType;
  phase_progress: number; // 0-100
  suggested_next?: string;
}

// État complet de la session pour le frontend
export interface SessionFullState {
  session: Session;
  state: SessionState;
  elements: IkigaiElement[];
  recent_messages: Message[];
}

// Configuration de l'agent
export interface AgentConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt: string;
}

// Bindings Cloudflare
export interface Bindings {
  DB: D1Database;
  OPENROUTER_API_KEY: string;
}
