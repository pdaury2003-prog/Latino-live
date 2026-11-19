/**
 * Ajedrez reglamentario: enroque, captura al paso, promoción, jaque mate,
 * ahogado, material insuficiente y regla de las 50 jugadas.
 *
 * Índices: 0 = a8 … 7 = h8, 56 = a1 … 63 = h1 (el mismo orden que un FEN).
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

export type ChessColor = 'w' | 'b';
export type ChessRole = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export type ChessPiece = { color: ChessColor; role: ChessRole };
export type ChessSquare = ChessPiece | null;

export type ChessMove = {
  from: number;
  to: number;
  promotion?: 'q' | 'r' | 'b' | 'n';
};

export type ChessStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw' | 'resigned';

export type ChessState = {
  kind: 'chess';
  seats: Seat[];
  board: ChessSquare[];
  turn: ChessColor;
  castling: string;
  enPassant: number | null;
  halfmove: number;
  fullmove: number;
  status: ChessStatus;
  winner: ChessColor | null;
  reason: string | null;
  lastMove: ChessMove | null;
  check: boolean;
  repetitions: Record<string, number>;
};

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';
const KNIGHT_DELTAS = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1],
] as const;
const KING_DELTAS = [
  [-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1],
] as const;
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const;
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]] as const;

export function fileOf(square: number): number {
  return square % 8;
}

export function rankOf(square: number): number {
  return Math.floor(square / 8);
}

export function squareName(square: number): string {
  return `${String.fromCharCode(97 + fileOf(square))}${8 - rankOf(square)}`;
}

export function squareFromName(name: string): number {
  const file = name.charCodeAt(0) - 97;
  const rank = 8 - Number(name[1]);
  if (!Number.isInteger(rank) || file < 0 || file > 7 || rank < 0 || rank > 7) {
    fail('bad_square', 'Esa casilla no existe.');
  }
  return rank * 8 + file;
}

export function parseBoard(fen: string): ChessSquare[] {
  const board: ChessSquare[] = Array.from({ length: 64 }, () => null);
  let index = 0;
  for (const char of fen) {
    if (char === '/') continue;
    if (char >= '1' && char <= '8') {
      index += Number(char);
      continue;
    }
    const color: ChessColor = char === char.toUpperCase() ? 'w' : 'b';
    const role = char.toLowerCase() as ChessRole;
    board[index] = { color, role };
    index += 1;
  }
  return board;
}

export function createChess(input: CreateInput): ChessState {
  if (input.seats.length !== 2) fail('need_two_players', 'El ajedrez es entre dos.');
  const state: ChessState = {
    kind: 'chess',
    seats: input.seats.slice(0, 2).map((seat, index) => ({ ...seat, seat: index })),
    board: parseBoard(START),
    turn: 'w',
    castling: 'KQkq',
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    status: 'playing',
    winner: null,
    reason: null,
    lastMove: null,
    check: false,
    repetitions: {},
  };
  state.repetitions[positionKey(state)] = 1;
  return state;
}

function colorAt(state: ChessState, square: number): ChessColor | null {
  return state.board[square]?.color ?? null;
}

export function kingSquare(board: ChessSquare[], color: ChessColor): number {
  return board.findIndex(piece => piece?.color === color && piece.role === 'k');
}

/** ¿La casilla recibe ataque del color indicado? */
export function isAttacked(board: ChessSquare[], square: number, by: ChessColor): boolean {
  const file = fileOf(square);
  const rank = rankOf(square);

  const pawnRank = rank + (by === 'w' ? 1 : -1);
  for (const delta of [-1, 1]) {
    const f = file + delta;
    if (f < 0 || f > 7 || pawnRank < 0 || pawnRank > 7) continue;
    const piece = board[pawnRank * 8 + f];
    if (piece?.color === by && piece.role === 'p') return true;
  }

  for (const [dr, df] of KNIGHT_DELTAS) {
    const r = rank + dr;
    const f = file + df;
    if (r < 0 || r > 7 || f < 0 || f > 7) continue;
    const piece = board[r * 8 + f];
    if (piece?.color === by && piece.role === 'n') return true;
  }

  for (const [dr, df] of KING_DELTAS) {
    const r = rank + dr;
    const f = file + df;
    if (r < 0 || r > 7 || f < 0 || f > 7) continue;
    const piece = board[r * 8 + f];
    if (piece?.color === by && piece.role === 'k') return true;
  }

  const rays: ReadonlyArray<readonly (readonly [number, number])[]> = [BISHOP_DIRS, ROOK_DIRS];
  for (const group of rays) {
    for (const [dr, df] of group) {
      let r = rank + dr;
      let f = file + df;
      while (r >= 0 && r < 8 && f >= 0 && f < 8) {
        const piece = board[r * 8 + f];
        if (piece) {
          if (piece.color === by) {
            const diagonal = dr !== 0 && df !== 0;
            if (piece.role === 'q' || (diagonal ? piece.role === 'b' : piece.role === 'r')) return true;
          }
          break;
        }
        r += dr;
        f += df;
      }
    }
  }
  return false;
}

