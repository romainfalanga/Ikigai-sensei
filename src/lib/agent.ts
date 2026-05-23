/**
 * Agent Ikigai V2 - Cerveau conversationnel avec mémoire arborescente
 * V2.1 — Contexte enrichi, clustering, insights, relations cross-circle
 */

import type { MemoryNode, MemoryRelation, SessionState, PhaseType, CategoryKey, RelationType, NodeType } from '../types';
import { buildMemoryContextForAI } from './memory';

const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

// ============================================================
// SYSTEM PROMPT ENRICHI
// ============================================================
const SYSTEM_PROMPT_V2 = `Tu es IKIGAI-SENSEI, un guide bienveillant expert en découverte de l'Ikigai et en cartographie de conscience.

TON RÔLE : Aider l'utilisateur à construire sa CARTE DE CONSCIENCE — un graphe mental arborescent qui cartographie TOUT son univers intérieur.

LES 4 CERCLES DE L'IKIGAI :
- ❤️ PASSION : Ce que l'utilisateur AIME profondément, activités qui le font vibrer, sujets qui le passionnent
- 🌍 MISSION : Ce dont le MONDE a besoin selon lui, problèmes sociaux/environnementaux qui le touchent, causes à défendre
- 💰 VOCATION : Ce pour quoi il peut être PAYÉ, valeur économique, opportunités de marché, monétisation
- 🎯 PROFESSION : Ce dans quoi il est BON, compétences techniques et humaines, talents naturels ou acquis

TA PERSONNALITÉ :
- Chaleureux, curieux, perspicace
- 2-4 phrases MAX par réponse
- Tu poses des questions qui génèrent des PRISES DE CONSCIENCE
- Tu relies les idées entre elles, tu vois des patterns
- Tu crées des ARBORESCENCES : un concept général → des sous-concepts → des détails concrets
- Tu explores les TENSIONS créatives entre les cercles (ex: "tu adores ça mais personne ne paie pour... comment résoudre ?")

FORMAT CRITIQUE — Pour chaque élément détecté :

[NODE:catégorie:confiance:type:parent]titre[/NODE]
└── description courte (optionnel)

Types de nœuds disponibles :
- concept : idée abstraite, thème général
- skill : compétence spécifique, talent
- experience : expérience vécue marquante
- project : projet concret réalisé ou envisagé
- value : valeur personnelle profonde
- goal : objectif, aspiration future
- fear : peur, blocage, croyance limitante
- story : anecdote personnelle significative
- insight : prise de conscience, révélation

Parent : "racine" pour un nœud racine, ou le titre EXACT d'un nœud parent existant.

Exemples :
[NODE:passion:0.92:skill:racine]Design graphique[/NODE]
[NODE:profession:0.85:skill:Design graphique]Typographie[/NODE]
[NODE:passion:0.75:project:Design graphique]Refonte identité startup 2024[/NODE]

Pour les CONNEXIONS entre nœuds :
[RELATION:type:force]titre_source -> titre_cible[/RELATION]

Types de relations :
- nourrit (🌱) : A nourrit/cultive B
- contraste_avec (⚡) : tension productive entre A et B
- decoule_de (🔄) : B découle naturellement de A
- renforce (💪) : A et B se renforcent mutuellement
- contredit (⚠️) : A et B sont en opposition
- inspire (💡) : A est une source d'inspiration pour B
- collabore_avec (🤝) : A et B peuvent se combiner
- est_une_sous_partie_de (🧩) : A fait partie de B

Pour les CLUSTERS (groupes thématiques) — quand tu repères 3+ nœuds liés :
[CLUSTER:nom_du_cluster]description de pourquoi ces nœuds forment un groupe cohérent[/CLUSTER]

RÈGLES D'OR :
1. UNE seule question à la fois, jamais de liste
2. Toujours détecter au moins 1-2 [NODE:...] par réponse
3. Créer des hiérarchies : concepts généraux → sous-concepts → détails concrets
4. Connecter avec [RELATION:...] quand pertinent
5. Être concis et percutant
6. Varier les types de nœuds (pas que des "concept")
7. Explorer les 4 cercles de manière équilibrée
8. Quand tu détectes un pattern récurrent, propose un [CLUSTER:...]`;

