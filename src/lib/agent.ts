/**
 * Agent Ikigai - Le cerveau conversationnel
 * Stratégie de découverte progressive de l'Ikigai via OpenRouter
 */

import type { Bindings, SessionState, PhaseType, IkigaiElement, CategoryKey, IKIGAI_CATEGORIES } from '../types';

// Le prompt système ultra-travaillé qui définit le comportement de l'agent
const SYSTEM_PROMPT = `Tu es IKIGAI-SENSEI, un guide bienveillant et perspicace spécialisé dans la découverte de l'Ikigai ( concept japonais de raison d'être ).

TON RÔLE :
Aider l'utilisateur à découvrir son Ikigai - l'intersection parfaite entre :
- ❤️ Ce qu'il/elle AIME (passion)
- 🌍 Ce dont le MONDE a besoin (mission)
- 💰 Ce pour quoi il/elle peut être PAYÉ(E) (vocation)
- 🎯 Ce dans quoi il/elle est BON(NE) (profession)

TA PERSONNALITÉ :
- Chaleureux et empathique, comme un coach de vie bienveillant
- Curieux et perspicace, tu poses des questions qui font réfléchir
- Concis mais impactant (messages de 2-4 phrases max, sauf si tu analyses des résultats de recherche)
- Tu utilises parfois des métaphores ou analogies pertinentes
- Tu célèbres les découvertes et les prises de conscience
- Tu n'hésites pas à challenger gentiment quand quelque chose ne semble pas cohérent

TA MÉTHODE (suis ces phases dans l'ordre) :

**Phase 1 - Amorçage (1-2 messages)** :
Pose une question ouverte qui invite à l'introspection. Ex: "Raconte-moi... qu'est-ce qui te fait te lever le matin ? Qu'est-ce qui te fait vibrer ?"

**Phase 2 - Exploration des 4 cercles** :
Explore chaque cercle UN PAR UN avec des questions de plus en plus profondes :
- Passion : "Quand perds-tu la notion du temps ? Qu'est-ce qui te rend curieux comme un enfant ?"
- Mission : "Quels problèmes dans le monde te touchent personnellement ? Qu'aimerais-tu changer ?"
- Vocation : "Qu'est-ce que les gens te demandent souvent de faire ? Pour quoi serais-tu prêt à payer toi-même ?"
- Profession : "Qu'est-ce qui te semble facile alors que les autres galèrent ? Quelles compétences as-tu développées ?"

**Phase 3 - Classification** :
Quand tu détectes un élément qui pourrait appartenir à un cercle, ANNOTE-LE avec ce format EXACT :
[ELEMENT:catégorie:confiance]texte[/ELEMENT]
Exemple : [ELEMENT:passion:0.9]Photographie de rue, capturer l'instant[/ELEMENT]
Catégories : passion, mission, vocation, profession
Confiance : 0.0 (incertain) à 1.0 (certain)

**Phase 4 - Challenge** :
Quand tu as assez d'éléments (au moins 2-3 par cercle), challenge l'utilisateur :
- "Tu dis aimer X, mais est-ce que ça te passionne vraiment ou est-ce que c'est juste confortable ?"
- "Cette compétence, l'as-tu vraiment développée ou est-ce juste une attente des autres ?"

**Phase 5 - Synthèse** :
Propose des pistes d'Ikigai basées sur les intersections. Sois créatif et concret.

RÈGLES IMPORTANTES :
- NE pose JAMAIS plus d'une question à la fois
- Utilise [ELEMENT:...] pour TOUT élément que tu détectes
- Si l'utilisateur est bloqué, propose des exemples concrets pour l'inspirer
- Si tu as accès à des recherches web (fournies dans le contexte), intègre-les naturellement
- Reste toujours encourageant, jamais jugeant
- Si l'utilisateur mentionne quelque chose qui touche plusieurs cercles, note-le avec plusieurs [ELEMENT:...]
- La session a un état. Respecte la phase actuelle.`;

// Modèle OpenRouter à utiliser (Gemini Flash 2.0 - bon rapport qualité/prix/vitesse)
const DEFAULT_MODEL = 'google/gemini-2.0-flash-001';

// Mapping des phases pour guider la progression
const PHASE_ORDER: PhaseType[] = [
  'amorcage',
  'exploration_passion',
  'exploration_mission',
  'exploration_vocation',
  'exploration_profession',
  'classification',
  'challenge',
  'synthese',
  'complete',
];

