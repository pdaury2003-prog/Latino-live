/**
 * Ludo de 4 colores con 4 fichas por persona.
 *
 * - Se sale del corral con un 6.
 * - La vuelta tiene 52 casillas y la calle de meta 6; hay que caer exacto.
 * - Las casillas seguras no permiten captura.
 * - Un 6, una captura o meter una ficha dan otra tirada.
 * - Tres 6 seguidos pierden el turno.
 */

import {
  fail,
  type ActionResult,
  type CreateInput,
  type Engine,
  type GameAction,
  type GameEvent,
  type Rng,
  type Seat,
  type SettlementEntry,
} from './types.ts';

export type LudoToken = {
  /** -1 en el corral, 0…51 en la vuelta, 52…57 en la calle, 58 en la meta. */
  pos: number;
};

export type LudoPhase = 'roll' | 'move' | 'finished';

export type LudoState = {
  kind: 'ludo';
  seats: Seat[];
  tokens: LudoToken[][];
  turn: number;
  phase: LudoPhase;
  dice: number | null;
  sixes: number;
  winner: number | null;
  reason: string | null;
  lastMove: { seat: number; token: number; from: number; to: number; captured: number[] } | null;
};

export const LUDO_RING = 52;
export const LUDO_LANE = 6;
export const LUDO_GOAL = 58;
export const LUDO_STARTS = [0, 13, 26, 39] as const;
export const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47] as const;
const TOKENS_PER_PLAYER = 4;

export function createLudo(input: CreateInput): LudoState {
  const seats = input.seats.slice(0, 4).map((seat, index) => ({ ...seat, seat: index }));
  if (seats.length < 2) fail('not_enough_players', 'El ludo necesita al menos dos personas.');
  return {
    kind: 'ludo',
    seats,
    tokens: seats.map(() => Array.from({ length: TOKENS_PER_PLAYER }, () => ({ pos: -1 }))),
    turn: 0,
    phase: 'roll',
    dice: null,
    sixes: 0,
    winner: null,
    reason: null,
    lastMove: null,
  };
}

export function ludoStart(seat: number): number {
  return LUDO_STARTS[seat % 4]!;
}

export function absoluteSquare(seat: number, pos: number): number | null {
  if (pos < 0 || pos > LUDO_RING - 1) return null;
  return (ludoStart(seat) + pos) % LUDO_RING;
}

export function isSafeSquare(seat: number, pos: number): boolean {
  const square = absoluteSquare(seat, pos);
  return square !== null && (LUDO_SAFE as readonly number[]).includes(square);
}

export function canMoveToken(state: LudoState, seat: number, token: number, dice: number): boolean {
  const piece = state.tokens[seat]?.[token];
  if (!piece) return false;
  if (piece.pos === LUDO_GOAL) return false;
  if (piece.pos < 0) return dice === 6;
  return piece.pos + dice <= LUDO_GOAL;
}

export function movableTokens(state: LudoState, seat: number, dice: number): number[] {
  return state.tokens[seat]!
    .map((_token, index) => (canMoveToken(state, seat, index, dice) ? index : -1))
    .filter(index => index >= 0);
}

function nextSeat(state: LudoState): number {
  return (state.turn + 1) % state.seats.length;
}

function passTurn(state: LudoState, reason: string | null): LudoState {
  return {
    ...state,
    turn: nextSeat(state),
    phase: 'roll',
    dice: null,
    sixes: 0,
    reason,
  };
}

function capturesAt(board: LudoToken[][], seat: number, pos: number): number[] {
  const square = absoluteSquare(seat, pos);
  if (square === null) return [];
  if (isSafeSquare(seat, pos)) return [];
  const hit: number[] = [];
  for (let other = 0; other < board.length; other += 1) {
    if (other === seat) continue;
    board[other]!.forEach((token, index) => {
      if (absoluteSquare(other, token.pos) === square) hit.push(other * TOKENS_PER_PLAYER + index);
    });
  }
  return hit;
}