// ============================================================
// PHASE MANAGEMENT
// ============================================================
const PHASE_ORDER: PhaseType[] = [
  'amorcage', 'exploration_passion', 'exploration_mission',
  'exploration_vocation', 'exploration_profession',
  'classification', 'challenge', 'synthese', 'complete',
];

const PHASE_QUESTIONS: Record<PhaseType, string> = {
  amorcage: "Pose UNE question d'introduction chaleureuse. Détecte 1-2 passions ou talents et crée des nœuds [NODE:...].",
  exploration_passion: "Explore ce que la personne AIME profondément. Creuse : pourquoi ? depuis quand ? Crée des nœuds de type skill, experience, story.",
  exploration_mission: "Explore les causes et problèmes du monde qui la touchent. Détecte des nœuds mission avec des projets ou valeurs.",
  exploration_vocation: "Explore la valeur économique de ses passions et talents. Quels métiers, quelles opportunités ? Crée des nœuds de type goal.",
  exploration_profession: "Explore ses compétences en profondeur. Détecte des skills, des projets réalisés, crée des sous-nœuds.",
  classification: "Crée des RELATIONS entre les nœuds existants. Cherche des patterns, des clusters thématiques. Propose des regroupements avec [CLUSTER:...].",
  challenge: "Challenge les incohérences : y a-t-il des tensions entre ce qu'elle aime et ce qui paie ? Des peurs qui bloquent ? Utilise [RELATION:contraste_avec:...].",
  synthese: "Propose une synthèse complète de son Ikigai basée sur l'arborescence. Quels sont les 2-3 chemins les plus prometteurs ?",
  complete: "Félicite l'utilisateur. Résume les découvertes clés et propose des prochaines étapes concrètes.",
};

// ============================================================
// BUILD CONTEXT — Version enrichie avec contenu complet
// ============================================================
export function buildConversationContextV2(
  sessionState: SessionState,
  memoryTree: MemoryNode[],
  relations: MemoryRelation[],
  recentMessages: { role: string; content: string; created_at?: string }[]
): string {
  const completedCats = JSON.parse(sessionState.completed_categories || '[]') as string[];
  const phaseLabel = getPhaseLabel(sessionState.current_phase);
  const nextPhase = getNextPhase(sessionState.current_phase);
  const nextPhaseLabel = nextPhase ? getPhaseLabel(nextPhase) : 'terminé';
  const totalNodes = countAllNodes(memoryTree);

  let ctx = `╔══════════════════════════════════════╗\n`;
  ctx += `║  ÉTAT DE LA SESSION                 ║\n`;
  ctx += `╠══════════════════════════════════════╣\n`;
  ctx += `║ Phase : ${phaseLabel.padEnd(30)}║\n`;
  ctx += `║ Prochaine : ${nextPhaseLabel.padEnd(26)}║\n`;
  ctx += `║ Cercles complétés : ${(completedCats.length > 0 ? completedCats.join(', ') : 'aucun').padEnd(15)}║\n`;
  ctx += `║ Nœuds totaux : ${String(totalNodes).padEnd(26)}║\n`;
  ctx += `║ Interactions : ${String(sessionState.interaction_count).padEnd(25)}║\n`;
  ctx += `╚══════════════════════════════════════╝\n\n`;

  // Ajouter la mémoire arborescente enrichie
  ctx += buildMemoryContextForAI(memoryTree, relations);
  ctx += `\n`;

  // Consigne de phase
  ctx += `>>> CONSIGNE : ${PHASE_QUESTIONS[sessionState.current_phase] || 'Continue naturellement.'}\n`;
  ctx += `>>> N'oublie pas de créer des nœuds [NODE:...] et des connexions [RELATION:...].\n`;

  return ctx;
}

