/**
 * Routes API V2 — Ikigai Sensei
 * Auth + Memory Graph + Chat + Insights + Clustering
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from '../types';
import {
  registerUser, loginUser, getUserById, updateUserProfile,
  createToken, createSessionCookie, clearSessionCookie,
  getAuthFromCookie,
} from '../lib/auth';
import {
  createNode, getNode, getNodeTree, getNodesByUser,
  updateNode, deleteNode, createRelation, getRelations,
  getNodeRelations, deleteRelation, getMemoryStats,
  exportMemory, getOrCreateSessionV2, getOrCreateTag, tagNode,
  getUserTags, getNodeTags,
} from '../lib/memory';
import {
  buildConversationContextV2, callOpenRouter, webSearch,
  generateInsight,
  parseNodesFromResponse, parseRelationsFromResponse,
  parseClustersFromResponse, parseInsightsFromResponse,
  parseTensionsFromResponse, parseStepsFromResponse,
  cleanResponseForDisplayV2, determineNextPhaseV2,
} from '../lib/agent';
import type { MemoryNode, MemoryRelation, CategoryKey } from '../types';

const api = new Hono<{ Bindings: Bindings }>();
api.use('*', cors());

// ===== MIDDLEWARE: Auth =====
async function authMiddleware(c: any, next: any) {
  const payload = await getAuthFromCookie(c.req.raw, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Non authentifié' }, 401);
  }
  c.set('userId', payload.userId);
  c.set('userEmail', payload.email);
  await next();
}

// ============================================================
// AUTH ROUTES
// ============================================================

api.post('/auth/register', async (c) => {
  try {
    const body = await c.req.json<{
      email: string; password: string; display_name?: string; name?: string;
    }>();
    const displayName = body.display_name || body.name || '';
    const result = await registerUser(c.env.DB, body.email, body.password, displayName);
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 400);
    }

    const token = await createToken(
      { userId: result.user!.id, email: result.user!.email },
      c.env.JWT_SECRET
    );

    return new Response(JSON.stringify({ success: true, data: { user: result.user } }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(token),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.post('/auth/login', async (c) => {
  try {
    const rawText = await c.req.text();
    let body: any = {};
    try { body = JSON.parse(rawText); } catch { body = {}; }
    const email = (body.email || '').toString();
    const password = (body.password || '').toString();
    const result = await loginUser(c.env.DB, email, password);
    if (!result.success) {
      return c.json({ success: false, error: result.error }, 401);
    }

    const token = await createToken(
      { userId: result.user!.id, email: result.user!.email },
      c.env.JWT_SECRET
    );

    return new Response(JSON.stringify({ success: true, data: { user: result.user } }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': createSessionCookie(token),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.post('/auth/logout', async (c) => {
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': clearSessionCookie() },
  });
});

api.get('/auth/me', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await getUserById(c.env.DB, userId);
  if (!user) return c.json({ success: false, error: 'Utilisateur non trouvé' }, 404);
  return c.json({ success: true, data: { user } });
});

// ============================================================
// MEMORY ROUTES (protégées par auth)
// ============================================================

api.get('/memory/tree', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const category = c.req.query('category') as CategoryKey | undefined;
  const nodeType = c.req.query('node_type') as string | undefined;

  let tree: MemoryNode[];
  if (category || nodeType) {
    const allNodes = await getNodesByUser(c.env.DB, userId, category);
    if (nodeType) {
      tree = allNodes.filter(n => n.node_type === nodeType);
    } else {
      tree = buildTreeFromFlat(allNodes);
    }
  } else {
    tree = await getNodeTree(c.env.DB, userId);
  }

  const relations = await getRelations(c.env.DB, userId);
  const stats = await getMemoryStats(c.env.DB, userId);
  return c.json({ success: true, data: { tree, relations, stats } });
});

api.get('/memory/nodes', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const category = c.req.query('category') as CategoryKey | undefined;
  const nodes = await getNodesByUser(c.env.DB, userId, category);
  return c.json({ success: true, data: { nodes } });
});

api.get('/memory/nodes/:id', authMiddleware, async (c) => {
  const nodeId = parseInt(c.req.param('id'), 10);
  const node = await getNode(c.env.DB, nodeId);
  if (!node) return c.json({ success: false, error: 'Nœud non trouvé' }, 404);
  const relations = await getNodeRelations(c.env.DB, nodeId);
  const tags = await getNodeTags(c.env.DB, nodeId);
  return c.json({ success: true, data: { node, relations, tags } });
});

api.post('/memory/nodes', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const body = await c.req.json<{
      title: string; description?: string; content?: any;
      category: CategoryKey; confidence?: number; node_type?: string;
      parent_id?: number; session_id?: string;
    }>();

    const node = await createNode(c.env.DB, {
      user_id: userId,
      session_id: body.session_id || null,
      title: body.title,
      description: body.description || '',
      content: body.content || {},
      category: body.category,
      confidence: body.confidence ?? 0.5,
      source: 'user',
      parent_id: body.parent_id || null,
      depth: 0,
      sort_order: 0,
      is_expanded: 1,
      is_archived: 0,
      node_type: (body.node_type as any) || 'concept',
    });

    return c.json({ success: true, data: { node } }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.put('/memory/nodes/:id', authMiddleware, async (c) => {
  try {
    const nodeId = parseInt(c.req.param('id'), 10);
    const body = await c.req.json<any>();
    await updateNode(c.env.DB, nodeId, body);
    const node = await getNode(c.env.DB, nodeId);
    return c.json({ success: true, data: { node } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.delete('/memory/nodes/:id', authMiddleware, async (c) => {
  try {
    const nodeId = parseInt(c.req.param('id'), 10);
    await deleteNode(c.env.DB, nodeId);
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Relations
api.post('/memory/relations', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { source_node_id, target_node_id, relation_type, strength, description } = await c.req.json<any>();
    const relation = await createRelation(c.env.DB, {
      user_id: userId,
      source_node_id, target_node_id,
      relation_type, strength: strength ?? 0.5,
      description, source: 'user',
    });
    return c.json({ success: true, data: { relation } }, 201);
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

api.delete('/memory/relations/:id', authMiddleware, async (c) => {
  const relationId = parseInt(c.req.param('id'), 10);
  await deleteRelation(c.env.DB, relationId);
  return c.json({ success: true });
});

// Tags
api.get('/memory/tags', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const tags = await getUserTags(c.env.DB, userId);
  return c.json({ success: true, data: { tags } });
});

api.post('/memory/nodes/:id/tags', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const nodeId = parseInt(c.req.param('id'), 10);
    const { tag_name } = await c.req.json<{ tag_name: string }>();
    const tag = await getOrCreateTag(c.env.DB, userId, tag_name);
    await tagNode(c.env.DB, nodeId, tag.id!);
    return c.json({ success: true, data: { tag } });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// Stats & Export
api.get('/memory/stats', authMiddleware, async (c) => {
  const stats = await getMemoryStats(c.env.DB, c.get('userId'));
  return c.json({ success: true, data: { stats } });
});

api.get('/memory/export', authMiddleware, async (c) => {
  const data = await exportMemory(c.env.DB, c.get('userId'));
  return c.json({ success: true, data });
});

// ============================================================
// INSIGHT ROUTE — Analyse profonde de la mémoire
// ============================================================
api.post('/insight/generate', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const apiKey = c.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return c.json({ success: false, error: 'Clé API non configurée' }, 500);
    }

    const memoryTree = await getNodeTree(c.env.DB, userId);
    const relations = await getRelations(c.env.DB, userId);

    if (memoryTree.length === 0) {
      return c.json({
        success: true,
        data: {
          clusters: [], tensions: [], insights: [], steps: [],
          message: 'Pas assez de données pour générer un insight. Continue à explorer !',
        },
      });
    }

    const result = await generateInsight(memoryTree, relations, apiKey);

    // Sauvegarder les insights comme nœuds
    const savedInsights: any[] = [];
    for (const ins of result.insights) {
      try {
        const node = await createNode(c.env.DB, {
          user_id: userId,
          session_id: null,
          title: ins.content.substring(0, 80) + (ins.content.length > 80 ? '...' : ''),
          description: ins.content,
          content: { actionable_takeaway: ins.content, is_auto_generated: true },
          category: 'passion' as CategoryKey,
          confidence: ins.confidence,
          source: 'ai',
          parent_id: null,
          depth: 0,
          sort_order: 0,
          is_expanded: 1,
          is_archived: 0,
          node_type: 'insight',
        });
        savedInsights.push(node);
      } catch { /* ignore duplicates */ }
    }

    return c.json({
      success: true,
      data: {
        clusters: result.clusters,
        tensions: result.tensions,
        insights: result.insights,
        steps: result.steps,
        saved_insights: savedInsights,
      },
    });
  } catch (error: any) {
    return c.json({ success: false, error: error.message }, 500);
  }
});