export function applyLudo(state: LudoState, action: GameAction, rng: Rng): ActionResult<LudoState> {
  if (state.phase === 'finished') fail('game_over', 'La partida ya terminó.');
  const seat = state.seats.findIndex(item => item.userId === action.userId);
  if (seat < 0) fail('not_seated', 'No estás sentado en esta mesa.');
  if (seat !== state.turn) fail('not_your_turn', 'Todavía no es tu turno.');

  if (action.type === 'roll') {
    if (state.phase !== 'roll') fail('bad_phase', 'Primero mueve la ficha que te tocó.');
    const dice = Math.floor(rng() * 6) + 1;
    const sixes = dice === 6 ? state.sixes + 1 : 0;
    const events: GameEvent[] = [{ type: 'roll', userId: action.userId, seat, dice }];
    if (dice === 6 && sixes >= 3) {
      const next = passTurn({ ...state, dice: null, sixes: 0 }, 'Tres seises: pierde el turno');
      return { state: next, events: [...events, { type: 'triple_six', seat }] };
    }
    const next: LudoState = { ...state, dice, sixes };
    if (movableTokens(next, seat, dice).length === 0) {
      const passed = passTurn(next, 'Sin movimientos posibles');
      return { state: passed, events: [...events, { type: 'pass', seat }] };
    }
    return { state: { ...next, phase: 'move' }, events };
  }

  if (action.type === 'move') {
    if (state.phase !== 'move' || state.dice === null) fail('bad_phase', 'Primero tira el dado.');
    const dice = state.dice;
    const token = typeof action.token === 'number' ? action.token : Number.NaN;
    if (!Number.isInteger(token) || !canMoveToken(state, seat, token, dice)) {
      fail('illegal_move', 'Esa ficha no puede moverse con ese número.');
    }
    const piece = state.tokens[seat]![token]!;
    const from = piece.pos;
    const to = from < 0 ? 0 : from + dice;
    const board = state.tokens.map(row => row.map(item => ({ ...item })));
    board[seat]![token] = { pos: to };

    const captured = capturesAt(board, seat, to);
    for (const victim of captured) {
      const owner = Math.floor(victim / TOKENS_PER_PLAYER);
      const index = victim % TOKENS_PER_PLAYER;
      board[owner]![index] = { pos: -1 };
    }

    const finished = to === LUDO_GOAL;
    const allHome = board[seat]!.every(item => item.pos === LUDO_GOAL);
    const extra = dice === 6 || captured.length > 0 || finished;
    const events: GameEvent[] = [{
      type: 'move',
      userId: action.userId,
      seat,
      token,
      from,
      to,
      captured,
    }];

    let next: LudoState = {
      ...state,
      tokens: board,
      dice: null,
      sixes: dice === 6 ? state.sixes : 0,
      phase: 'roll',
      lastMove: { seat, token, from, to, captured },
    };

    if (allHome) {
      next = { ...next, phase: 'finished', winner: seat, reason: 'Las cuatro fichas en la meta', dice: null };
      events.push({ type: 'game_over', winner: seat });
      return { state: next, events };
    }

    if (extra) {
      return {
        state: { ...next, turn: seat, phase: 'roll', reason: dice === 6 ? 'Sacó 6: repite' : 'Capturó: repite' },
        events,
      };
    }
    return { state: passTurn(next, null), events };
  }

  fail('bad_action', 'Esa acción no existe en el ludo.');
}

export const ludoEngine: Engine<LudoState> = {
  kind: 'ludo',
  visibility: 'table',
  minPlayers: 2,
  maxPlayers: 4,
  create: createLudo,
  legalActions(state, userId) {
    if (state.phase === 'finished') return [];
    const seat = state.seats.findIndex(item => item.userId === userId);
    if (seat < 0) fail('not_seated', 'No estás sentado en esta mesa.');
    if (seat !== state.turn) return [];
    if (state.phase === 'roll') return [{ type: 'roll', userId }];
    return movableTokens(state, seat, state.dice ?? 0).map(token => ({ type: 'move', userId, token }));
  },
  apply: (state, action, rng) => applyLudo(state, action, rng),
  view: state => state,
  settlement: (_state): SettlementEntry[] => [],
  isOver: state => state.phase === 'finished',
};
