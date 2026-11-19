import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyChess,
  createChess,
  legalMoves,
  playChessMove,
  squareFromName,
  squareName,
  type ChessPiece,
  type ChessState,
} from '../src/chess.ts';
import { seededRng } from '../src/rng.ts';

const seats = [
  { userId: 'ana', name: 'Ana', seat: 0 },
  { userId: 'leo', name: 'Leo', seat: 1 },
];

function fresh(): ChessState {
  return createChess({ seats, rng: seededRng(1) });
}

function empty(overrides: Partial<ChessState> = {}): ChessState {
  return {
    ...fresh(),
    board: Array.from({ length: 64 }, () => null),
    castling: '-',
    enPassant: null,
    halfmove: 0,
    turn: 'w',
    repetitions: {},
    ...overrides,
  };
}

function put(state: ChessState, name: string, piece: ChessPiece): void {
  state.board[squareFromName(name)] = piece;
}

test('a new board offers twenty legal opening moves', () => {
  assert.equal(legalMoves(fresh()).length, 20);
});

test('the square names round-trip', () => {
  for (const name of ['a8', 'e4', 'h1', 'd5']) {
    assert.equal(squareName(squareFromName(name)), name);
  }
});

test('a pawn walks forward one or two squares, never three', () => {
  const state = fresh();
  const moves = legalMoves(state).filter(move => move.from === squareFromName('e2'));
  assert.deepEqual(moves.map(move => squareName(move.to)).sort(), ['e3', 'e4']);
  assert.throws(() => playChessMove(state, { type: 'move', userId: 'ana', from: 'e2', to: 'e5' }), /legal/i);
});

test('a player cannot move the other colour', () => {
  assert.throws(
    () => playChessMove(fresh(), { type: 'move', userId: 'leo', from: 'e7', to: 'e5' }),
    /turno/i,
  );
});

test("fool's mate finishes the game with checkmate", () => {
  let state = fresh();
  const moves: Array<[string, string, string]> = [
    ['ana', 'f2', 'f3'],
    ['leo', 'e7', 'e5'],
    ['ana', 'g2', 'g4'],
    ['leo', 'd8', 'h4'],
  ];
  for (const [userId, from, to] of moves) {
    state = playChessMove(state, { type: 'move', userId, from, to }).state;
  }
  assert.equal(state.status, 'checkmate');
  assert.equal(state.winner, 'b');
  assert.equal(state.reason, 'Jaque mate');
});

test('castling moves the rook with the king', () => {
  const state = empty({ castling: 'K', turn: 'w' });
  put(state, 'e1', { color: 'w', role: 'k' });
  put(state, 'h1', { color: 'w', role: 'r' });
  put(state, 'e8', { color: 'b', role: 'k' });
  const result = playChessMove(state, { type: 'move', userId: 'ana', from: 'e1', to: 'g1' });
  assert.equal(result.state.board[squareFromName('g1')]?.role, 'k');
  assert.equal(result.state.board[squareFromName('f1')]?.role, 'r');
  assert.equal(result.state.board[squareFromName('h1')], null);
});

test('castling is refused out of check', () => {
  const state = empty({ castling: 'K', turn: 'w' });
  put(state, 'e1', { color: 'w', role: 'k' });
  put(state, 'h1', { color: 'w', role: 'r' });
  put(state, 'e8', { color: 'b', role: 'r' });
  put(state, 'e2', { color: 'b', role: 'r' });
  assert.equal(legalMoves(state).some(move => move.from === squareFromName('e1') && move.to === squareFromName('g1')), false);
});

test('en passant removes the pawn that had just double-stepped', () => {
  const state = empty({ turn: 'b' });
  put(state, 'e1', { color: 'w', role: 'k' });
  put(state, 'e8', { color: 'b', role: 'k' });
  put(state, 'e5', { color: 'w', role: 'p' });
  put(state, 'd7', { color: 'b', role: 'p' });
  const afterBlack = playChessMove(state, { type: 'move', userId: 'leo', from: 'd7', to: 'd5' }).state;
  assert.equal(afterBlack.enPassant, squareFromName('d6'));
  const afterWhite = playChessMove(afterBlack, { type: 'move', userId: 'ana', from: 'e5', to: 'd6' }).state;
  assert.equal(afterWhite.board[squareFromName('d6')]?.role, 'p');
  assert.equal(afterWhite.board[squareFromName('d5')], null);
  assert.equal(afterWhite.halfmove, 0);
});

test('a pawn that reaches the last row becomes the chosen piece', () => {
  const state = empty({ turn: 'w' });
  put(state, 'e1', { color: 'w', role: 'k' });
  put(state, 'e8', { color: 'b', role: 'k' });
  put(state, 'a7', { color: 'w', role: 'p' });
  const result = playChessMove(state, { type: 'move', userId: 'ana', from: 'a7', to: 'a8', promotion: 'q' }).state;
  assert.deepEqual(result.board[squareFromName('a8')], { color: 'w', role: 'q' });
});

test('resigning hands the game to the rival', () => {
  const result = applyChess(fresh(), { type: 'resign', userId: 'ana' }, seededRng(1));
  assert.equal(result.state.status, 'resigned');
  assert.equal(result.state.winner, 'b');
});

test('a bare king against a king is a draw', () => {
  const state = empty({ turn: 'w' });
  put(state, 'e1', { color: 'w', role: 'k' });
  put(state, 'e8', { color: 'b', role: 'k' });
  const result = playChessMove(state, { type: 'move', userId: 'ana', from: 'e1', to: 'e2' }).state;
  assert.equal(result.status, 'draw');
  assert.equal(result.reason, 'Material insuficiente');
});