// ============================================================
// CHAT ROUTE (protégée par auth)
// ============================================================
api.post('/chat', authMiddleware, async (c) => {
  try {
    const userId = c.get('userId');
    const { session_id, message } = await c.req.json<{ session_id: string; message: string }>();

    if (!session_id || !message) {
      return c.json({ success: false, error: 'session_id et message requis' }, 400);
    }

    const db = c.env.DB;
    const apiKey = c.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return c.json({ success: false, error: 'Clé API OpenRouter non configurée' }, 500);
    }

    // 1. Session
    const session = await getOrCreateSessionV2(db, session_id, userId);
    const state = await db.prepare('SELECT * FROM session_state WHERE session_id = ?')
      .bind(session_id).first<any>() || {
        session_id, current_phase: 'amorcage', completed_categories: '[]', interaction_count: 0,
      };

    // 2. Mémoire arborescente
    const memoryTree = await getNodeTree(db, userId);
    const relations = await getRelations(db, userId);

    // 3. Sauvegarder le message utilisateur
    await db.prepare('INSERT INTO messages (session_id, role, content, phase) VALUES (?, ?, ?, ?)')
      .bind(session_id, 'user', message, state.current_phase).run();

    const newInteractionCount = (state.interaction_count || 0) + 1;

    // 4. Recherche web contextuelle
    let webSearchResult = '';
    const triggers = ['marché', 'salaire', 'tendance', 'métier', 'carrière', 'job', 'demande', 'besoin', 'freelance', 'entreprise', 'secteur', 'saas', 'startup'];
    if (newInteractionCount % 3 === 0 && triggers.some(t => message.toLowerCase().includes(t))) {
      try { webSearchResult = await webSearch(message, apiKey); } catch {/* optionnel */}
    }

    // 5. Messages récents
    const recentMessages = await db.prepare(
      'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 15'
    ).bind(session_id).all();
    const reversed = [...recentMessages.results].reverse();

    // 6. Construire le contexte et appeler l'IA
    const contextMessage = buildConversationContextV2(state, memoryTree, relations, reversed as any);

    const apiMessages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT_V2 },
      { role: 'user', content: contextMessage },
    ];

    if (webSearchResult) {
      apiMessages.push({ role: 'system', content: `Recherche web sur "${message}" :\n${webSearchResult}` });
    }

    for (const msg of reversed.slice(-6)) {
      apiMessages.push({ role: msg.role as string, content: msg.content as string });
    }
    apiMessages.push({ role: 'user', content: message });

    const aiResponse = await callOpenRouter(apiMessages, apiKey, { temperature: 0.7, maxTokens: 2500 });

    // 7. Parser tous les types de données
    const parsedNodes = parseNodesFromResponse(aiResponse);
    const parsedRelations = parseRelationsFromResponse(aiResponse);
    const parsedClusters = parseClustersFromResponse(aiResponse);

    // 8. Sauvegarder les nouveaux nœuds
    const savedNodes: MemoryNode[] = [];
    const titleToNodeMap = new Map<string, MemoryNode>();

    const allFlatNodes = flattenTree(memoryTree);
    for (const node of allFlatNodes) {
      titleToNodeMap.set(node.title.toLowerCase(), node);
    }

    for (const pn of parsedNodes) {
      let parentId: number | null = null;
      if (pn.parent_title) {
        parentId = titleToNodeMap.get(pn.parent_title.toLowerCase())?.id ?? null;
      }

      const exists = titleToNodeMap.has(pn.title.toLowerCase());
      if (!exists) {
        const newNode = await createNode(db, {
          user_id: userId,
          session_id,
          title: pn.title,
          description: '',
          content: {},
          category: pn.category,
          confidence: pn.confidence,
          source: 'ai',
          parent_id: parentId,
          depth: 0,
          sort_order: 0,
          is_expanded: 1,
          is_archived: 0,
          node_type: pn.node_type,
        });
        savedNodes.push(newNode);
        titleToNodeMap.set(pn.title.toLowerCase(), newNode);
      }
    }

    // 9. Sauvegarder les nouvelles relations
    const savedRelations: MemoryRelation[] = [];
    for (const pr of parsedRelations) {
      const sourceNode = titleToNodeMap.get(pr.source_title.toLowerCase());
      const targetNode = titleToNodeMap.get(pr.target_title.toLowerCase());
      if (sourceNode && targetNode && sourceNode.id !== targetNode.id) {
        try {
          const rel = await createRelation(db, {
            user_id: userId,
            source_node_id: sourceNode.id!,
            target_node_id: targetNode.id!,
            relation_type: pr.relation_type,
            strength: pr.strength,
            description: `Détecté par l'IA: ${pr.source_title} ${pr.relation_type} ${pr.target_title}`,
            source: 'ai',
          });
          savedRelations.push(rel);
        } catch {/* ignore duplicates */}
      }
    }

    // 10. Déterminer la prochaine phase
    const allNodes = [...allFlatNodes, ...savedNodes];
    const { phase: nextPhase, shouldAdvance } = determineNextPhaseV2(
      state.current_phase, allNodes, newInteractionCount
    );

    // 11. Nettoyer la réponse
    const cleanResponse = cleanResponseForDisplayV2(aiResponse);

    // 12. Sauvegarder le message assistant
    const msgResult = await db.prepare(
      'INSERT INTO messages (session_id, role, content, phase) VALUES (?, ?, ?, ?)'
    ).bind(session_id, 'assistant', cleanResponse, state.current_phase).run();

    // 13. Mettre à jour l'état
    await db.prepare(`
      UPDATE session_state SET current_phase = ?, interaction_count = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).bind(
      shouldAdvance ? nextPhase : state.current_phase, newInteractionCount, session_id
    ).run();

    // 14. Calculer la progression
    const counts: Record<string, number> = {};
    for (const n of allNodes) counts[n.category] = (counts[n.category] || 0) + 1;
    const catProg = Math.min(Object.keys(counts).length / 4, 1) * 40;
    const elProg = Math.min(allNodes.length / 15, 1) * 50;
    const relProg = relations.length > 3 ? 10 : 0;
    const progress = Math.round(Math.min(catProg + elProg + relProg, 100));

    return c.json({
      success: true,
      data: {
        message: { id: msgResult.meta.last_row_id, session_id, role: 'assistant', content: cleanResponse, phase: state.current_phase },
        detected_nodes: savedNodes,
        new_relations: savedRelations,
        clusters: parsedClusters,
        current_phase: shouldAdvance ? nextPhase : state.current_phase,
        phase_progress: progress,
        web_search_used: !!webSearchResult,
      },
    });
  } catch (error: any) {
    console.error('Chat error:', error);
    return c.json({ success: false, error: error.message || 'Erreur interne' }, 500);
  }
});

// ============================================================
// SESSION (compatibilité)
// ============================================================
api.get('/session/:id', authMiddleware, async (c) => {
  const sessionId = c.req.param('id');
  const userId = c.get('userId');
  const session = await getOrCreateSessionV2(c.env.DB, sessionId, userId);
  const state = await c.env.DB.prepare('SELECT * FROM session_state WHERE session_id = ?')
    .bind(sessionId).first() || { session_id: sessionId, current_phase: 'amorcage', completed_categories: '[]', interaction_count: 0 };
  const tree = await getNodeTree(c.env.DB, userId);
  const messages = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 30'
  ).bind(sessionId).all();

  return c.json({
    success: true,
    data: {
      session,
      state,
      memory_tree: tree,
      recentMessages: [...messages.results].reverse(),
    },
  });
});

api.post('/session/reset', authMiddleware, async (c) => {
  const { session_id } = await c.req.json<{ session_id: string }>();
  await c.env.DB.prepare('DELETE FROM messages WHERE session_id = ?').bind(session_id).run();
  await c.env.DB.prepare('DELETE FROM session_state WHERE session_id = ?').bind(session_id).run();
  await c.env.DB.prepare(
    'INSERT INTO session_state (session_id, current_phase, completed_categories, interaction_count) VALUES (?, ?, ?, ?)'
  ).bind(session_id, 'amorcage', '[]', 0).run();
  return c.json({ success: true });
});

// ===== HELPERS =====

function flattenTree(nodes: MemoryNode[]): MemoryNode[] {
  const result: MemoryNode[] = [];
  for (const node of nodes) {
    result.push(node);
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

function buildTreeFromFlat(nodes: MemoryNode[]): MemoryNode[] {
  const nodeMap = new Map<number, MemoryNode>();
  const roots: MemoryNode[] = [];

  for (const node of nodes) {
    node.children = [];
    nodeMap.set(node.id!, node);
  }

  for (const node of nodes) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      nodeMap.get(node.parent_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

const SYSTEM_PROMPT_V2 = `Tu es IKIGAI-SENSEI, un guide bienveillant expert en découverte de l'Ikigai et en cartographie de conscience.

TON RÔLE : Aider l'utilisateur à construire sa CARTE DE CONSCIENCE — un graphe mental arborescent qui cartographie TOUT son univers intérieur.

LES 4 CERCLES DE L'IKIGAI :
- ❤️ PASSION : Ce que l'utilisateur AIME profondément, activités qui le font vibrer
- 🌍 MISSION : Ce dont le MONDE a besoin, problèmes qui le touchent
- 💰 VOCATION : Ce pour quoi il peut être PAYÉ, valeur économique
- 🎯 PROFESSION : Ce dans quoi il est BON, talents et compétences

FORMAT CRITIQUE — Pour chaque élément détecté :
[NODE:catégorie:confiance:type:parent]titre[/NODE]
Types: concept, skill, experience, project, value, goal, fear, story, insight

Connexions : [RELATION:type:force]source -> cible[/RELATION]
Types: nourrit, contraste_avec, decoule_de, renforce, contredit, inspire, collabore_avec, est_une_sous_partie_de

Clusters (3+ nœuds liés) : [CLUSTER:nom]description[/CLUSTER]

RÈGLES : UNE question. Toujours [NODE:...]. [RELATION:...] pour connecter. 2-4 phrases.`;

export default api;