export function inCheck(state: ChessState, color: ChessColor = state.turn): boolean {
  const king = kingSquare(state.board, color);
  return king >= 0 && isAttacked(state.board, king, color === 'w' ? 'b' : 'w');
}

function inside(file: number, rank: number): boolean {
  return file >= 0 && file < 8 && rank >= 0 && rank < 8;
}

function pseudoMoves(state: ChessState, color: ChessColor): ChessMove[] {
  const moves: ChessMove[] = [];
  const board = state.board;
  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || piece.color !== color) continue;
    const file = fileOf(from);
    const rank = rankOf(from);

    const add = (to: number) => {
      const target = board[to];
      if (target?.color === color) return;
      moves.push({ from, to });
    };

    if (piece.role === 'p') {
      const forward = color === 'w' ? -1 : 1;
      const home = color === 'w' ? 6 : 1;
      const last = color === 'w' ? 0 : 7;
      const one = (rank + forward) * 8 + file;
      if (inside(file, rank + forward) && !board[one]) {
        if (rankOf(one) === last) {
          for (const role of ['q', 'r', 'b', 'n'] as const) moves.push({ from, to: one, promotion: role });
        } else {
          moves.push({ from, to: one });
          const two = (rank + forward * 2) * 8 + file;
          if (rank === home && !board[two]) moves.push({ from, to: two });
        }
      }
      for (const delta of [-1, 1]) {
        const f = file + delta;
        const r = rank + forward;
        if (!inside(f, r)) continue;
        const to = r * 8 + f;
        const target = board[to];
        if (target && target.color !== color) {
          if (r === last) {
            for (const role of ['q', 'r', 'b', 'n'] as const) moves.push({ from, to, promotion: role });
          } else {
            moves.push({ from, to });
          }
        } else if (!target && state.enPassant === to) {
          moves.push({ from, to });
        }
      }
      continue;
    }

    if (piece.role === 'n') {
      for (const [dr, df] of KNIGHT_DELTAS) {
        if (!inside(file + df, rank + dr)) continue;
        add((rank + dr) * 8 + file + df);
      }
      continue;
    }

    if (piece.role === 'k') {
      for (const [dr, df] of KING_DELTAS) {
        if (!inside(file + df, rank + dr)) continue;
        add((rank + dr) * 8 + file + df);
      }
      const homeRank = color === 'w' ? 7 : 0;
      if (from === homeRank * 8 + 4 && !isAttacked(board, from, color === 'w' ? 'b' : 'w')) {
        const kingSide = color === 'w' ? 'K' : 'k';
        const queenSide = color === 'w' ? 'Q' : 'q';
        if (
          state.castling.includes(kingSide)
          && !board[from + 1] && !board[from + 2]
          && board[from + 3]?.role === 'r' && board[from + 3]?.color === color
          && !isAttacked(board, from + 1, color === 'w' ? 'b' : 'w')
          && !isAttacked(board, from + 2, color === 'w' ? 'b' : 'w')
        ) {
          moves.push({ from, to: from + 2 });
        }
        if (
          state.castling.includes(queenSide)
          && !board[from - 1] && !board[from - 2] && !board[from - 3]
          && board[from - 4]?.role === 'r' && board[from - 4]?.color === color
          && !isAttacked(board, from - 1, color === 'w' ? 'b' : 'w')
          && !isAttacked(board, from - 2, color === 'w' ? 'b' : 'w')
        ) {
          moves.push({ from, to: from - 2 });
        }
      }
      continue;
    }

    const dirs = piece.role === 'b' ? BISHOP_DIRS : piece.role === 'r' ? ROOK_DIRS : [...BISHOP_DIRS, ...ROOK_DIRS];
    for (const [dr, df] of dirs) {
      let r = rank + dr;
      let f = file + df;
      while (inside(f, r)) {
        const to = r * 8 + f;
        const target = board[to];
        if (!target) {
          moves.push({ from, to });
        } else {
          if (target.color !== color) moves.push({ from, to });
          break;
        }
        r += dr;
        f += df;
      }
    }
  }
  return moves;
}

