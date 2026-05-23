/**
 * Module Mémoire - Graphe de Conscience
 * Gère l'arborescence de nœuds, les relations et les tags
 */

import type {
  MemoryNode, MemoryRelation, MemoryTag, MemoryExport,
  RelationType, NodeType, CategoryKey, NodeContent,
} from '../types';

// ============================================================
// NODES (Nœuds)
// ============================================================

export async function createNode(
  db: D1Database,
  node: Omit<MemoryNode, 'id' | 'created_at' | 'updated_at'>
): Promise<MemoryNode> {
  // Calculer la profondeur si parent_id est défini
  let depth = 0;
  if (node.parent_id) {
    const parent = await db.prepare('SELECT depth FROM memory_nodes WHERE id = ?')
      .bind(node.parent_id).first<{ depth: number }>();
    depth = (parent?.depth ?? 0) + 1;
  }

  const result = await db.prepare(`
    INSERT INTO memory_nodes
      (user_id, session_id, title, description, content, category, confidence, source,
       parent_id, depth, sort_order, is_expanded, is_archived, node_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    node.user_id, node.session_id || null,
    node.title, node.description || null,
    JSON.stringify(node.content || {}),
    node.category, node.confidence, node.source,
    node.parent_id || null, depth, node.sort_order || 0,
    node.is_expanded ?? 1, node.is_archived ?? 0,
    node.node_type || 'concept'
  ).run();

  return {
    ...node,
    id: result.meta.last_row_id as number,
    depth,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export async function getNode(db: D1Database, nodeId: number): Promise<MemoryNode | null> {
  const node = await db.prepare('SELECT * FROM memory_nodes WHERE id = ? AND is_archived = 0')
    .bind(nodeId).first<MemoryNode>();
  if (!node) return null;

  node.content = typeof node.content === 'string'
    ? JSON.parse(node.content as any) : (node.content || {});
  return node;
}

export async function getNodesByUser(
  db: D1Database,
  userId: string,
  category?: CategoryKey
): Promise<MemoryNode[]> {
  let query = 'SELECT * FROM memory_nodes WHERE user_id = ? AND is_archived = 0';
  const params: any[] = [userId];

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY depth ASC, sort_order ASC, created_at ASC';

  const result = await db.prepare(query).bind(...params).all<MemoryNode>();
  return result.results.map(n => ({
    ...n,
    content: typeof n.content === 'string' ? JSON.parse(n.content as any) : (n.content || {}),
  }));
}

export async function getNodeTree(
  db: D1Database,
  userId: string
): Promise<MemoryNode[]> {
  const nodes = await getNodesByUser(db, userId);

  // Construire l'arbre
  const rootNodes: MemoryNode[] = [];
  const nodeMap = new Map<number, MemoryNode>();

  for (const node of nodes) {
    node.children = [];
    nodeMap.set(node.id!, node);
  }

  for (const node of nodes) {
    if (node.parent_id && nodeMap.has(node.parent_id)) {
      const parent = nodeMap.get(node.parent_id)!;
      parent.children = parent.children || [];
      parent.children.push(node);
    } else if (!node.parent_id) {
      rootNodes.push(node);
    }
  }

  // Trier les enfants par sort_order
  for (const node of nodes) {
    if (node.children) {
      node.children.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  }

  return rootNodes.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

export async function updateNode(
  db: D1Database,
  nodeId: number,
  updates: Partial<Pick<MemoryNode, 'title' | 'description' | 'content' | 'category' | 'confidence' | 'parent_id' | 'sort_order' | 'is_expanded' | 'is_archived' | 'node_type'>>
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.title !== undefined) { sets.push('title = ?'); values.push(updates.title); }
  if (updates.description !== undefined) { sets.push('description = ?'); values.push(updates.description); }
  if (updates.content !== undefined) { sets.push('content = ?'); values.push(JSON.stringify(updates.content)); }
  if (updates.category !== undefined) { sets.push('category = ?'); values.push(updates.category); }
  if (updates.confidence !== undefined) { sets.push('confidence = ?'); values.push(updates.confidence); }
  if (updates.parent_id !== undefined) { sets.push('parent_id = ?'); values.push(updates.parent_id); }
  if (updates.sort_order !== undefined) { sets.push('sort_order = ?'); values.push(updates.sort_order); }
  if (updates.is_expanded !== undefined) { sets.push('is_expanded = ?'); values.push(updates.is_expanded); }
  if (updates.is_archived !== undefined) { sets.push('is_archived = ?'); values.push(updates.is_archived); }
  if (updates.node_type !== undefined) { sets.push('node_type = ?'); values.push(updates.node_type); }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(nodeId);
    await db.prepare(`UPDATE memory_nodes SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values).run();
  }
}

