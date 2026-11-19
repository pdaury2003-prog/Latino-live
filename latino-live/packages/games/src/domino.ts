/**
 * Dominó de doble seis, 2 o 4 jugadores.
 *
 * El servidor reparte, decide el turno y guarda las manos. La app solo ve la
 * suya y cuántas fichas le quedan a cada rival. La partida termina cuando
 * alguien se queda sin fichas o cuando todos pasan (tranca): gana el que menos
 * puntos tiene en la mano.
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
  shuffled,
} from './types.ts';

export type DominoSide = 'left' | 'right' | 'first';
export type DominoStatus = 'playing' | 'finished';
export type DominoBoardTile = { l: number; r: number };

export type DominoLogEntry = {
  kind: 'play' | 'draw' | 'pass';
  seat: number;
  tile?: string;
  side?: DominoSide;
};

export type DominoState = {
  kind: 'domino';
  seats: Seat[];
  hands: string[][];
  handCounts: number[];
  boneyard: string[];
  board: DominoBoardTile[];
  leftPip: number | null;
  rightPip: number | null;
  turn: number;
  passes: number;
  status: DominoStatus;
  winner: string | null;
  winnerSeat: number | null;
  reason: string | null;
  log: DominoLogEntry[];
};

export function tileValues(tile: string): [number, number] {
  const [a, b] = tile.split('-').map(Number);
  return [Number.isFinite(a) ? a! : 0, Number.isFinite(b) ? b! : 0];
}

export function pipTotal(tiles: readonly string[]): number {
  return tiles.reduce((sum, tile) => {
    const [a, b] = tileValues(tile);
    return sum + a + b;
  }, 0);
}

export function fullDominoSet(): string[] {
  const tiles: string[] = [];
  for (let a = 0; a <= 6; a += 1) {
    for (let b = a; b <= 6; b += 1) tiles.push(`${a}-${b}`);
  }
  return tiles;
}

/** Las caras abiertas donde esta ficha puede entrar. */
export function sidesForTile(state: DominoState, tile: string): DominoSide[] {
  if (state.status !== 'playing') return [];
  if (state.board.length === 0) return ['first'];
  const [a, b] = tileValues(tile);
  const sides: DominoSide[] = [];
  if (a === state.leftPip || b === state.leftPip) sides.push('left');
  if (a === state.rightPip || b === state.rightPip) sides.push('right');
  return sides;
}

function firstSeat(hands: string[][]): number {
  const doubleSix = hands.findIndex(hand => hand.includes('6-6'));
  if (doubleSix >= 0) return doubleSix;
  let best = 0;
  let bestValue = -1;
  hands.forEach((hand, seat) => {
    for (const tile of hand) {
      const [a, b] = tileValues(tile);
      const value = a === b ? 100 + a : a + b;
      if (value > bestValue) {
        bestValue = value;
        best = seat;
      }
    }
  });
  return best;
}

export function createDomino(input: CreateInput): DominoState {
  const seats = input.seats.slice(0, 4).map((seat, index) => ({ ...seat, seat: index }));
  if (seats.length !== 2 && seats.length !== 4) fail('bad_players', 'El dominó es de 2 o 4 jugadores.');
  const tiles = shuffled(fullDominoSet(), input.rng);
  const hands = seats.map(() => [] as string[]);
  for (let round = 0; round < 7; round += 1) {
    for (let seat = 0; seat < seats.length; seat += 1) hands[seat]!.push(tiles.pop()!);
  }
  return {
    kind: 'domino',
    seats,
    hands,
    handCounts: hands.map(hand => hand.length),
    boneyard: tiles,
    board: [],
    leftPip: null,
    rightPip: null,
    turn: firstSeat(hands),
    passes: 0,
    status: 'playing',
    winner: null,
    winnerSeat: null,
    reason: null,
    log: [],
  };
}

function syncCounts(state: DominoState): number[] {
  return state.hands.map(hand => hand.length);
}

function endBlocked(state: DominoState): DominoState {
  const totals = state.hands.map(hand => pipTotal(hand));
  const lowest = Math.min(...totals);
  const winners = totals.reduce<number[]>((list, total, seat) => (total === lowest ? [...list, seat] : list), []);
  const winnerSeat = winners.length === 1 ? winners[0]! : null;
  return {
    ...state,
    status: 'finished',
    winnerSeat,
    winner: winnerSeat === null ? null : state.seats[winnerSeat]!.userId,
    reason: winnerSeat === null ? 'Tranca empatada' : 'Tranca: menos puntos',
  };
}