function applyMove(board: ChessSquare[], move: ChessMove, turn: ChessColor): ChessSquare[] {
  const next = [...board];
  const piece = next[move.from];
  if (!piece) return next;
  next[move.from] = null;
  const target = next[move.to];
  next[move.to] = move.promotion ? { color: piece.color, role: move.promotion } : piece;

  if (piece.role === 'p' && fileOf(move.from) !== fileOf(move.to) && !target) {
    const captured = move.to + (turn === 'w' ? 8 : -8);
    next[captured] = null;
  }

  if (piece.role === 'k' && Math.abs(move.to - move.from) === 2) {
    if (move.to > move.from) {
      next[move.from + 1] = next[move.from + 3] ?? null;
      next[move.from + 3] = null;
    } else {
      next[move.from - 1] = next[move.from - 4] ?? null;
      next[move.from - 4] = null;
    }
  }
  return next;
}

export function legalMoves(state: ChessState, color: ChessColor = state.turn): ChessMove[] {
  if (state.status !== 'playing') return [];
  const opposing: ChessColor = color === 'w' ? 'b' : 'w';
  const king = kingSquare(state.board, color);
  return pseudoMoves(state, color).filter(move => {
    const next = applyMove(state.board, move, color);
    const nextKing = move.from === king ? move.to : kingSquare(next, color);
    return nextKing >= 0 && !isAttacked(next, nextKing, opposing);
  });
}

function positionKey(state: ChessState): string {
  const board = state.board.map(piece => (piece ? `${piece.color}${piece.role}` : '.')).join('');
  return `${board}|${state.turn}|${state.castling}|${state.enPassant ?? '-'}`;
}

function insufficientMaterial(board: ChessSquare[]): boolean {
  const pieces = board.filter((piece): piece is ChessPiece => Boolean(piece));
  if (pieces.length > 4) return false;
  const nonKings = pieces.filter(piece => piece.role !== 'k');
  if (nonKings.length === 0) return true;
  if (nonKings.length === 1 && (nonKings[0]!.role === 'b' || nonKings[0]!.role === 'n')) return true;
  if (nonKings.length === 2 && nonKings.every(piece => piece.role === 'b')) return true;
  return false;
}

function finish(state: ChessState, status: ChessStatus, winner: ChessColor | null, reason: string): ChessState {
  return { ...state, status, winner, reason, check: status === 'checkmate' };
}

function afterMove(state: ChessState): ChessState {
  // `state.turn` is already the side that has to move now.
  const sideToMove: ChessColor = state.turn;
  const mover: ChessColor = sideToMove === 'w' ? 'b' : 'w';
  const moves = legalMoves(state, sideToMove);
  const checked = inCheck(state, sideToMove);
  if (moves.length === 0) {
    return checked
      ? finish({ ...state, check: true }, 'checkmate', mover, 'Jaque mate')
      : finish(state, 'stalemate', null, 'Ahogado');
  }
  if (state.halfmove >= 100) return finish(state, 'draw', null, 'Regla de las 50 jugadas');
  if (insufficientMaterial(state.board)) return finish(state, 'draw', null, 'Material insuficiente');
  if ((state.repetitions[positionKey(state)] ?? 0) >= 3) return finish(state, 'draw', null, 'Triple repetición');
  return { ...state, check: checked };
}

