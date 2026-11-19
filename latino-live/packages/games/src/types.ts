/**
 * Piezas comunes del motor. Todo aquí es TypeScript puro: ni React, ni
 * Supabase, ni relojes del sistema. El servidor decide con estas reglas y la
 * app las lee para no ofrecer una jugada que va a ser rechazada.
 */

export type GameKind =
  | 'chess'
  | 'checkers'
  | 'ludo'
  | 'domino'
  | 'slots'
  | 'poker'
  | 'roulette'
  | 'blackjack';

/** Los juegos de mesa se ven en la sala; el casino es una capa privada. */
export type GameVisibility = 'table' | 'private';

export type PlayerId = string;
export type Rng = () => number;

export type Seat = {
  userId: PlayerId;
  name: string;
  seat: number;
};

export type GameAction = {
  type: string;
  userId: PlayerId;
  [key: string]: unknown;
};

export type GameEvent = {
  type: string;
  userId?: PlayerId;
  [key: string]: unknown;
};

export type ActionResult<S> = {
  state: S;
  events: GameEvent[];
};

/** Diamantes que entran (+) o salen (-) de cada billetera al cerrar la mano. */
export type SettlementEntry = {
  userId: PlayerId;
  delta: number;
};

export type CreateInput = {
  seats: Seat[];
  rng: Rng;
  /** Solo el casino: lo que cada jugador pone en la mesa. */
  stakes?: Record<PlayerId, number>;
  options?: Record<string, unknown>;
};

export type Engine<S> = {
  kind: GameKind;
  visibility: GameVisibility;
  minPlayers: number;
  maxPlayers: number;
  create(input: CreateInput): S;
  legalActions(state: S, userId: PlayerId): GameAction[];
  apply(state: S, action: GameAction, rng: Rng): ActionResult<S>;
  view(state: S, viewerId: PlayerId | null): S;
  settlement(state: S): SettlementEntry[];
  isOver(state: S): boolean;
};

/** Un movimiento ilegal nunca se cobra: el servidor lo rechaza con su código. */
export class RuleError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

export function fail(code: string, message: string): never {
  throw new RuleError(code, message);
}

export function actionNumber(action: GameAction, key: string): number {
  const value = action[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) fail('bad_action', `Falta ${key}.`);
  return value;
}

export function actionText(action: GameAction, key: string): string {
  const value = action[key];
  if (typeof value !== 'string') fail('bad_action', `Falta ${key}.`);
  return value;
}

export function actionBool(action: GameAction, key: string): boolean {
  return action[key] === true;
}

export function seatOf(seats: Seat[], userId: PlayerId): number {
  const found = seats.findIndex(seat => seat.userId === userId);
  if (found < 0) fail('not_seated', 'No estás sentado en esta mesa.');
  return found;
}

export function makeSeats(seats: Seat[], count: number): Seat[] {
  if (seats.length < count) fail('not_enough_players', `Hacen falta ${count} jugadores.`);
  return seats.slice(0, count).map((seat, index) => ({ ...seat, seat: index }));
}

/** Entero seguro dentro de [min, max]; usado por todas las apuestas. */
export function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = swap;
  }
  return copy;
}
