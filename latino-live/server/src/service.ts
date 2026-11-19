/**
 * Autoridad de las mesas. El motor calcula las reglas; este servicio decide
 * quién puede sentarse, cuándo se cobra y qué se guarda. Nada de esto corre en
 * el teléfono.
 */

import {
  applyGameAction,
  createGame,
  gameInfo,
  isGameOver,
  viewGame,
  type GameAction,
  type GameKind,
  type GameState,
  type Rng,
} from '../../packages/games/src/index.ts';
import { assertBet, DEFAULT_LIMITS, type BetLimits } from '../../packages/games/src/betting.ts';
import { cryptoRng } from '../../packages/games/src/rng.ts';
import { RuleError, type Seat } from '../../packages/games/src/types.ts';
import type { TableView } from './protocol.ts';

export type Actor = { userId: string; name: string };

export type OpenTableInput = {
  roomId: string | null;
  kind: GameKind;
  visibility: 'table' | 'private';
  ownerId: string;
  seats: Seat[];
  state: unknown;
  stake: number;
};

/** Lo que el servidor necesita de la base; las pruebas usan uno falso. */
export interface GameStore {
  openTable(input: OpenTableInput): Promise<string>;
  saveTable(
    id: string,
    state: unknown,
    status: 'playing' | 'finished',
    stake: number,
    version: number,
  ): Promise<number>;
  charge(tableId: string, userId: string, total: number): Promise<number>;
  credit(tableId: string, userId: string, total: number): Promise<number>;
  people(ids: string[]): Promise<Map<string, string>>;
  roomMembers(roomId: string): Promise<Set<string>>;
}

export type LiveTable = {
  id: string;
  roomId: string | null;
  kind: GameKind;
  visibility: 'table' | 'private';
  ownerId: string;
  status: 'waiting' | 'playing' | 'finished';
  seats: Seat[];
  state: GameState | null;
  version: number;
  stake: number;
  /** Lo apostado y lo pagado, por persona; la base también lo recuerda. */
  charged: Record<string, number>;
  credited: Record<string, number>;
  ready: Set<string>;
  createdAt: number;
};

export type CreateTableRequest = {
  kind: GameKind;
  roomId?: string | null;
  seats?: string[];
  stake?: number;
  options?: Record<string, unknown>;
};

export type ServiceOptions = {
  store?: GameStore | null;
  limits?: BetLimits;
  rng?: Rng;
  onChange?: (table: LiveTable, events: Array<Record<string, unknown>>) => void;
};

const WAITING_MS = 30 * 60_000;
const FINISHED_MS = 10 * 60_000;

function describe(error: unknown): string {
  if (error instanceof RuleError) return error.message;
  if (error instanceof Error) return error.message;
  return 'No se pudo completar la jugada.';
}

export class GameService {
  private readonly tables = new Map<string, LiveTable>();
  private readonly store: GameStore | null;
  private readonly limits: BetLimits;
  private readonly rng: Rng;
  private readonly onChange: (table: LiveTable, events: Array<Record<string, unknown>>) => void;
  private readonly pendingCredits = new Set<string>();

  constructor(options: ServiceOptions = {}) {
    this.store = options.store ?? null;
    this.limits = options.limits ?? DEFAULT_LIMITS;
    this.rng = options.rng ?? cryptoRng;
    this.onChange = options.onChange ?? (() => {});
  }

  get casinoEnabled(): boolean {
    return this.store !== null;
  }

  /** Para entrar al canal de una sala: en producción lo confirma la base. */
  async canAccessRoom(roomId: string, userId: string): Promise<boolean> {
    if (!this.store) return true;
    const members = await this.store.roomMembers(roomId);
    return members.has(userId);
  }

  list(roomId: string | null, viewer: string): TableView[] {
    return [...this.tables.values()]
      .filter(table => (
        table.status !== 'finished'
        && (
          table.visibility === 'private'
            ? table.ownerId === viewer
            : table.roomId !== null && table.roomId === roomId
        )
      ))
      .map(table => this.view(table, viewer));
  }

  get(tableId: string, viewer: string): TableView {
    return this.view(this.require(tableId), viewer);
  }