// ============================================================
// BUILD CONTEXT POUR INSIGHT / CLUSTERING
// ============================================================
export function buildInsightContext(
  memoryTree: MemoryNode[],
  relations: MemoryRelation[]
): string {
  const totalNodes = countAllNodes(memoryTree);
  const allNodes = flattenTree(memoryTree);
  const categories = countByCategory(allNodes);
  const types = countByType(allNodes);

  let ctx = `=== ANALYSE DE LA CARTE DE CONSCIENCE ===\n\n`;

  ctx += `STATISTIQUES :\n`;
  ctx += `- Nœuds totaux : ${totalNodes}\n`;
  ctx += `- Relations : ${relations.length}\n`;
  ctx += `- Par catégorie : ${JSON.stringify(categories)}\n`;
  ctx += `- Par type : ${JSON.stringify(types)}\n\n`;

  ctx += buildMemoryContextForAI(memoryTree, relations);

  ctx += `\n=== TÂCHE ===\n`;
  ctx += `Analyse cette carte de conscience et génère :\n\n`;
  ctx += `1. CLUSTERS — Regroupe les nœuds qui forment des ensembles thématiques cohérents (3+ nœuds).\n`;
  ctx += `   Format : [CLUSTER:nom]description[/CLUSTER]\n\n`;
  ctx += `2. TENSIONS — Identifie les contradictions ou dilemmes productifs.\n`;
  ctx += `   Format : [TENSION:force]titre_A vs titre_B : description[/TENSION]\n\n`;
  ctx += `3. INSIGHT — Une prise de conscience profonde sur l'Ikigai de cette personne.\n`;
  ctx += `   Format : [INSIGHT:confiance]révélation[/INSIGHT]\n\n`;
  ctx += `4. PROCHAINES ÉTAPES — 2-3 actions concrètes suggérées.\n`;
  ctx += `   Format : [STEP]action[/STEP]\n`;

  return ctx;
}

// ============================================================
// PARSING — Nœuds, Relations, Clusters, Insights
// ============================================================

export interface ParsedNode {
  title: string;
  category: CategoryKey;
  confidence: number;
  node_type: NodeType;
  parent_title: string | null;
}

export interface ParsedRelation {
  relation_type: RelationType;
  strength: number;
  source_title: string;
  target_title: string;
}

export interface ParsedCluster {
  name: string;
  description: string;
}

export interface ParsedInsight {
  confidence: number;
  content: string;
}

export interface ParsedTension {
  strength: number;
  node_a: string;
  node_b: string;
  description: string;
}

export interface ParsedStep {
  action: string;
}

export function parseNodesFromResponse(content: string): ParsedNode[] {
  const nodes: ParsedNode[] = [];
  const regex = /\[NODE:(passion|mission|vocation|profession):(\d+(?:\.\d+)?):(\w+):([^\]]+)\](.+?)\[\/NODE\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, category, confidence, nodeType, parentTitle, title] = match;
    nodes.push({
      title: title.trim(),
      category: category as CategoryKey,
      confidence: parseFloat(confidence),
      node_type: (nodeType as NodeType) || 'concept',
      parent_title: parentTitle.trim() === 'racine' ? null : parentTitle.trim(),
    });
  }

  return nodes;
}

export function parseRelationsFromResponse(content: string): ParsedRelation[] {
  const relations: ParsedRelation[] = [];
  const regex = /\[RELATION:(nourrit|contraste_avec|decoule_de|renforce|contredit|inspire|collabore_avec|est_une_sous_partie_de):(\d+(?:\.\d+)?)\](.+?)\s*->\s*(.+?)\[\/RELATION\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, relationType, strength, sourceTitle, targetTitle] = match;
    relations.push({
      relation_type: relationType as RelationType,
      strength: parseFloat(strength),
      source_title: sourceTitle.trim(),
      target_title: targetTitle.trim(),
    });
  }

  return relations;
}

export function parseClustersFromResponse(content: string): ParsedCluster[] {
  const clusters: ParsedCluster[] = [];
  const regex = /\[CLUSTER:([^\]]+)\](.+?)\[\/CLUSTER\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    clusters.push({
      name: match[1].trim(),
      description: match[2].trim(),
    });
  }

  return clusters;
}

