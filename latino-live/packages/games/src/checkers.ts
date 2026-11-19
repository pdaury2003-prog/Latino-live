/**
 * Damas españolas (8×8, solo casillas oscuras).
 *
 * Reglas que aplica este motor:
 *  - El peón anda y captura hacia adelante, una casilla por vez.
 *  - La dama vuela por la diagonal y captura a cualquier distancia.
 *  - Capturar es obligatorio y la cadena se termina en el mismo turno.
 *  - Al llegar a la última fila, el peón se corona.
 */

import {
  fail,
  seatOf,
  type ActionResult,
  type CreateInput,
  type Engine,
  type GameAction,
  type GameEvent,
  type PlayerId,
  type Rng,
  type Seat,
  type SettlementEntry,
} from './types.ts';

export type CheckersColor = 'w' | 'b';
export type CheckersPiece = { color: CheckersColor; king: boolean };
export type CheckersSquare = CheckersPiece | null;
export type CheckersStatus = 'playing' | 'finished';

export type CheckersStep = {
  /** Casillas donde aterriza, en orden; la última es el destino final. */
  path: number[];
  /** Casillas de las fichas capturadas, en el mismo orden que `path`. */
  captures: number[];
};

export type CheckersState = {
  kind: 'checkers';
  seats: Seat[];
  board: CheckersSquare[];
  turn: CheckersColor;
  status: CheckersStatus;
  winner: ChessWinner;
  reason: string | null;
  lastMove: { from: number; path: number[] } | null;
  quietPlies: number;
};

type ChessWinner = CheckersColor | null;

const DIAGONALS = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const MAX_CAPTURE_DEPTH = 12;