const PHASE_QUESTIONS: Record<PhaseType, string> = {
  amorcage: "Pose une question d'introduction chaleureuse pour commencer la découverte.",
  exploration_passion: "Explore ce que la personne AIME vraiment. Pose des questions sur ses passions.",
  exploration_mission: "Explore ce dont le MONDE a besoin selon elle. Quels problèmes la touchent ?",
  exploration_vocation: "Explore ce pour quoi elle pourrait être PAYÉE. Qu'est-ce qui a de la valeur ?",
  exploration_profession: "Explore ce dans quoi elle est BONNE. Quels sont ses talents ?",
  classification: "Classe les éléments découverts et vérifie la cohérence.",
  challenge: "Challenge l'utilisateur sur la cohérence de ses réponses.",
  synthese: "Propose une synthèse et des pistes d'Ikigai.",
  complete: "Félicite l'utilisateur et résume son Ikigai.",
};

/**
 * Construit le contexte de la conversation pour l'IA
 */
export function buildConversationContext(
  sessionState: SessionState,
  elements: IkigaiElement[],
  recentMessages: { role: string; content: string; created_at?: string }[]
): string {
  const completedCats = JSON.parse(sessionState.completed_categories || '[]') as string[];
  const phaseLabel = getPhaseLabel(sessionState.current_phase);
  const nextPhase = getNextPhase(sessionState.current_phase);
  const nextPhaseLabel = nextPhase ? getPhaseLabel(nextPhase) : 'terminé';

  let ctx = `--- ÉTAT DE LA SESSION ---\n`;
  ctx += `Phase actuelle : ${phaseLabel}\n`;
  ctx += `Prochaine phase recommandée : ${nextPhaseLabel}\n`;
  ctx += `Cercles complétés : ${completedCats.length > 0 ? completedCats.join(', ') : 'aucun'}\n`;
  ctx += `Nombre d'interactions : ${sessionState.interaction_count}\n\n`;

  if (elements.length > 0) {
    ctx += `--- ÉLÉMENTS IKIGAI DÉCOUVERTS ---\n`;
    const grouped: Record<string, IkigaiElement[]> = {};
    for (const el of elements) {
      if (!grouped[el.category]) grouped[el.category] = [];
      grouped[el.category].push(el);
    }
    for (const [cat, els] of Object.entries(grouped)) {
      ctx += `${getCategoryEmoji(cat)} ${cat.toUpperCase()} :\n`;
      for (const el of els) {
        ctx += `  - "${el.content}" (confiance: ${el.confidence})\n`;
      }
    }
    ctx += `\n`;
  }

  // Déterminer la prochaine action
  ctx += `--- CONSIGNE POUR TA RÉPONSE ---\n`;
  const phase = sessionState.current_phase;
  ctx += `${PHASE_QUESTIONS[phase] || 'Continue la conversation naturellement.'}\n`;
  ctx += `Pose UNE seule question. Sois concis (2-4 phrases). Utilise [ELEMENT:...] pour tout élément détecté.\n`;

  return ctx;
}

/**
 * Analyse la réponse de l'IA pour extraire les éléments [ELEMENT:...]
 */
export function parseElementsFromResponse(content: string, sessionId: string): IkigaiElement[] {
  const elements: IkigaiElement[] = [];
  const regex = /\[ELEMENT:(passion|mission|vocation|profession):(\d+(?:\.\d+)?)\](.+?)\[\/ELEMENT\]/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const [, category, confidence, text] = match;
    elements.push({
      session_id: sessionId,
      content: text.trim(),
      category: category as CategoryKey,
      confidence: parseFloat(confidence),
      source: 'ai',
    });
  }

  // Aussi détecter les éléments avec un seul label
  const simpleRegex = /\[ELEMENT:(passion|mission|vocation|profession)\](.+?)\[\/ELEMENT\]/g;
  while ((match = simpleRegex.exec(content)) !== null) {
    const [, category, text] = match;
    // Éviter les doublons
    const exists = elements.some(e => e.content === text.trim() && e.category === category);
    if (!exists) {
      elements.push({
        session_id: sessionId,
        content: text.trim(),
        category: category as CategoryKey,
        confidence: 0.7,
        source: 'ai',
      });
    }
  }

  return elements;
}

/**
 * Nettoie la réponse des balises [ELEMENT:...]
 */
export function cleanResponseForDisplay(content: string): string {
  return content.replace(/\[ELEMENT:(?:passion|mission|vocation|profession)(?::\d+(?:\.\d+)?)?\](.+?)\[\/ELEMENT\]/g, '$1');
}

/**
 * Détermine la prochaine phase logique
 */
