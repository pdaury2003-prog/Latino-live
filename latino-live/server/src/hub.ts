/**
 * Canal en vivo. Cada persona tiene una sesión autenticada; las mesas de salón
 * se difunden a la sala y el casino solo viaja al teléfono de su jugador.
 */

import type { WebSocket } from 'ws';
import { GameService, type Actor } from './service.ts';
import type { ClientMessage, ServerMessage, TableView } from './protocol.ts';

type Session = {
  socket: WebSocket;
  actor: Actor;
  roomId: string | null;
  alive: boolean;
  windowStart: number;
  messages: number;
};

const WINDOW_MS = 10_000;
const MAX_MESSAGES = 40;

export class GameHub {
  private readonly sessions = new Map<WebSocket, Session>();
  private readonly service: GameService;

  constructor(service: GameService) {
    this.service = service;
  }

  get size(): number {
    return this.sessions.size;
  }

  attach(socket: WebSocket, actor: Actor): void {
    const session: Session = {
      socket,
      actor,
      roomId: null,
      alive: true,
      windowStart: Date.now(),
      messages: 0,
    };
    this.sessions.set(socket, session);
    this.send(session, {
      type: 'ready',
      userId: actor.userId,
      name: actor.name,
      casino: this.service.casinoEnabled,
    });
    socket.on('message', data => void this.receive(session, data.toString()));
    socket.on('pong', () => {
      session.alive = true;
    });
    socket.on('close', () => this.detach(session));
    socket.on('error', () => this.detach(session));
  }

  heartbeat(): void {
    for (const session of this.sessions.values()) {
      if (!session.alive) {
        session.socket.terminate();
        continue;
      }
      session.alive = false;
      try {
        session.socket.ping();
      } catch {
        session.socket.terminate();
      }
    }
  }

  async sweep(): Promise<void> {
    await this.service.sweep();
  }

  async receive(session: Session, raw: string): Promise<void> {
    if (raw.length > 32_768) {
      this.fail(session, 'message_too_big', 'El mensaje es demasiado grande.');
      return;
    }
    const now = Date.now();
    if (now - session.windowStart > WINDOW_MS) {
      session.windowStart = now;
      session.messages = 0;
    }
    session.messages += 1;
    if (session.messages > MAX_MESSAGES) {
      this.fail(session, 'slow_down', 'Demasiadas acciones seguidas.');
      return;
    }

    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      this.fail(session, 'bad_message', 'El mensaje no se entiende.');
      return;
    }
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') {
      this.fail(session, 'bad_message', 'Falta el tipo de mensaje.');
      return;
    }

    try {
      switch (message.type) {
        case 'ping':
          this.send(session, { type: 'pong', at: now });
          return;
        case 'hello':
          if (message.roomId) await this.joinRoom(session, message.roomId);
          return;
        case 'room.join':
          await this.joinRoom(session, String(message.roomId));
          return;
        case 'room.leave':
          await this.leaveRoom(session);
          return;
        case 'table.create': {
          if (typeof message.kind !== 'string') throw new Error('Falta el juego.');
          const table = await this.service.create(session.actor, {
            kind: message.kind,
            roomId: message.roomId ?? session.roomId,
            seats: Array.isArray(message.seats) ? message.seats.filter(item => typeof item === 'string') : [],
            stake: typeof message.stake === 'number' ? message.stake : 0,
            options: message.options,
          });
          await this.broadcastTable(table, [{ type: 'table_created' }]);
          return;
        }
        case 'table.ready': {
          const table = await this.service.ready(session.actor, String(message.tableId));
          await this.broadcastTable(table, [{ type: 'table_ready' }]);
          return;
        }
        case 'table.action': {
          const table = await this.service.act(session.actor, String(message.tableId), message.action);
          await this.broadcastTable(table, [{ type: 'table_action' }]);
          return;
        }
        case 'table.get': {
          const table = this.service.get(String(message.tableId), session.actor.userId);
          this.send(session, { type: 'table.state', table });
          return;
        }
        case 'table.list': {
          this.send(session, { type: 'table.list', tables: this.service.list(session.roomId, session.actor.userId) });
          return;
        }
        default:
          this.fail(session, 'unknown_message', 'Ese mensaje no existe.');
      }
    } catch (error) {
      this.fail(session, 'rejected', error instanceof Error ? error.message : 'No se pudo hacer eso.');
    }
  }

  private async joinRoom(session: Session, roomId: string): Promise<void> {
    if (!roomId) throw new Error('Falta la sala.');
    const allowed = await this.service.canAccessRoom(roomId, session.actor.userId);
    if (!allowed) throw new Error('No estás en esa sala.');
    session.roomId = roomId;
    this.send(session, { type: 'table.list', tables: this.service.list(roomId, session.actor.userId) });
    this.broadcastPresence(roomId);
  }

  private async leaveRoom(session: Session): Promise<void> {
    const roomId = session.roomId;
    session.roomId = null;
    if (roomId) this.broadcastPresence(roomId);
  }

  private async broadcastTable(table: TableView, events: Array<Record<string, unknown>>): Promise<void> {
    for (const session of this.sessions.values()) {
      if (table.visibility === 'private') {
        if (!table.seats.some(seat => seat.userId === session.actor.userId)) continue;
      } else if (table.roomId === null || session.roomId !== table.roomId) {
        continue;
      }
      try {
        const view = this.service.get(table.id, session.actor.userId);
        this.send(session, { type: 'table.state', table: view, events });
      } catch {
        // La mesa pudo cerrarse entre la acción y el envío.
      }
    }
  }

  private broadcastPresence(roomId: string): void {
    const users = new Map<string, string>();
    for (const session of this.sessions.values()) {
      if (session.roomId === roomId) users.set(session.actor.userId, session.actor.name);
    }
    const payload: ServerMessage = {
      type: 'presence',
      roomId,
      users: [...users.entries()].map(([userId, name]) => ({ userId, name })),
    };
    for (const session of this.sessions.values()) {
      if (session.roomId === roomId) this.send(session, payload);
    }
  }

  private detach(session: Session): void {
    if (!this.sessions.delete(session.socket)) return;
    if (session.roomId) this.broadcastPresence(session.roomId);
  }

  private send(session: Session, message: ServerMessage): void {
    if (session.socket.readyState !== 1) return;
    try {
      session.socket.send(JSON.stringify(message));
    } catch {
      session.socket.terminate();
    }
  }

  private fail(session: Session, code: string, message: string): void {
    this.send(session, { type: 'error', code, message });
  }
}