function inside(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

export function isDark(square: number): boolean {
  return (Math.floor(square / 8) + (square % 8)) % 2 === 1;
}

export function startingCheckersBoard(): CheckersSquare[] {
  return Array.from({ length: 64 }, (_, square) => {
    if (!isDark(square)) return null;
    const rank = Math.floor(square / 8);
    if (rank < 3) return { color: 'b', king: false };
    if (rank > 4) return { color: 'w', king: false };
    return null;
  });
}

export function createCheckers(input: CreateInput): CheckersState {
  if (input.seats.length !== 2) fail('need_two_players', 'Las damas son entre dos.');
  return {
    kind: 'checkers',
    seats: input.seats.slice(0, 2).map((seat, index) => ({ ...seat, seat: index })),
    board: startingCheckersBoard(),
    turn: 'w',
    status: 'playing',
    winner: null,
    reason: null,
    lastMove: null,
    quietPlies: 0,
  };
}

function forward(color: CheckersColor): number {
  return color === 'w' ? -1 : 1;
}

function promotionRank(color: CheckersColor): number {
  return color === 'w' ? 0 : 7;
}

/**
 * Todas las cadenas de captura posibles para una ficha. Se exploran primero y
 * se devuelven completas: el cliente nunca puede dejar una captura a medias.
 */
export function capturePaths(
  board: CheckersSquare[],
  from: number,
  piece: CheckersPiece,
  captured: readonly number[] = [],
  depth = 0,
): CheckersStep[] {
  if (depth >= MAX_CAPTURE_DEPTH) return [];
  const file = from % 8;
  const rank = Math.floor(from / 8);
  const results: CheckersStep[] = [];

  for (const [dr, df] of DIAGONALS) {
    if (!piece.king && dr !== forward(piece.color)) continue;
    let r = rank + dr;
    let f = file + df;
    let victim: number | null = null;

    while (inside(f, r)) {
      const square = r * 8 + f;
      const occupant = board[square];
      if (occupant) {
        if (victim !== null) break;
        if (occupant.color === piece.color || captured.includes(square)) break;
        victim = square;
      } else if (victim !== null) {
        const landsOnLast = r === promotionRank(piece.color);
        const nextPiece: CheckersPiece = piece.king || landsOnLast ? { color: piece.color, king: true } : piece;
        const further = capturePaths(board, square, nextPiece, [...captured, victim], depth + 1);
        if (further.length > 0) {
          for (const step of further) {
            results.push({ path: [square, ...step.path], captures: [victim, ...step.captures] });
          }
        } else {
          results.push({ path: [square], captures: [victim] });
        }
        if (!piece.king) break;
      }
      if (!piece.king && victim === null) break;
      r += dr;
      f += df;
    }
  }
  return results;
}

export function simpleMoves(board: CheckersSquare[], from: number, piece: CheckersPiece): number[] {
  const file = from % 8;
  const rank = Math.floor(from / 8);
  const to: number[] = [];
  for (const [dr, df] of DIAGONALS) {
    if (!piece.king && dr !== forward(piece.color)) continue;
    let r = rank + dr;
    let f = file + df;
    while (inside(f, r)) {
      const square = r * 8 + f;
      if (board[square]) break;
      to.push(square);
      if (!piece.king) break;
      r += dr;
      f += df;
    }
  }
  return to;
}

export function allCapturePaths(board: CheckersSquare[], color: CheckersColor): Array<CheckersStep & { from: number }> {
  const all: Array<CheckersStep & { from: number }> = [];
  for (let square = 0; square < 64; square += 1) {
    const piece = board[square];
    if (!piece || piece.color !== color) continue;
    for (const step of capturePaths(board, square, piece)) all.push({ from: square, ...step });
  }
  return all;
}

export function legalCheckersSteps(state: CheckersState, color: CheckersColor = state.turn): Array<CheckersStep & { from: number }> {
  if (state.status !== 'playing') return [];
  const captures = allCapturePaths(state.board, color);
  if (captures.length > 0) return captures;
  const steps: Array<CheckersStep & { from: number }> = [];
  for (let square = 0; square < 64; square += 1) {
    const piece = state.board[square];
    if (!piece || piece.color !== color) continue;
    for (const to of simpleMoves(state.board, square, piece)) steps.push({ from: square, path: [to], captures: [] });
  }
  return steps;
}

function applyStep(board: CheckersSquare[], from: number, step: CheckersStep): CheckersSquare[] {
  const next = [...board];
  const piece = next[from];
  if (!piece) return next;
  next[from] = null;
  for (const victim of step.captures) next[victim] = null;
  const last = step.path[step.path.length - 1]!;
  const crossedLastRow = step.path.some(square => Math.floor(square / 8) === promotionRank(piece.color));
  const crowned = crossedLastRow || Math.floor(last / 8) === promotionRank(piece.color);
  next[last] = crowned ? { ...piece, king: true } : piece;
  return next;
}

export function applyCheckers(state: CheckersState, action: GameAction): ActionResult<CheckersState> {
  if (state.status !== 'playing') fail('game_over', 'La partida ya terminó.');
  if (action.type === 'resign') {
    const seat = seatOf(state.seats, action.userId);
    const winner: CheckersColor = seat === 0 ? 'b' : 'w';
    return {
      state: { ...state, status: 'finished', winner, reason: 'Abandono' },
      events: [{ type: 'resign', userId: action.userId }, { type: 'game_over', winner }],
    };
  }
  if (action.type !== 'move') fail('bad_action', 'Esa acción no existe en las damas.');

  const seat = seatOf(state.seats, action.userId);
  const color: CheckersColor = seat === 0 ? 'w' : 'b';
  if (color !== state.turn) fail('not_your_turn', 'Todavía no es tu turno.');

  const from = typeof action.from === 'number' ? action.from : Number.NaN;
  const rawPath = Array.isArray(action.path) ? action.path : action.to !== undefined ? [action.to] : [];
  const path = rawPath.map(value => (typeof value === 'number' ? value : Number.NaN));
  if (!Number.isInteger(from) || path.length === 0 || path.some(value => !Number.isInteger(value))) {
    fail('bad_move', 'Ese movimiento no se entiende.');
  }

  const legal = legalCheckersSteps(state, color);
  const chosen = legal.find(step => step.from === from && step.path.length === path.length
    && step.path.every((value, index) => value === path[index]));
  if (!chosen) {
    const mustCapture = legal.length > 0 && legal[0]!.captures.length > 0;
    fail('illegal_move', mustCapture ? 'Tienes que capturar.' : 'Ese movimiento no es legal.');
  }

  const board = applyStep(state.board, from, chosen);
  const nextTurn: CheckersColor = color === 'w' ? 'b' : 'w';
  const crowned = !state.board[from]!.king
    && chosen.path.some(square => Math.floor(square / 8) === promotionRank(color));
  const quietPlies = chosen.captures.length > 0 || crowned ? 0 : state.quietPlies + 1;
  let next: CheckersState = {
    ...state,
    board,
    turn: nextTurn,
    lastMove: { from, path: chosen.path },
    quietPlies,
  };

  const opponentPieces = board.some(piece => piece?.color === nextTurn);
  const opponentMoves = legalCheckersSteps(next, nextTurn);
  if (!opponentPieces || opponentMoves.length === 0) {
    next = { ...next, status: 'finished', winner: color, reason: !opponentPieces ? 'Sin fichas' : 'Sin movimientos' };
  } else if (quietPlies >= 100) {
    next = { ...next, status: 'finished', winner: null, reason: 'Tablas por 50 jugadas' };
  }

  const events: GameEvent[] = [{
    type: 'move',
    userId: action.userId,
    from,
    path: chosen.path,
    captures: chosen.captures,
  }];
  if (next.status === 'finished') events.push({ type: 'game_over', winner: next.winner, reason: next.reason });
  return { state: next, events };
}

export function checkersView(state: CheckersState): CheckersState {
  return state;
}

export const checkersEngine: Engine<CheckersState> = {
  kind: 'checkers',
  visibility: 'table',
  minPlayers: 2,
  maxPlayers: 2,
  create: createCheckers,
  legalActions(state, userId) {
    if (state.status !== 'playing') return [];
    const seat = seatOf(state.seats, userId);
    const color: CheckersColor = seat === 0 ? 'w' : 'b';
    if (color !== state.turn) return [{ type: 'resign', userId }];
    return [
      ...legalCheckersSteps(state, color).map(step => ({
        type: 'move',
        userId,
        from: step.from,
        path: step.path,
        captures: step.captures,
      })),
      { type: 'resign', userId },
    ];
  },
  apply: (state, action) => applyCheckers(state, action),
  view: state => checkersView(state),
  settlement: (_state): SettlementEntry[] => [],
  isOver: state => state.status !== 'playing',
};