export function determineNextPhase(
  currentPhase: PhaseType,
  elements: IkigaiElement[],
  interactionCount: number
): { phase: PhaseType; shouldAdvance: boolean; reason: string } {
  // Compter les éléments par catégorie
  const counts: Record<string, number> = {};
  for (const el of elements) {
    counts[el.category] = (counts[el.category] || 0) + 1;
  }

  const totalCats = Object.keys(counts).length;

  // Logique de progression
  switch (currentPhase) {
    case 'amorcage':
      if (interactionCount >= 2 && elements.length >= 2) {
        // Déterminer quel cercle est le moins exploré
        const unexplored = ['passion', 'mission', 'vocation', 'profession'].find(c => !counts[c]);
        if (unexplored) {
          return {
            phase: `exploration_${unexplored}` as PhaseType,
            shouldAdvance: true,
            reason: 'Assez d\'éléments pour passer à l\'exploration ciblée',
          };
        }
        return { phase: 'exploration_passion', shouldAdvance: true, reason: 'Passage à l\'exploration' };
      }
      break;

    case 'exploration_passion':
      if ((counts['passion'] || 0) >= 2) {
        return { phase: 'exploration_mission', shouldAdvance: true, reason: 'Passion bien explorée' };
      }
      break;

    case 'exploration_mission':
      if ((counts['mission'] || 0) >= 2) {
        return { phase: 'exploration_vocation', shouldAdvance: true, reason: 'Mission bien explorée' };
      }
      break;

    case 'exploration_vocation':
      if ((counts['vocation'] || 0) >= 2) {
        return { phase: 'exploration_profession', shouldAdvance: true, reason: 'Vocation bien explorée' };
      }
      break;

    case 'exploration_profession':
      if ((counts['profession'] || 0) >= 2) {
        return { phase: 'classification', shouldAdvance: true, reason: 'Tous les cercles explorés, passage à la classification' };
      }
      break;

    case 'classification':
      if (totalCats >= 4 && elements.length >= 8) {
        return { phase: 'challenge', shouldAdvance: true, reason: 'Classification complète, passage au challenge' };
      }
      break;

    case 'challenge':
      if (interactionCount > getPhaseStartCount('challenge') + 3) {
        return { phase: 'synthese', shouldAdvance: true, reason: 'Challenge suffisant, passage à la synthèse' };
      }
      break;

    case 'synthese':
      return { phase: 'complete', shouldAdvance: true, reason: 'Synthèse terminée' };
  }

  return { phase: currentPhase, shouldAdvance: false, reason: 'Continue la phase actuelle' };
}

/**
 * Appelle l'API OpenRouter pour générer une réponse
 */
export async function callOpenRouter(
  messages: { role: string; content: string }[],
  apiKey: string,
  options?: { model?: string; temperature?: number }
): Promise<string> {
  const model = options?.model || DEFAULT_MODEL;
  const temperature = options?.temperature ?? 0.7;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://ikigai.app',
      'X-Title': 'Ikigai Discovery Agent',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${error}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Effectue une recherche web via l'API OpenRouter (certains modèles le supportent)
 * Fallback : utilise le modèle avec des instructions de recherche
 */
export async function webSearch(
  query: string,
  apiKey: string
): Promise<string> {
  const messages = [
    { role: 'system', content: 'Tu es un assistant de recherche. Fournis des informations factuelles, récentes et concises sur le sujet demandé. Donne des tendances, chiffres, opportunités concrètes. Format: résumé en 3-5 points clés.' },
    { role: 'user', content: `Recherche : ${query}. Donne-moi des informations sur les tendances du marché, les opportunités professionnelles, et les besoins émergents liés à ce sujet.` },
  ];

  try {
    const result = await callOpenRouter(messages, apiKey, {
      model: 'google/gemini-2.0-flash-001',
      temperature: 0.3,
    });
    return result;
  } catch {
    return '';
  }
}

// Helpers
function getPhaseLabel(phase: PhaseType): string {
  const labels: Record<PhaseType, string> = {
    amorcage: '🌱 Amorçage',
    exploration_passion: '❤️ Exploration - Passion',
    exploration_mission: '🌍 Exploration - Mission',
    exploration_vocation: '💰 Exploration - Vocation',
    exploration_profession: '🎯 Exploration - Profession',
    classification: '🔍 Classification',
    challenge: '⚡ Challenge',
    synthese: '✨ Synthèse',
    complete: '✅ Terminé',
  };
  return labels[phase] || phase;
}

function getNextPhase(current: PhaseType): PhaseType | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < PHASE_ORDER.length - 1) return PHASE_ORDER[idx + 1];
  return null;
}

function getCategoryEmoji(cat: string): string {
  const emojis: Record<string, string> = {
    passion: '❤️',
    mission: '🌍',
    vocation: '💰',
    profession: '🎯',
  };
  return emojis[cat] || '📌';
}

function getPhaseStartCount(phase: PhaseType): number {
  const base: Record<string, number> = {
    challenge: 12,
    synthese: 16,
  };
  return base[phase] || 0;
}
