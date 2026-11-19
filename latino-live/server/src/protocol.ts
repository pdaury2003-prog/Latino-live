/** Mensajes entre la app y el servidor de juegos. */

import type { GameAction, GameKind, GameState, GameVisibility } from '../../packages/games/src/index.ts';
import type { Seat } from '../../packages/games/src/types.ts';

export type ClientHello = { type: 'hello'; roomId?: string | null };

export type ClientMessage =
  | ClientHello
  | { type: 'room.join'; roomId: string }
  | { type: 'room.leave' }
  | {
    type: 'table.create';
    kind: GameKind;
    roomId?: string | null;
    seats?: string[];
    stake?: number;
    options?: Record<string, unknown>;
  }
  | { type: 'table.ready'; tableId: string }
  | { type: 'table.action'; tableId: string; action: GameAction }
  | { type: 'table.get'; tableId: string }
  | { type: 'table.list' }
  | { type: 'ping' };

export type TableView = {
  id: string;
  roomId: string | null;
  kind: GameKind;
  visibility: GameVisibility;
  ownerId: string;
  status: 'waiting' | 'playing' | 'finished';
  seats: Seat[];
  version: number;
  stake: number;
  state: GameState | null;
  ready: string[];
  yourSeat: number | null;
};

export type ServerMessage =
  | { type: 'ready'; userId: string; name: string; casino: boolean }
  | { type: 'table.state'; table: TableView; events?: Array<Record<string, unknown>> }
  | { type: 'table.list'; tables: TableView[] }
  | { type: 'presence'; roomId: string; users: Array<{ userId: string; name: string }> }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong'; at: number };