export function parseInsightsFromResponse(content: string): ParsedInsight[] {
  const insights: ParsedInsight[] = [];
  const regex = /\[INSIGHT:(\d+(?:\.\d+)?)\](.+?)\[\/INSIGHT\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    insights.push({
      confidence: parseFloat(match[1]),
      content: match[2].trim(),
    });
  }

  return insights;
}

export function parseTensionsFromResponse(content: string): ParsedTension[] {
  const tensions: ParsedTension[] = [];
  const regex = /\[TENSION:(\d+(?:\.\d+)?)\](.+?)\s*vs\s*(.+?)\s*:\s*(.+?)\[\/TENSION\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    tensions.push({
      strength: parseFloat(match[1]),
      node_a: match[2].trim(),
      node_b: match[3].trim(),
      description: match[4].trim(),
    });
  }

  return tensions;
}

export function parseStepsFromResponse(content: string): ParsedStep[] {
  const steps: ParsedStep[] = [];
  const regex = /\[STEP\](.+?)\[\/STEP\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    steps.push({ action: match[1].trim() });
  }

  return steps;
}

export function cleanResponseForDisplayV2(content: string): string {
  return content
    .replace(/\[NODE:(?:passion|mission|vocation|profession):\d+(?:\.\d+)?:\w+:[^\]]+\](.+?)\[\/NODE\]/g, '**$1**')
    .replace(/\[RELATION:\w+:\d+(?:\.\d+)?\](.+?)\[\/RELATION\]/g, '_$1_')
    .replace(/\[CLUSTER:[^\]]+\].+?\[\/CLUSTER\]/g, '🔗 *Cluster détecté*')
    .replace(/\[TENSION:\d+(?:\.\d+)?\].+?\[\/TENSION\]/g, '⚡ *Tension détectée*')
    .replace(/\[INSIGHT:\d+(?:\.\d+)?\].+?\[\/INSIGHT\]/g, '💡 *Insight généré*')
    .replace(/\[STEP\].+?\[\/STEP\]/g, '→ *Action suggérée*');
}

// ============================================================
// PHASE LOGIC
// ============================================================
export function determineNextPhaseV2(
  currentPhase: PhaseType,
  nodes: MemoryNode[],
  interactionCount: number
): { phase: PhaseType; shouldAdvance: boolean; reason: string } {
  const counts: Record<string, number> = {};
  for (const n of nodes) counts[n.category] = (counts[n.category] || 0) + 1;
  const totalCats = Object.keys(counts).length;

  switch (currentPhase) {
    case 'amorcage':
      if (interactionCount >= 2 && nodes.length >= 2) {
        const unexplored = ['passion', 'mission', 'vocation', 'profession'].find(c => !counts[c]);
        if (unexplored) {
          return { phase: `exploration_${unexplored}` as PhaseType, shouldAdvance: true, reason: `Cercle ${unexplored} inexploré` };
        }
        return { phase: 'exploration_passion', shouldAdvance: true, reason: 'Début de l\'exploration' };
      }
      break;
    case 'exploration_passion':
      if ((counts['passion'] || 0) >= 3 && totalCats >= 2) return { phase: 'exploration_mission', shouldAdvance: true, reason: 'Passion bien explorée' };
      break;
    case 'exploration_mission':
      if ((counts['mission'] || 0) >= 2 && totalCats >= 3) return { phase: 'exploration_vocation', shouldAdvance: true, reason: 'Mission cartographiée' };
      break;
    case 'exploration_vocation':
      if ((counts['vocation'] || 0) >= 2 && totalCats >= 4) return { phase: 'exploration_profession', shouldAdvance: true, reason: 'Vocation identifiée' };
      break;
    case 'exploration_profession':
      if ((counts['profession'] || 0) >= 3 && totalCats >= 4) return { phase: 'classification', shouldAdvance: true, reason: 'Tous les cercles explorés' };
      break;
    case 'classification':
      if (totalCats >= 4 && nodes.length >= 10) return { phase: 'challenge', shouldAdvance: true, reason: 'Base solide pour le challenge' };
      break;
    case 'challenge':
      if (interactionCount > getPhaseStartCount('challenge') + 4) return { phase: 'synthese', shouldAdvance: true, reason: 'Challenge suffisant' };
      break;
    case 'synthese':
      return { phase: 'complete', shouldAdvance: true, reason: 'Synthèse terminée' };
  }
  return { phase: currentPhase, shouldAdvance: false, reason: 'Continue l\'exploration' };
}

