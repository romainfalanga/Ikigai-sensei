/**
 * Module d'authentification
 * Gère les comptes utilisateurs, JWT, login/register
 */

import type { User, AuthPayload } from '../types';

const COOKIE_NAME = 'ikigai_token';
const TOKEN_DURATION = 7 * 24 * 60 * 60; // 7 jours en secondes

/**
 * Hash un mot de passe avec SHA-256 (compatible Web Crypto)
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Vérifie un mot de passe
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashed = await hashPassword(password);
  return hashed === hash;
}

/**
 * Crée un token JWT simple (HS256-like avec Web Crypto)
 * Format: header.payload.signature
 */
export async function createToken(payload: AuthPayload, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + TOKEN_DURATION,
  };

  const headerB64 = btoaUrl(JSON.stringify(header));
  const payloadB64 = btoaUrl(JSON.stringify(tokenPayload));
  const signature = await sign(`${headerB64}.${payloadB64}`, secret);

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * Vérifie et décode un token JWT
 */
export async function verifyToken(token: string, secret: string): Promise<AuthPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signature] = parts;

    // Vérifier la signature
    const expectedSig = await sign(`${headerB64}.${payloadB64}`, secret);
    if (signature !== expectedSig) return null;

    // Décoder le payload
    const payload = JSON.parse(atobUrl(payloadB64)) as AuthPayload & { exp: number };

    // Vérifier l'expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { userId: payload.userId, email: payload.email };
  } catch {
    return null;
  }
}

/**
 * Enregistre un nouvel utilisateur
 */
export async function registerUser(
  db: D1Database,
  email: string,
  password: string,
  displayName: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  // Validation basique
  if (!email || !password || password.length < 6) {
    return { success: false, error: 'Email requis et mot de passe (6 caractères minimum)' };
  }
  if (!isValidEmail(email)) {
    return { success: false, error: 'Format d\'email invalide' };
  }

  // Vérifier si l'email existe déjà
  const existing = await db.prepare('SELECT id FROM users WHERE email = ?')
    .bind(email.toLowerCase().trim())
    .first<{ id: string }>();

  if (existing) {
    return { success: false, error: 'Un compte avec cet email existe déjà' };
  }

  // Créer l'utilisateur
  const userId = crypto.randomUUID();
  const passwordHash = await hashPassword(password);

  await db.prepare(
    'INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)'
  ).bind(userId, email.toLowerCase().trim(), passwordHash, displayName.trim() || 'Explorateur').run();

  const user: User = {
    id: userId,
    email: email.toLowerCase().trim(),
    display_name: displayName.trim() || 'Explorateur',
  };

  return { success: true, user };
}

/**
 * Authentifie un utilisateur
 */
export async function loginUser(
  db: D1Database,
  email: string,
  password: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  const user = await db.prepare(
    'SELECT id, email, password_hash, display_name, avatar_url FROM users WHERE email = ?'
  ).bind(email.toLowerCase().trim()).first<User & { password_hash: string }>();

  if (!user) {
    return { success: false, error: 'Email ou mot de passe incorrect' };
  }

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return { success: false, error: 'Email ou mot de passe incorrect' };
  }

  // Mettre à jour la date de dernière connexion
  await db.prepare('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?')
    .bind(user.id).run();

  const { password_hash, ...safeUser } = user;
  return { success: true, user: safeUser };
}

/**
 * Récupère un utilisateur par ID
 */
export async function getUserById(db: D1Database, userId: string): Promise<User | null> {
  const user = await db.prepare(
    'SELECT id, email, display_name, avatar_url, created_at, updated_at, last_login_at FROM users WHERE id = ?'
  ).bind(userId).first<User>();

  return user || null;
}

/**
 * Met à jour le profil utilisateur
 */
export async function updateUserProfile(
  db: D1Database,
  userId: string,
  updates: { display_name?: string; avatar_url?: string }
): Promise<void> {
  const sets: string[] = [];
  const values: any[] = [];

  if (updates.display_name !== undefined) {
    sets.push('display_name = ?');
    values.push(updates.display_name);
  }
  if (updates.avatar_url !== undefined) {
    sets.push('avatar_url = ?');
    values.push(updates.avatar_url);
  }

  if (sets.length > 0) {
    sets.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);
    await db.prepare(
      `UPDATE users SET ${sets.join(', ')} WHERE id = ?`
    ).bind(...values).run();
  }
}

/**
 * Récupère l'utilisateur depuis le cookie de session
 */
export async function getAuthFromCookie(
  request: Request,
  secret: string
): Promise<AuthPayload | null> {
  const cookieHeader = request.headers.get('Cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;

  return verifyToken(match[1], secret);
}

/**
 * Crée le cookie de session
 */
export function createSessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${TOKEN_DURATION}`;
}

/**
 * Cookie vide pour logout
 */
export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

// ===== HELPERS =====

async function sign(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoaUrl(String.fromCharCode(...new Uint8Array(signature)));
}

function btoaUrl(str: string): string {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function atobUrl(str: string): string {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
