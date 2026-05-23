/**
 * Routes API pour l'agent Ikigai
 * - POST /api/chat : Envoyer un message et recevoir une réponse de l'agent
 * - GET /api/session/:id : Récupérer l'état complet d'une session
 * - PUT /api/elements/:id : Modifier un élément
 * - DELETE /api/elements/:id : Supprimer un élément
 * - POST /api/session/reset : Réinitialiser une session
 * - GET /api/session/:id/export : Exporter les résultats
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings, PhaseType, IkigaiElement, Message } from '../types';
import {
  getOrCreateSession,
  getSessionState,
  updateSessionState,
  addElement,
  getElements,
  updateElement,
  deleteElement,
  addMessage,
  getRecentMessages,
  getFullSessionState,
} from '../lib/db';
import {
  buildConversationContext,
  callOpenRouter,
  webSearch,
  parseElementsFromResponse,
  cleanResponseForDisplay,
  determineNextPhase,
} from '../lib/agent';

const api = new Hono<{ Bindings: Bindings }>();

// CORS pour le frontend
api.use('*', cors());

/**
 * POST /api/chat
 * Le cœur de l'application - envoie un message à l'agent IA
 */
api.post('/chat', async (c) => {
  try {
    const { session_id, message } = await c.req.json<{
      session_id: string;
      message: string;
    }>();

    if (!session_id || !message) {
      return c.json({ success: false, error: 'session_id et message requis' }, 400);
    }

    const db = c.env.DB;
    const apiKey = c.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return c.json({ success: false, error: 'Clé API OpenRouter non configurée' }, 500);
    }

    // 1. Récupérer l'état de la session
    const session = await getOrCreateSession(db, session_id);
    const state = await getSessionState(db, session_id);
    const elements = await getElements(db, session_id);

    // 2. Sauvegarder le message utilisateur
    await addMessage(db, {
      session_id,
      role: 'user',
      content: message,
      phase: state.current_phase,
    });

    // 3. Incrémenter le compteur d'interactions
    const newInteractionCount = state.interaction_count + 1;

    // 4. Vérifier si on doit faire une recherche web (tous les 3 messages, si pertinent)
    let webSearchResult = '';
    const searchTriggers = ['marché', 'salaire', 'tendance', 'métier', 'carrière', 'job', 'salaire', 'demande', 'besoin'];
    const shouldSearch = newInteractionCount % 3 === 0 && searchTriggers.some(t => message.toLowerCase().includes(t));

    if (shouldSearch) {
      try {
        webSearchResult = await webSearch(message, apiKey);
        if (webSearchResult) {
          await updateSessionState(db, session_id, { last_web_search: message });
        }
      } catch {
        // Recherche web optionnelle, on continue sans
      }
    }

    // 5. Construire le contexte et appeler l'IA
    const recentMessages = await getRecentMessages(db, session_id, 15);

    const contextMessage = buildConversationContext(state, elements, recentMessages);

    // Construire les messages pour l'API (prompt système + contexte + historique)
    const apiMessages: { role: string; content: string }[] = [
      {
        role: 'system',
        content: `Tu es IKIGAI-SENSEI, un guide bienveillant spécialisé dans la découverte de l'Ikigai.

TON RÔLE : Aider l'utilisateur à découvrir son Ikigai - l'intersection entre ce qu'il aime (passion), ce dont le monde a besoin (mission), ce pour quoi il peut être payé (vocation), et ce dans quoi il est bon (profession).

PERSONNALITÉ : Chaleureux, curieux, concis (2-4 phrases max), perspicace. Tu poses des questions qui font réfléchir. Tu célèbres les découvertes.

MÉTHODE : Selon la phase actuelle (indiquée dans le contexte), explore un cercle à la fois avec des questions profondes.

FORMAT CRITIQUE : Pour chaque élément d'Ikigai que tu identifies, utilise EXACTEMENT ce format :
[ELEMENT:categorie:confiance]texte de l'élément[/ELEMENT]
Catégories : passion, mission, vocation, profession
Confiance : nombre entre 0.0 et 1.0 (ex: 0.8)

RÈGLES :
- UNE seule question par message
- Toujours utiliser [ELEMENT:...] pour les éléments détectés
- Si recherche web fournie, l'intégrer naturellement
- Être encourageant, jamais jugeant`,
      },
      { role: 'user', content: contextMessage },
    ];

    // Ajouter le résultat de recherche web si disponible
    if (webSearchResult) {
      apiMessages.push({
        role: 'system',
        content: `Résultat de recherche web sur "${message}" :\n${webSearchResult}\n\nIntègre ces informations de manière naturelle dans ta réponse si pertinent.`,
      });
    }

    // Ajouter les derniers messages de l'historique
    for (const msg of recentMessages.slice(-8)) {
      apiMessages.push({ role: msg.role, content: msg.content });
    }

    // Dernier message utilisateur
    apiMessages.push({ role: 'user', content: message });

    // 6. Appeler l'API OpenRouter
    const aiResponse = await callOpenRouter(apiMessages, apiKey);

    // 7. Extraire les éléments détectés
    const detectedElements = parseElementsFromResponse(aiResponse, session_id);

    // 8. Sauvegarder les nouveaux éléments
    const savedElements: IkigaiElement[] = [];
    for (const el of detectedElements) {
      // Éviter les doublons en vérifiant le contenu
      const exists = elements.some(
        e => e.content.toLowerCase() === el.content.toLowerCase() && e.category === el.category
      );
      if (!exists) {
        const saved = await addElement(db, el);
        savedElements.push(saved);
      }
    }

    // 9. Déterminer la prochaine phase
    const allElements = [...elements, ...savedElements];
    const { phase: nextPhase, shouldAdvance } = determineNextPhase(
      state.current_phase,
      allElements,
      newInteractionCount
    );

    // 10. Nettoyer la réponse pour l'affichage
    const cleanResponse = cleanResponseForDisplay(aiResponse);

    // 11. Sauvegarder le message de l'assistant
    const assistantMessage = await addMessage(db, {
      session_id,
      role: 'assistant',
      content: cleanResponse,
      phase: state.current_phase,
    });

    // 12. Mettre à jour l'état de la session
    await updateSessionState(db, session_id, {
      current_phase: shouldAdvance ? nextPhase : state.current_phase,
      interaction_count: newInteractionCount,
    });

    // 13. Calculer la progression
    const counts: Record<string, number> = {};
    for (const el of allElements) {
      counts[el.category] = (counts[el.category] || 0) + 1;
    }
    const totalCategories = Object.keys(counts).length;
    const totalElements = allElements.length;
    // Progress: 40% basé sur le nombre de catégories, 60% sur le nombre d'éléments
    const categoryProgress = Math.min(totalCategories / 4, 1) * 40;
    const elementProgress = Math.min(totalElements / 12, 1) * 60;
    const phaseProgress = Math.round(Math.min(categoryProgress + elementProgress, 100));

    return c.json({
      success: true,
      data: {
        message: assistantMessage,
        detected_elements: savedElements,
        current_phase: shouldAdvance ? nextPhase : state.current_phase,
        phase_progress: phaseProgress,
        web_search_used: !!webSearchResult,
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json(
      { success: false, error: error.message || 'Erreur interne' },
      500
    );
  }
});

/**
 * GET /api/session/:id
 * Récupère l'état complet d'une session
 */
api.get('/session/:id', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const data = await getFullSessionState(c.env.DB, sessionId);
    return c.json({ success: true, data });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * PUT /api/elements/:id
 * Modifie un élément (catégorie, contenu)
 */
api.put('/elements/:id', async (c) => {
  try {
    const elementId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json<{
      content?: string;
      category?: 'passion' | 'mission' | 'vocation' | 'profession';
      confidence?: number;
      notes?: string;
    }>();

    await updateElement(c.env.DB, elementId, body);
    return c.json({ success: true, data: { id: elementId, ...body } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * DELETE /api/elements/:id
 * Supprime un élément
 */
api.delete('/elements/:id', async (c) => {
  try {
    const elementId = parseInt(c.req.param('id'), 10);
    await deleteElement(c.env.DB, elementId);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * POST /api/session/reset
 * Réinitialise une session (garde la même ID mais efface tout)
 */
api.post('/session/reset', async (c) => {
  try {
    const { session_id } = await c.req.json<{ session_id: string }>();
    const db = c.env.DB;

    await db.prepare('DELETE FROM ikigai_elements WHERE session_id = ?').bind(session_id).run();
    await db.prepare('DELETE FROM messages WHERE session_id = ?').bind(session_id).run();
    await db.prepare('DELETE FROM session_state WHERE session_id = ?').bind(session_id).run();

    // Recréer l'état
    await db.prepare(
      'INSERT INTO session_state (session_id, current_phase, completed_categories, interaction_count) VALUES (?, ?, ?, ?)'
    ).bind(session_id, 'amorcage', '[]', 0).run();

    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * GET /api/session/:id/export
 * Exporte les résultats au format JSON
 */
api.get('/session/:id/export', async (c) => {
  try {
    const sessionId = c.req.param('id');
    const data = await getFullSessionState(c.env.DB, sessionId);

    // Formater pour l'export
    const exportData = {
      ikigai_session: {
        id: data.session.id,
        created_at: data.session.created_at,
        status: data.session.status,
      },
      cercles: {
        passion: data.elements.filter(e => e.category === 'passion').map(e => e.content),
        mission: data.elements.filter(e => e.category === 'mission').map(e => e.content),
        vocation: data.elements.filter(e => e.category === 'vocation').map(e => e.content),
        profession: data.elements.filter(e => e.category === 'profession').map(e => e.content),
      },
      intersections: findIntersections(data.elements),
      conversation: data.recentMessages.map(m => ({
        role: m.role,
        content: m.content,
        timestamp: m.created_at,
      })),
    };

    return c.json({ success: true, data: exportData });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

/**
 * Trouve les intersections entre les catégories
 */
function findIntersections(elements: IkigaiElement[]): any {
  const byCategory: Record<string, Set<string>> = {};
  for (const el of elements) {
    if (!byCategory[el.category]) byCategory[el.category] = new Set();
    byCategory[el.category].add(el.content.toLowerCase());
  }

  const categories = ['passion', 'mission', 'vocation', 'profession'];
  const intersections: any = {};

  // Intersections 2 à 2
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const key = `${categories[i]}_${categories[j]}`;
      intersections[key] = elements
        .filter(e => e.category === categories[i])
        .filter(e => byCategory[categories[j]]?.has(e.content.toLowerCase()))
        .map(e => e.content);
    }
  }

  // Ikigai (les 4)
  const allFour = elements
    .filter(e => e.category === 'passion')
    .filter(e =>
      byCategory['mission']?.has(e.content.toLowerCase()) &&
      byCategory['vocation']?.has(e.content.toLowerCase()) &&
      byCategory['profession']?.has(e.content.toLowerCase())
    )
    .map(e => e.content);
  intersections['ikigai'] = allFour;

  return intersections;
}

export default api;