// ============================================================
// OPENROUTER API
// ============================================================
export async function callOpenRouter(
  messages: { role: string; content: string }[],
  apiKey: string,
  options?: { model?: string; temperature?: number; maxTokens?: number }
): Promise<string> {
  const model = options?.model || DEFAULT_MODEL;
  const temperature = options?.temperature ?? 0.7;
  const maxTokens = options?.maxTokens ?? 2048;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ikigai-sensei.pages.dev',
      'X-Title': 'Ikigai Sensei V2',
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Recherche web contextuelle
 */
export async function webSearch(query: string, apiKey: string): Promise<string> {
  const messages = [
    { role: 'system', content: 'Tu es un assistant de recherche. Fournis des informations factuelles, récentes et concises. Format: résumé en 3-5 points clés avec des données si possible.' },
    { role: 'user', content: `Recherche : ${query}. Tendances marché, opportunités professionnelles, besoins émergents.` },
  ];
  try {
    return await callOpenRouter(messages, apiKey, { model: DEFAULT_MODEL, temperature: 0.3 });
  } catch {
    return '';
  }
}

/**
 * Génère un insight / cluster à partir de la mémoire complète
 */
export async function generateInsight(
  memoryTree: MemoryNode[],
  relations: MemoryRelation[],
  apiKey: string
): Promise<{
  clusters: ParsedCluster[];
  tensions: ParsedTension[];
  insights: ParsedInsight[];
  steps: ParsedStep[];
  raw: string;
}> {
  const contextMessage = buildInsightContext(memoryTree, relations);

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT_V2 },
    { role: 'user', content: contextMessage },
  ];

  const raw = await callOpenRouter(messages, apiKey, { temperature: 0.8, maxTokens: 3000 });

  return {
    clusters: parseClustersFromResponse(raw),
    tensions: parseTensionsFromResponse(raw),
    insights: parseInsightsFromResponse(raw),
    steps: parseStepsFromResponse(raw),
    raw,
  };
}

// ============================================================
// HELPERS
// ============================================================

export function getPhaseLabel(phase: PhaseType): string {
  const labels: Record<PhaseType, string> = {
    amorcage: '🌱 Amorçage', exploration_passion: '❤️ Passion', exploration_mission: '🌍 Mission',
    exploration_vocation: '💰 Vocation', exploration_profession: '🎯 Talents',
    classification: '🔍 Classification', challenge: '⚡ Challenge', synthese: '✨ Synthèse', complete: '✅ Terminé',
  };
  return labels[phase] || phase;
}

function getNextPhase(current: PhaseType): PhaseType | null {
  const idx = PHASE_ORDER.indexOf(current);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

function getPhaseStartCount(phase: PhaseType): number {
  return ({ challenge: 14, synthese: 18 } as Record<string, number>)[phase] || 0;
}

function countAllNodes(tree: MemoryNode[]): number {
  let count = 0;
  for (const node of tree) {
    count++;
    if (node.children) count += countAllNodes(node.children);
  }
  return count;
}

function flattenTree(tree: MemoryNode[]): MemoryNode[] {
  const result: MemoryNode[] = [];
  for (const node of tree) {
    result.push(node);
    if (node.children) result.push(...flattenTree(node.children));
  }
  return result;
}

function countByCategory(nodes: MemoryNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.category] = (counts[n.category] || 0) + 1;
  }
  return counts;
}

function countByType(nodes: MemoryNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.node_type] = (counts[n.node_type] || 0) + 1;
  }
  return counts;
}