export function applyDomino(state: DominoState, action: GameAction): ActionResult<DominoState> {
  if (state.status !== 'playing') fail('game_over', 'La partida ya terminó.');
  const seat = state.seats.findIndex(item => item.userId === action.userId);
  if (seat < 0) fail('not_seated', 'No estás sentado en esta mesa.');
  if (seat !== state.turn) fail('not_your_turn', 'Todavía no es tu turno.');

  if (action.type === 'draw') {
    if (state.boneyard.length === 0) fail('no_tiles', 'Ya no quedan fichas para robar.');
    const tile = state.boneyard[state.boneyard.length - 1]!;
    const hands = state.hands.map(hand => [...hand]);
    hands[seat]!.push(tile);
    const next: DominoState = {
      ...state,
      hands,
      handCounts: syncCounts({ ...state, hands }),
      boneyard: state.boneyard.slice(0, -1),
      log: [...state.log, { kind: 'draw', seat }],
    };
    return { state: next, events: [{ type: 'draw', userId: action.userId, seat, remaining: next.boneyard.length }] };
  }

  if (action.type === 'pass') {
    const playable = state.hands[seat]!.some(tile => sidesForTile(state, tile).length > 0);
    if (state.boneyard.length > 0) fail('must_draw', 'Todavía quedan fichas: roba antes de pasar.');
    if (playable) fail('must_play', 'Tienes una ficha que puede entrar.');
    const passes = state.passes + 1;
    const next: DominoState = {
      ...state,
      turn: (seat + 1) % state.seats.length,
      passes,
      log: [...state.log, { kind: 'pass', seat }],
    };
    if (passes >= state.seats.length) {
      const closed = endBlocked(next);
      return {
        state: closed,
        events: [{ type: 'pass', userId: action.userId, seat }, { type: 'game_over', winner: closed.winner, reason: closed.reason }],
      };
    }
    return { state: next, events: [{ type: 'pass', userId: action.userId, seat }] };
  }

  if (action.type !== 'play') fail('bad_action', 'Esa acción no existe en el dominó.');
  const tile = typeof action.tile === 'string' ? action.tile : '';
  const side = typeof action.side === 'string' ? action.side : '';
  if (!state.hands[seat]!.includes(tile)) fail('not_in_hand', 'Esa ficha no es tuya.');
  if (side !== 'first' && side !== 'left' && side !== 'right') fail('bad_side', 'Elige un lado de la mesa.');
  const allowed = sidesForTile(state, tile);
  if (!allowed.includes(side)) fail('illegal_move', 'Esa ficha no entra por ese lado.');

  const [a, b] = tileValues(tile);
  const hands = state.hands.map(hand => [...hand]);
  hands[seat] = hands[seat]!.filter(item => item !== tile);
  const board = [...state.board];
  let leftPip = state.leftPip;
  let rightPip = state.rightPip;

  if (side === 'first') {
    board.push({ l: a, r: b });
    leftPip = a;
    rightPip = b;
  } else if (side === 'left') {
    const matched = a === leftPip ? a : b;
    const exposed = matched === a ? b : a;
    board.unshift({ l: exposed, r: matched });
    leftPip = exposed;
  } else {
    const matched = a === rightPip ? a : b;
    const exposed = matched === a ? b : a;
    board.push({ l: matched, r: exposed });
    rightPip = exposed;
  }

  const next: DominoState = {
    ...state,
    hands,
    handCounts: syncCounts({ ...state, hands }),
    board,
    leftPip,
    rightPip,
    turn: (seat + 1) % state.seats.length,
    passes: 0,
    log: [...state.log, { kind: 'play', seat, tile, side }],
  };
  const events: GameEvent[] = [{ type: 'play', userId: action.userId, seat, tile, side }];

  if (hands[seat]!.length === 0) {
    const score = hands.reduce((sum, hand, other) => (other === seat ? sum : sum + pipTotal(hand)), 0);
    const finished: DominoState = {
      ...next,
      status: 'finished',
      winner: state.seats[seat]!.userId,
      winnerSeat: seat,
      reason: `Dominó: ${score} puntos`,
    };
    events.push({ type: 'game_over', winner: finished.winner, seat, score });
    return { state: finished, events };
  }
  return { state: next, events };
}

export function applyDominoAction(state: DominoState, action: GameAction): ActionResult<DominoState> {
  return applyDomino(state, action);
}

/**
 * Lo que ve una persona: su mano completa y solo el número de fichas de los
 * demás. Nunca se envía la mano de un rival a un teléfono.
 */
export function dominoView(state: DominoState, viewerId: string | null): DominoState {
  const mine = viewerId ? state.seats.findIndex(seat => seat.userId === viewerId) : -1;
  return {
    ...state,
    hands: state.hands.map((hand, seat) => (seat === mine ? hand : [])),
    handCounts: state.handCounts,
    boneyard: [],
  };
}

export const dominoEngine: Engine<DominoState> = {
  kind: 'domino',
  visibility: 'table',
  minPlayers: 2,
  maxPlayers: 4,
  create: createDomino,
  legalActions(state, userId) {
    if (state.status !== 'playing') return [];
    const seat = state.seats.findIndex(item => item.userId === userId);
    if (seat < 0 || seat !== state.turn) return [];
    const actions: GameAction[] = [];
    for (const tile of state.hands[seat]!) {
      for (const side of sidesForTile(state, tile)) actions.push({ type: 'play', userId, tile, side });
    }
    if (state.boneyard.length > 0) actions.push({ type: 'draw', userId });
    if (state.boneyard.length === 0 && actions.length === 0) actions.push({ type: 'pass', userId });
    return actions;
  },
  apply: (state, action) => applyDomino(state, action),
  view: (state, viewerId) => dominoView(state, viewerId),
  settlement: (_state): SettlementEntry[] => [],
  isOver: state => state.status !== 'playing',
};
