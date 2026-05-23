/**
 * Couche d'accès à la base de données D1
 * Gère les sessions, éléments Ikigai, messages et état
 */

import type { Bindings, Session, SessionState, IkigaiElement, Message, PhaseType } from '../types';

/**
 * Crée une nouvelle session
 */
export async function createSession(db: D1Database, sessionId: string): Promise<Session> {
  const session: Session = {
    id: sessionId,
    name: 'Explorateur',
    status: 'active',
  };

  await db.prepare(
    'INSERT OR IGNORE INTO sessions (id, name, status) VALUES (?, ?, ?)'
  ).bind(session.id, session.name, session.status).run();

  // Créer l'état initial
  await db.prepare(
    'INSERT OR IGNORE INTO session_state (session_id, current_phase) VALUES (?, ?)'
  ).bind(sessionId, 'amorcage').run();

  return session;
}

/**
 * Récupère ou crée une session
 */
export async function getOrCreateSession(db: D1Database, sessionId: string): Promise<Session> {
  const existing = await db.prepare(
    'SELECT * FROM sessions WHERE id = ?'
  ).bind(sessionId).first<Session>();

  if (existing) {
    // Mettre à jour le timestamp
    await db.prepare(
      'UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(sessionId).run();
    return existing;
  }

  return createSession(db, sessionId);
}

/**
 * Récupère l'état de la session
 */
export async function getSessionState(db: D1Database, sessionId: string): Promise<SessionState> {
  const state = await db.prepare(
    'SELECT * FROM session_state WHERE session_id = ?'
  ).bind(sessionId).first<SessionState>();

  if (!state) {
    const defaultState: SessionState = {
      session_id: sessionId,
      current_phase: 'amorcage',
      completed_categories: [],
      interaction_count: 0,
    };
    await db.prepare(
      'INSERT OR IGNORE INTO session_state (session_id, current_phase, completed_categories, interaction_count) VALUES (?, ?, ?, ?)'
    ).bind(sessionId, 'amorcage', '[]', 0).run();
    return defaultState;
  }

  return state;
}

/**
 * Met à jour l'état de la session
 */
export async function updateSessionState(
  db: D1Database,
  sessionId: string,
  updates: Partial<SessionState>
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.current_phase !== undefined) {
    sets.push('current_phase = ?');
    values.push(updates.current_phase);
  }
  if (updates.completed_categories !== undefined) {
    sets.push('completed_categories = ?');
    values.push(JSON.stringify(updates.completed_categories));
  }
  if (updates.interaction_count !== undefined) {
    sets.push('interaction_count = ?');
    values.push(updates.interaction_count);
  }
  if (updates.last_web_search !== undefined) {
    sets.push('last_web_search = ?');
    values.push(updates.last_web_search);
  }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(sessionId);
    await db.prepare(
      `UPDATE session_state SET ${sets.join(', ')} WHERE session_id = ?`
    ).bind(...values).run();
  }
}

/**
 * Ajoute un élément Ikigai
 */
export async function addElement(
  db: D1Database,
  element: IkigaiElement
): Promise<IkigaiElement> {
  const result = await db.prepare(
    `INSERT INTO ikigai_elements (session_id, content, category, confidence, source, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    element.session_id,
    element.content,
    element.category,
    element.confidence,
    element.source,
    element.notes || null
  ).run();

  return { ...element, id: result.meta.last_row_id };
}

/**
 * Récupère tous les éléments d'une session
 */
export async function getElements(
  db: D1Database,
  sessionId: string
): Promise<IkigaiElement[]> {
  const result = await db.prepare(
    'SELECT * FROM ikigai_elements WHERE session_id = ? ORDER BY created_at ASC'
  ).bind(sessionId).all<IkigaiElement>();

  return result.results;
}

/**
 * Met à jour un élément (catégorie, contenu, etc.)
 */
export async function updateElement(
  db: D1Database,
  elementId: number,
  updates: Partial<Pick<IkigaiElement, 'content' | 'category' | 'confidence' | 'notes'>>
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) {
    sets.push('content = ?');
    values.push(updates.content);
  }
  if (updates.category !== undefined) {
    sets.push('category = ?');
    values.push(updates.category);
  }
  if (updates.confidence !== undefined) {
    sets.push('confidence = ?');
    values.push(updates.confidence);
  }
  if (updates.notes !== undefined) {
    sets.push('notes = ?');
    values.push(updates.notes);
  }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(elementId);
    await db.prepare(
      `UPDATE ikigai_elements SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...values).run();
  }
}

/**
 * Supprime un élément
 */
export async function deleteElement(db: D1Database, elementId: number): Promise<void> {
  await db.prepare('DELETE FROM ikigai_elements WHERE id = ?').bind(elementId).run();
}

/**
 * Ajoute un message à l'historique
 */
export async function addMessage(
  db: D1Database,
  message: Message
): Promise<Message> {
  const result = await db.prepare(
    `INSERT INTO messages (session_id, role, content, phase)
     VALUES (?, ?, ?, ?)`
  ).bind(
    message.session_id,
    message.role,
    message.content,
    message.phase || null
  ).run();

  return { ...message, id: result.meta.last_row_id };
}

/**
 * Récupère les messages récents d'une session
 */
export async function getRecentMessages(
  db: D1Database,
  sessionId: string,
  limit: number = 20
): Promise<Message[]> {
  const result = await db.prepare(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
  ).bind(sessionId, limit).all<Message>();

  return result.results.reverse();
}

/**
 * Récupère l'état complet de la session
 */
export async function getFullSessionState(
  db: D1Database,
  sessionId: string
): Promise<{ session: Session; state: SessionState; elements: IkigaiElement[]; recentMessages: Message[] }> {
  const session = await getOrCreateSession(db, sessionId);
  const state = await getSessionState(db, sessionId);
  const elements = await getElements(db, sessionId);
  const recentMessages = await getRecentMessages(db, sessionId);

  return { session, state, elements, recentMessages };
}

/**
 * Supprime les anciennes sessions (cleanup)
 */
export async function cleanupOldSessions(db: D1Database, daysOld: number = 30): Promise<void> {
  await db.prepare(
    `DELETE FROM sessions WHERE updated_at < datetime('now', '-' || ? || ' days')`
  ).bind(daysOld).run();
}