export function playChessMove(state: ChessState, action: GameAction): ActionResult<ChessState> {
  if (state.status !== 'playing') fail('game_over', 'La partida ya terminó.');
  const seat = seatOf(state.seats, action.userId);
  const color: ChessColor = seat === 0 ? 'w' : 'b';
  if (color !== state.turn) fail('not_your_turn', 'Todavía no es tu turno.');

  const from = typeof action.from === 'number' ? action.from : squareFromName(String(action.from));
  const to = typeof action.to === 'number' ? action.to : squareFromName(String(action.to));
  const promotion = typeof action.promotion === 'string' ? action.promotion : undefined;
  const move: ChessMove = { from, to };
  if (promotion === 'q' || promotion === 'r' || promotion === 'b' || promotion === 'n') move.promotion = promotion;

  const legal = legalMoves(state, color).find(candidate => (
    candidate.from === move.from
    && candidate.to === move.to
    && (!candidate.promotion || candidate.promotion === (move.promotion ?? 'q'))
  ));
  if (!legal) fail('illegal_move', 'Ese movimiento no es legal.');

  const piece = state.board[move.from]!;
  const captured = state.board[move.to];
  const enPassantCapture = piece.role === 'p' && fileOf(move.from) !== fileOf(move.to) && !captured;
  const board = applyMove(state.board, { ...move, promotion: legal.promotion ?? move.promotion }, color);
  let castling = state.castling;
  if (piece.role === 'k') castling = castling.replace(color === 'w' ? /[KQ]/g : /[kq]/g, '');
  if (piece.role === 'r') {
    if (move.from === 63) castling = castling.replace('K', '');
    if (move.from === 56) castling = castling.replace('Q', '');
    if (move.from === 7) castling = castling.replace('k', '');
    if (move.from === 0) castling = castling.replace('q', '');
  }
  if (move.to === 63) castling = castling.replace('K', '');
  if (move.to === 56) castling = castling.replace('Q', '');
  if (move.to === 7) castling = castling.replace('k', '');
  if (move.to === 0) castling = castling.replace('q', '');

  const enPassant = piece.role === 'p' && Math.abs(move.to - move.from) === 16
    ? (move.from + move.to) / 2
    : null;
  const resetClock = piece.role === 'p' || Boolean(captured) || enPassantCapture;

  let next: ChessState = {
    ...state,
    board,
    castling: castling || '-',
    enPassant,
    halfmove: resetClock ? 0 : state.halfmove + 1,
    fullmove: state.turn === 'b' ? state.fullmove + 1 : state.fullmove,
    turn: color === 'w' ? 'b' : 'w',
    lastMove: { from, to, ...(legal.promotion ? { promotion: legal.promotion } : {}) },
    check: false,
  };
  const key = positionKey(next);
  next = { ...next, repetitions: { ...next.repetitions, [key]: (next.repetitions[key] ?? 0) + 1 } };
  next = afterMove(next);

  const events: GameEvent[] = [{
    type: 'move',
    userId: action.userId,
    from: squareName(from),
    to: squareName(to),
    captured: Boolean(captured),
    check: next.check,
  }];
  if (next.status !== 'playing') {
    events.push({ type: 'game_over', status: next.status, winner: next.winner, reason: next.reason });
  }
  return { state: next, events };
}

export function resignChess(state: ChessState, userId: PlayerId): ActionResult<ChessState> {
  if (state.status !== 'playing') fail('game_over', 'La partida ya terminó.');
  const seat = seatOf(state.seats, userId);
  const winner: ChessColor = seat === 0 ? 'b' : 'w';
  return {
    state: finish(state, 'resigned', winner, 'Abandono'),
    events: [{ type: 'resign', userId }, { type: 'game_over', status: 'resigned', winner, reason: 'Abandono' }],
  };
}

export function claimChessDraw(state: ChessState, userId: PlayerId): ActionResult<ChessState> {
  if (state.status !== 'playing') fail('game_over', 'La partida ya terminó.');
  seatOf(state.seats, userId);
  const claimable = state.halfmove >= 100 || (state.repetitions[positionKey(state)] ?? 0) >= 3 || insufficientMaterial(state.board);
  if (!claimable) fail('not_claimable', 'Todavía no hay motivo para tablas.');
  return {
    state: finish(state, 'draw', null, 'Tablas reclamadas'),
    events: [{ type: 'draw_claimed', userId }, { type: 'game_over', status: 'draw', winner: null, reason: 'Tablas' }],
  };
}

export function applyChess(state: ChessState, action: GameAction, _rng: Rng): ActionResult<ChessState> {
  if (action.type === 'move') return playChessMove(state, action);
  if (action.type === 'resign') return resignChess(state, action.userId);
  if (action.type === 'claim_draw') return claimChessDraw(state, action.userId);
  fail('bad_action', 'Esa acción no existe en el ajedrez.');
}

export function chessView(state: ChessState): ChessState {
  return state;
}

export function chessSettlement(_state: ChessState): SettlementEntry[] {
  return [];
}

export const chessEngine: Engine<ChessState> = {
  kind: 'chess',
  visibility: 'table',
  minPlayers: 2,
  maxPlayers: 2,
  create: createChess,
  legalActions(state, userId) {
    if (state.status !== 'playing') return [];
    const seat = seatOf(state.seats, userId);
    const color: ChessColor = seat === 0 ? 'w' : 'b';
    if (color !== state.turn) return [{ type: 'resign', userId }];
    return [
      ...legalMoves(state, color).map(move => ({
        type: 'move',
        userId,
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      })),
      { type: 'resign', userId },
    ];
  },
  apply: applyChess,
  view: state => chessView(state),
  settlement: chessSettlement,
  isOver: state => state.status !== 'playing',
};
