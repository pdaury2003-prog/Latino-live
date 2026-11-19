/**
 * Cada conexión prueba quién es con el token de Supabase. El token nunca se
 * guarda en claro: se usa una huella para la caché de identidad.
 */

import { createHash } from 'node:crypto';
import type { Actor } from './service.ts';

type Cached = { actor: Actor; expiresAt: number };

export class Auth {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly cache = new Map<string, Cached>();
  private readonly ttl = 5 * 60_000;

  constructor(url: string, anonKey: string) {
    this.url = url.replace(/\/$/, '');
    this.anonKey = anonKey;
  }

  async identify(token: string): Promise<Actor> {
    if (!token) throw new Error('Falta el token.');
    const fingerprint = createHash('sha256').update(token).digest('hex');
    const cached = this.cache.get(fingerprint);
    if (cached && cached.expiresAt > Date.now()) return cached.actor;

    const response = await fetch(`${this.url}/auth/v1/user`, {
      headers: { apikey: this.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Tu sesión no es válida.');
    const user = (await response.json()) as {
      id?: string;
      email?: string;
      user_metadata?: { display_name?: string; name?: string };
    };
    if (!user.id) throw new Error('La cuenta no tiene identificador.');
    const fallback = user.email?.split('@')[0] ?? 'Jugador';
    const actor: Actor = {
      userId: user.id,
      name: String(user.user_metadata?.display_name ?? user.user_metadata?.name ?? fallback).slice(0, 24),
    };
    this.cache.set(fingerprint, { actor, expiresAt: Date.now() + this.ttl });
    if (this.cache.size > 5_000) this.cache.clear();
    return actor;
  }
}