  async create(actor: Actor, request: CreateTableRequest): Promise<TableView> {
    const info = gameInfo(request.kind);
    const roomId = request.roomId ?? null;
    const ids = info.visibility === 'private'
      ? (info.maxPlayers > 1 ? [...new Set([actor.userId, ...(request.seats ?? [])])] : [actor.userId])
      : [...new Set(request.seats ?? [])];

    if (ids.length === 0 || !ids.includes(actor.userId)) {
      throw new RuleError('not_seated', 'Tienes que estar en la mesa para abrirla.');
    }
    if (ids.length < info.minPlayers) {
      throw new RuleError('not_enough_players', `${info.name} necesita ${info.minPlayers} jugadores.`);
    }
    if (ids.length > info.maxPlayers) {
      throw new RuleError('too_many_players', `${info.name} admite ${info.maxPlayers} jugadores.`);
    }
    if (info.visibility === 'table' && !roomId) {
      throw new RuleError('need_room', 'Abre la mesa dentro de una sala.');
    }
    if (info.visibility === 'private' && !this.store) {
      throw new RuleError('casino_disabled', 'El casino necesita la conexión del servidor.');
    }

    let names = new Map<string, string>();
    if (this.store) {
      if (roomId) {
        const members = await this.store.roomMembers(roomId);
        if (!members.has(actor.userId)) {
          throw new RuleError('not_in_room', 'No estás sentado en esa sala.');
        }
        const strangers = ids.filter(id => !members.has(id));
        if (strangers.length > 0) {
          throw new RuleError('not_in_room', 'Todos los jugadores tienen que estar en la sala.');
        }
      }
      names = await this.store.people(ids);
    }

    const seats: Seat[] = ids.map((userId, index) => ({
      userId,
      name: names.get(userId) ?? (userId === actor.userId ? actor.name : 'Jugador'),
      seat: index,
    }));
    const stake = info.visibility === 'private'
      ? assertBet(request.stake ?? 0, this.limits)
      : 0;

    const live: LiveTable = {
      id: `local-${crypto.randomUUID()}`,
      roomId,
      kind: request.kind,
      visibility: info.visibility,
      ownerId: actor.userId,
      status: 'waiting',
      seats,
      state: null,
      version: 0,
      stake,
      charged: {},
      credited: {},
      ready: new Set(),
      createdAt: Date.now(),
    };

    // El póker espera a que cada invitado confirme su entrada; los juegos de
    // salón y el casino individual empiezan en el acto.
    const waiting = info.casino && info.minPlayers > 1;
    if (!waiting) {
      try {
        await this.start(live, request.options);
      } catch (error) {
        if (this.store && !live.id.startsWith('local-')) {
          await this.store
            .saveTable(live.id, { kind: live.kind, aborted: true }, 'finished', 0, 0)
            .catch(() => undefined);
        }
        throw error;
      }
    } else {
      live.ready.add(actor.userId);
    }
    this.tables.set(live.id, live);
    this.onChange(live, [{ type: waiting ? 'table_waiting' : 'table_created' }]);
    return this.view(live, actor.userId);
  }

  /** Un jugador de póker confirma que entra con su parte. */
  async ready(actor: Actor, tableId: string): Promise<TableView> {
    const table = this.require(tableId);
    if (table.status !== 'waiting') return this.view(table, actor.userId);
    if (!table.seats.some(seat => seat.userId === actor.userId)) {
      throw new RuleError('not_seated', 'No tienes sitio en esta mesa.');
    }
    table.ready.add(actor.userId);
    if (table.ready.size === table.seats.length) {
      await this.start(table);
      this.onChange(table, [{ type: 'table_started' }]);
    }
    return this.view(table, actor.userId);
  }

  async act(actor: Actor, tableId: string, action: GameAction): Promise<TableView> {
    const table = this.require(tableId);
    if (table.status !== 'playing' || !table.state) {
      throw new RuleError('not_playing', 'La mesa todavía no está jugando.');
    }
    const seat = table.seats.findIndex(item => item.userId === actor.userId);
    if (seat < 0) throw new RuleError('not_seated', 'No estás sentado en esta mesa.');

    const before = table.state;
    const result = applyGameAction(before, { ...action, userId: actor.userId }, this.rng);
    const next = result.state;

    // Se guarda primero: si la versión cambió, la jugada no se cobra.
    if (this.store) {
      try {
        const version = await this.store.saveTable(
          table.id,
          next,
          isGameOver(next) ? 'finished' : 'playing',
          table.stake,
          table.version,
        );
        table.version = version;
      } catch (error) {
        throw new RuleError('table_changed', describe(error));
      }
    } else {
      table.version += 1;
    }
    table.state = next;
    table.status = isGameOver(next) ? 'finished' : 'playing';

    for (const player of table.seats) {
      const wager = wagerFor(next, player.userId);
      if (wager > (table.charged[player.userId] ?? 0)) {
        await this.take(table, player.userId, wager);
      }
    }
    if (table.status === 'finished') await this.payOut(table);

    const events = result.events as Array<Record<string, unknown>>;
    this.onChange(table, events);
    return this.view(table, actor.userId);
  }