export async function deleteNode(db: D1Database, nodeId: number): Promise<void> {
  // Soft delete : archiver le nœud et ses enfants
  await db.prepare('UPDATE memory_nodes SET is_archived = 1 WHERE id = ?')
    .bind(nodeId).run();

  // Archiver récursivement les enfants
  await db.prepare(`
    UPDATE memory_nodes SET is_archived = 1
    WHERE id IN (
      WITH RECURSIVE children(id) AS (
        SELECT id FROM memory_nodes WHERE parent_id = ?
        UNION ALL
        SELECT n.id FROM memory_nodes n JOIN children c ON n.parent_id = c.id
      )
      SELECT id FROM children
    )
  `).bind(nodeId).run();
}

// ============================================================
// RELATIONS
// ============================================================

export async function createRelation(
  db: D1Database,
  relation: Omit<MemoryRelation, 'id' | 'created_at'>
): Promise<MemoryRelation> {
  // Vérifier que les deux nœuds existent
  const source = await db.prepare('SELECT user_id FROM memory_nodes WHERE id = ? AND is_archived = 0')
    .bind(relation.source_node_id).first<{ user_id: string }>();
  const target = await db.prepare('SELECT user_id FROM memory_nodes WHERE id = ? AND is_archived = 0')
    .bind(relation.target_node_id).first<{ user_id: string }>();

  if (!source || !target) {
    throw new Error('Un des nœuds n\'existe pas');
  }

  const result = await db.prepare(`
    INSERT OR IGNORE INTO memory_relations
      (user_id, source_node_id, target_node_id, relation_type, strength, description, source)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    relation.user_id, relation.source_node_id, relation.target_node_id,
    relation.relation_type, relation.strength, relation.description || null,
    relation.source
  ).run();

  return {
    ...relation,
    id: result.meta.last_row_id as number,
    created_at: new Date().toISOString(),
  };
}

export async function getRelations(db: D1Database, userId: string): Promise<MemoryRelation[]> {
  const result = await db.prepare(
    'SELECT * FROM memory_relations WHERE user_id = ?'
  ).bind(userId).all<MemoryRelation>();
  return result.results;
}

export async function getNodeRelations(db: D1Database, nodeId: number): Promise<MemoryRelation[]> {
  const result = await db.prepare(
    'SELECT * FROM memory_relations WHERE source_node_id = ? OR target_node_id = ?'
  ).bind(nodeId, nodeId).all<MemoryRelation>();

  // Charger les noms des nœuds liés
  const enriched: MemoryRelation[] = [];
  for (const rel of result.results) {
    const otherId = rel.source_node_id === nodeId ? rel.target_node_id : rel.source_node_id;
    const otherNode = await db.prepare(
      'SELECT id, title, category FROM memory_nodes WHERE id = ?'
    ).bind(otherId).first<{ id: number; title: string; category: CategoryKey }>();

    enriched.push({
      ...rel,
      source_node: rel.source_node_id === nodeId
        ? { id: nodeId, title: '', category: '' as CategoryKey, depth: 0, sort_order: 0, confidence: 0, source: 'system', node_type: 'concept', is_expanded: 1, is_archived: 0, content: {}, user_id: '' } as MemoryNode
        : undefined,
      target_node: rel.target_node_id === nodeId
        ? { id: nodeId, title: '', category: '' as CategoryKey, depth: 0, sort_order: 0, confidence: 0, source: 'system', node_type: 'concept', is_expanded: 1, is_archived: 0, content: {}, user_id: '' } as MemoryNode
        : undefined,
    });
  }
  return enriched;
}

export async function deleteRelation(db: D1Database, relationId: number): Promise<void> {
  await db.prepare('DELETE FROM memory_relations WHERE id = ?').bind(relationId).run();
}

// ============================================================
// TAGS
// ============================================================

export async function getOrCreateTag(
  db: D1Database,
  userId: string,
  tagName: string
): Promise<MemoryTag> {
  const existing = await db.prepare(
    'SELECT * FROM memory_tags WHERE user_id = ? AND name = ?'
  ).bind(userId, tagName.toLowerCase()).first<MemoryTag>();

  if (existing) return existing;

  const colors = ['#E74C3C', '#2ECC71', '#3498DB', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#6366F1'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];

  const result = await db.prepare(
    'INSERT INTO memory_tags (user_id, name, color) VALUES (?, ?, ?)'
  ).bind(userId, tagName.toLowerCase(), randomColor).run();

  return {
    id: result.meta.last_row_id as number,
    user_id: userId,
    name: tagName.toLowerCase(),
    color: randomColor,
  };
}

export async function tagNode(
  db: D1Database,
  nodeId: number,
  tagId: number
): Promise<void> {
  await db.prepare('INSERT OR IGNORE INTO memory_node_tags (node_id, tag_id) VALUES (?, ?)')
    .bind(nodeId, tagId).run();
}

export async function untagNode(
  db: D1Database,
  nodeId: number,
  tagId: number
): Promise<void> {
  await db.prepare('DELETE FROM memory_node_tags WHERE node_id = ? AND tag_id = ?')
    .bind(nodeId, tagId).run();
}

export async function getNodeTags(db: D1Database, nodeId: number): Promise<MemoryTag[]> {
  const result = await db.prepare(`
    SELECT t.* FROM memory_tags t
    JOIN memory_node_tags nt ON t.id = nt.tag_id
    WHERE nt.node_id = ?
  `).bind(nodeId).all<MemoryTag>();
  return result.results;
}

export async function getUserTags(db: D1Database, userId: string): Promise<MemoryTag[]> {
  const result = await db.prepare(
    'SELECT * FROM memory_tags WHERE user_id = ? ORDER BY name'
  ).bind(userId).all<MemoryTag>();
  return result.results;
}

// ============================================================
// SESSIONS (adaptées V2)
// ============================================================

export async function getOrCreateSessionV2(
  db: D1Database,
  sessionId: string,
  userId?: string
): Promise<{ id: string; name: string; status: string }> {
  const existing = await db.prepare('SELECT * FROM sessions WHERE id = ?')
    .bind(sessionId).first<{ id: string; name: string; status: string; user_id?: string }>();

  if (existing) {
    if (userId && !existing.user_id) {
      await db.prepare('UPDATE sessions SET user_id = ? WHERE id = ?')
        .bind(userId, sessionId).run();
    }
    await db.prepare('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(sessionId).run();
    return existing;
  }

  await db.prepare(
    'INSERT OR IGNORE INTO sessions (id, name, status, user_id) VALUES (?, ?, ?, ?)'
  ).bind(sessionId, 'Explorateur', 'active', userId || null).run();

  await db.prepare(
    'INSERT OR IGNORE INTO session_state (session_id, current_phase) VALUES (?, ?)'
  ).bind(sessionId, 'amorcage').run();

  return { id: sessionId, name: 'Explorateur', status: 'active' };
}

// ============================================================
// STATISTIQUES & EXPORT
// ============================================================

export async function getMemoryStats(db: D1Database, userId: string): Promise<{
  total_nodes: number;
  total_relations: number;
  by_category: Record<string, number>;
  by_type: Record<string, number>;
  avg_confidence: number;
  deepest_branch: number;
}> {
  const stats = await db.prepare(`
    SELECT
      COUNT(*) as total_nodes,
      AVG(confidence) as avg_confidence,
      MAX(depth) as deepest_branch
    FROM memory_nodes WHERE user_id = ? AND is_archived = 0
  `).bind(userId).first<{ total_nodes: number; avg_confidence: number; deepest_branch: number }>();

  const relationCount = await db.prepare(
    'SELECT COUNT(*) as count FROM memory_relations WHERE user_id = ?'
  ).bind(userId).first<{ count: number }>();

  const byCategory = await db.prepare(`
    SELECT category, COUNT(*) as count FROM memory_nodes
    WHERE user_id = ? AND is_archived = 0
    GROUP BY category
  `).bind(userId).all<{ category: string; count: number }>();

  const byType = await db.prepare(`
    SELECT node_type, COUNT(*) as count FROM memory_nodes
    WHERE user_id = ? AND is_archived = 0
    GROUP BY node_type
  `).bind(userId).all<{ node_type: string; count: number }>();

  return {
    total_nodes: stats?.total_nodes ?? 0,
    total_relations: relationCount?.count ?? 0,
    by_category: Object.fromEntries(byCategory.results.map(r => [r.category, r.count])),
    by_type: Object.fromEntries(byType.results.map(r => [r.node_type, r.count])),
    avg_confidence: Math.round((stats?.avg_confidence ?? 0) * 100) / 100,
    deepest_branch: stats?.deepest_branch ?? 0,
  };
}

export async function exportMemory(
  db: D1Database,
  userId: string
): Promise<MemoryExport> {
  const user = await db.prepare(
    'SELECT id, email, display_name, avatar_url FROM users WHERE id = ?'
  ).bind(userId).first();

  const nodes = await getNodesByUser(db, userId);
  const relations = await getRelations(db, userId);
  const tags = await getUserTags(db, userId);
  const sessions = await db.prepare(
    'SELECT * FROM sessions WHERE user_id = ?'
  ).bind(userId).all();

  return {
    user: user as any,
    tree: nodes,
    relations,
    tags,
    sessions: sessions.results as any,
    exported_at: new Date().toISOString(),
  };
}

// ============================================================
// CONTEXTE POUR L'IA (format arborescent ENRICHI)
// ============================================================

export function buildMemoryContextForAI(
  tree: MemoryNode[],
  relations: MemoryRelation[]
): string {
  const totalNodes = countAllNodes(tree);
  const categories = countByCategory(tree);
  const types = countByType(tree);

  let ctx = `╔══════════════════════════════════════╗\n`;
  ctx += `║  MÉMOIRE ARBORESCENTE               ║\n`;
  ctx += `╠══════════════════════════════════════╣\n`;
  ctx += `║ Nœuds : ${String(totalNodes).padEnd(30)}║\n`;
  ctx += `║ ❤️:${String(categories.passion || 0)} 🌍:${String(categories.mission || 0)} 💰:${String(categories.vocation || 0)} 🎯:${String(categories.profession || 0)}      ║\n`;
  ctx += `║ Relations : ${String(relations.length).padEnd(26)}║\n`;
  ctx += `╚══════════════════════════════════════╝\n\n`;

  ctx += `--- ARBRE DE CONSCIENCE ---\n\n`;

  function renderNode(node: MemoryNode, indent: number = 0): string {
    const prefix = '  '.repeat(indent);
    const emoji = getNodeTypeEmoji(node.node_type);
    const catEmoji = getCategoryEmoji(node.category);
    const confBar = node.confidence > 0.8 ? '●●●' : node.confidence > 0.5 ? '●●○' : '●○○';
    let line = `${prefix}${emoji} [${catEmoji}] ${node.title} (${confBar})\n`;

    // Ajouter métadonnées riches si présentes
    if (node.description && node.description.length > 0) {
      line += `${prefix}   📝 ${node.description.substring(0, 120)}\n`;
    }

    // Extraire les infos clés du NodeContent
    if (node.content && typeof node.content === 'object') {
      const c = node.content as any;
      if (c.keywords && c.keywords.length > 0) {
        line += `${prefix}   🔑 ${c.keywords.slice(0, 5).join(', ')}\n`;
      }
      if (c.proficiency_level) {
        line += `${prefix}   📊 Niveau: ${c.proficiency_level}`;
        if (c.years_experience) line += ` · ${c.years_experience} an(s)`;
        line += `\n`;
      }
      if (c.project_status) {
        line += `${prefix}   📦 Statut: ${c.project_status}\n`;
      }
      if (c.emotional_impact) {
        line += `${prefix}   💫 Impact: ${c.emotional_impact}\n`;
      }
      if (c.priority) {
        line += `${prefix}   ⭐ Priorité: ${c.priority}/10\n`;
      }
      if (c.intensity) {
        line += `${prefix}   😰 Intensité: ${c.intensity}/10`;
        if (c.is_overcome) line += ` · Surmontée`;
        line += `\n`;
      }
      if (c.actionable_takeaway) {
        line += `${prefix}   💡 "${c.actionable_takeaway.substring(0, 100)}"\n`;
      }
    }

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        line += renderNode(child, indent + 1);
      }
    }
    return line;
  }

  for (const root of tree) {
    ctx += renderNode(root);
  }

  // Relations enrichies
  if (relations.length > 0) {
    ctx += '\n--- CONNEXIONS ENTRE NŒUDS ---\n';
    const shown = new Set<string>();
    for (const rel of relations) {
      const key = [rel.source_node_id, rel.target_node_id, rel.relation_type].sort().join('-');
      if (shown.has(key)) continue;
      shown.add(key);

      const emoji = getRelationEmoji(rel.relation_type as RelationType);
      const desc = rel.description ? ` — ${rel.description.substring(0, 80)}` : '';
      ctx += `${emoji} ${rel.relation_type} | force: ${Math.round(rel.strength * 100)}%${desc}\n`;
    }
  }

  return ctx;
}

// ===== HELPERS pour buildMemoryContextForAI =====

function countAllNodes(tree: MemoryNode[]): number {
  let count = 0;
  for (const node of tree) {
    count++;
    if (node.children) count += countAllNodes(node.children);
  }
  return count;
}

function countByCategory(tree: MemoryNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  function walk(nodes: MemoryNode[]) {
    for (const n of nodes) {
      counts[n.category] = (counts[n.category] || 0) + 1;
      if (n.children) walk(n.children);
    }
  }
  walk(tree);
  return counts;
}

function countByType(tree: MemoryNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  function walk(nodes: MemoryNode[]) {
    for (const n of nodes) {
      counts[n.node_type] = (counts[n.node_type] || 0) + 1;
      if (n.children) walk(n.children);
    }
  }
  walk(tree);
  return counts;
}

function getNodeTypeEmoji(type: NodeType): string {
  const emojis: Record<NodeType, string> = {
    concept: '💭', project: '📦', experience: '🌟', skill: '🔧',
    value: '💎', goal: '🎯', fear: '😰', story: '📖', insight: '💡',
  };
  return emojis[type] || '📌';
}

function getCategoryEmoji(cat: string): string {
  const emojis: Record<string, string> = {
    passion: '❤️', mission: '🌍', vocation: '💰', profession: '🎯',
  };
  return emojis[cat] || '📌';
}

function getRelationEmoji(type: RelationType): string {
  const emojis: Record<RelationType, string> = {
    nourrit: '🌱', contraste_avec: '⚡', decoule_de: '🔄', renforce: '💪',
    contredit: '⚠️', inspire: '💡', collabore_avec: '🤝', est_une_sous_partie_de: '🧩',
  };
  return emojis[type] || '🔗';
}
