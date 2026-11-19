/**
 * Puente con PostgREST. Las funciones `game_*` son las únicas que mueven
 * diamantes y solo aceptan la llave de servicio.
 */

import type { GameStore, OpenTableInput } from './service.ts';

type FetchLike = typeof fetch;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): string {
  if (!UUID.test(value)) throw new Error(`Identificador inválido: ${label}`);
  return value;
}

export class SupabaseStore implements GameStore {
  private readonly url: string;
  private readonly key: string;
  private readonly fetchImpl: FetchLike;

  constructor(url: string, serviceKey: string, fetchImpl: FetchLike = fetch) {
    this.url = url.replace(/\/$/, '');
    this.key = serviceKey;
    this.fetchImpl = fetchImpl;
  }

  private headers(): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
    };
  }

  private async rpc(name: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(args),
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try {
        const parsed = JSON.parse(text) as { message?: string; details?: string };
        message = parsed.message ?? parsed.details ?? text;
      } catch {
        // El cuerpo no era JSON: se muestra tal cual, sin secretos.
      }
      throw new Error(message || `La base rechazó ${name}`);
    }
    return text ? JSON.parse(text) : null;
  }

  private async rows<T>(path: string): Promise<T[]> {
    const response = await this.fetchImpl(`${this.url}/rest/v1/${path}`, { headers: this.headers() });
    if (!response.ok) throw new Error(await response.text());
    return (await response.json()) as T[];
  }

  async openTable(input: OpenTableInput): Promise<string> {
    const id = await this.rpc('game_open_table', {
      p_room: input.roomId,
      p_kind: input.kind,
      p_visibility: input.visibility,
      p_owner: input.ownerId,
      p_seats: input.seats,
      p_state: input.state,
      p_stake: input.stake,
    });
    if (typeof id !== 'string') throw new Error('La base no devolvió la mesa.');
    return id;
  }

  async saveTable(
    id: string,
    state: unknown,
    status: 'playing' | 'finished',
    stake: number,
    version: number,
  ): Promise<number> {
    const next = await this.rpc('game_save_table', {
      p_table: assertUuid(id, 'mesa'),
      p_state: state,
      p_status: status,
      p_stake: stake,
      p_version: version,
    });
    if (typeof next !== 'number') throw new Error('La base no confirmó la jugada.');
    return next;
  }

  async charge(tableId: string, userId: string, total: number): Promise<number> {
    const balance = await this.rpc('game_charge', {
      p_table: assertUuid(tableId, 'mesa'),
      p_user: assertUuid(userId, 'persona'),
      p_total: Math.max(0, Math.round(total)),
    });
    return typeof balance === 'number' ? balance : 0;
  }

  async credit(tableId: string, userId: string, total: number): Promise<number> {
    const balance = await this.rpc('game_credit', {
      p_table: assertUuid(tableId, 'mesa'),
      p_user: assertUuid(userId, 'persona'),
      p_total: Math.max(0, Math.round(total)),
    });
    return typeof balance === 'number' ? balance : 0;
  }

  async people(ids: string[]): Promise<Map<string, string>> {
    const clean = ids.filter(id => UUID.test(id));
    if (clean.length === 0) return new Map();
    const list = await this.rows<{ id: string; display_name: string }>(
      `profiles?id=in.(${clean.join(',')})&select=id,display_name`,
    );
    return new Map(list.map(row => [row.id, row.display_name]));
  }

  async roomMembers(roomId: string): Promise<Set<string>> {
    const id = assertUuid(roomId, 'sala');
    const [seats, hosts] = await Promise.all([
      this.rows<{ user_id: string }>(`room_seats?room_id=eq.${id}&select=user_id`),
      this.rows<{ host_id: string }>(`rooms?id=eq.${id}&select=host_id`),
    ]);
    const members = new Set(seats.map(row => row.user_id));
    for (const host of hosts) members.add(host.host_id);
    return members;
  }
}