  /** Retira mesas viejas y reintenta premios pendientes. */
  async sweep(now = Date.now()): Promise<number> {
    let removed = 0;
    for (const table of [...this.tables.values()]) {
      const age = now - table.createdAt;
      if ((table.status === 'waiting' && age > WAITING_MS) || (table.status === 'finished' && age > FINISHED_MS)) {
        this.tables.delete(table.id);
        removed += 1;
      }
      if (this.pendingCredits.has(table.id)) await this.payOut(table);
    }
    return removed;
  }

  private require(tableId: string): LiveTable {
    const table = this.tables.get(tableId);
    if (!table) throw new RuleError('table_missing', 'Esa mesa ya no existe.');
    return table;
  }

  private async start(table: LiveTable, options?: Record<string, unknown>): Promise<void> {
    const stakes: Record<string, number> = {};
    for (const seat of table.seats) stakes[seat.userId] = table.visibility === 'private' ? table.stake : 0;
    const state = createGame(table.kind, {
      seats: table.seats,
      rng: this.rng,
      stakes,
      options,
    });
    table.state = state;

    const finished = isGameOver(state);
    if (this.store) {
      const id = await this.store.openTable({
        roomId: table.roomId,
        kind: table.kind,
        visibility: table.visibility,
        ownerId: table.ownerId,
        seats: table.seats,
        state,
        stake: table.stake,
      });
      table.id = id;
      for (const seat of table.seats) {
        const wager = wagerFor(state, seat.userId);
        if (wager > 0) await this.take(table, seat.userId, wager);
      }
      const version = await this.store.saveTable(id, state, finished ? 'finished' : 'playing', table.stake, 0);
      table.version = version;
    }
    table.status = finished ? 'finished' : 'playing';
    if (finished) await this.payOut(table);
  }

  private async take(table: LiveTable, userId: string, total: number): Promise<void> {
    if (!this.store) return;
    if (total <= (table.charged[userId] ?? 0)) return;
    await this.store.charge(table.id, userId, total);
    table.charged[userId] = total;
  }

  private async payOut(table: LiveTable): Promise<void> {
    if (!this.store || !table.state) return;
    let pending = false;
    for (const seat of table.seats) {
      const payout = payoutFor(table.state, seat.userId);
      if (payout <= (table.credited[seat.userId] ?? 0)) continue;
      try {
        await this.store.credit(table.id, seat.userId, payout);
        table.credited[seat.userId] = payout;
      } catch {
        pending = true;
      }
    }
    if (pending) this.pendingCredits.add(table.id);
    else this.pendingCredits.delete(table.id);
  }

  private view(table: LiveTable, viewer: string | null): TableView {
    const yourSeat = viewer ? table.seats.findIndex(seat => seat.userId === viewer) : -1;
    return {
      id: table.id,
      roomId: table.roomId,
      kind: table.kind,
      visibility: table.visibility,
      ownerId: table.ownerId,
      status: table.status,
      seats: table.seats,
      version: table.version,
      stake: table.stake,
      state: table.state ? viewGame(table.state, viewer) : null,
      ready: [...table.ready],
      yourSeat: yourSeat >= 0 ? yourSeat : null,
    };
  }
}

export function wagerFor(state: GameState, userId: string): number {
  const seat = state.seats.findIndex(item => item.userId === userId);
  if (seat < 0) return 0;
  switch (state.kind) {
    case 'slots': return state.stake;
    case 'roulette': return state.spin?.stake ?? 0;
    case 'blackjack': return state.stake;
    case 'poker': return state.committed[seat] ?? 0;
    default: return 0;
  }
}

export function payoutFor(state: GameState, userId: string): number {
  const seat = state.seats.findIndex(item => item.userId === userId);
  if (seat < 0) return 0;
  switch (state.kind) {
    case 'slots': return state.totalWin;
    case 'roulette': return state.spin?.totalWin ?? 0;
    case 'blackjack': return state.payout;
    case 'poker': return state.payouts[seat] ?? 0;
    default: return 0;
  }
}
