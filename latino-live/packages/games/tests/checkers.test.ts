import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyCheckers,
  capturePaths,
  createCheckers,
  legalCheckersSteps,
  startingCheckersBoard,
  type CheckersState,
} from '../src/checkers.ts';
import { seededRng } from '../src/rng.ts';

const seats = [
  { userId: 'ana', name: 'Ana', seat: 0 },
  { userId: 'leo', name: 'Leo', seat: 1 },
];

function fresh(): CheckersState {
  return createCheckers({ seats, rng: seededRng(2) });
}

function empty(): CheckersState {
  return {
    ...fresh(),
    board: Array.from({ length: 64 }, () => null),
    turn: 'w',
    quietPlies: 0,
  };
}

const at = (file: number, rank: number) => rank * 8 + file;

test('the board starts with twelve pieces per side', () => {
  const board = startingCheckersBoard();
  assert.equal(board.filter(piece => piece?.color === 'w').length, 12);
  assert.equal(board.filter(piece => piece?.color === 'b').length, 12);
});

test('a white man steps forward but never backward', () => {
  const state = empty();
  state.board[at(2, 5)] = { color: 'w', king: false };
  const moves = legalCheckersSteps(state, 'w').map(step => step.path[0]);
  assert.ok(moves.includes(at(1, 4)));
  assert.ok(moves.includes(at(3, 4)));
  assert.equal(moves.includes(at(1, 6)), false);
});

test('capturing is mandatory and the whole chain travels in one action', () => {
  const state = empty();
  state.board[at(2, 5)] = { color: 'w', king: false };
  state.board[at(3, 4)] = { color: 'b', king: false };
  state.board[at(5, 2)] = { color: 'b', king: false };
  const steps = capturePaths(state.board, at(2, 5), { color: 'w', king: false });
  const chain = steps.find(step => step.captures.length === 2);
  assert.ok(chain, 'the double capture must be one step');
  assert.deepEqual(chain!.path, [at(4, 3), at(6, 1)]);
  assert.throws(
    () => applyCheckers(state, { type: 'move', userId: 'ana', from: at(2, 5), to: at(1, 4) }),
    /capturar/i,
  );
  const played = applyCheckers(state, {
    type: 'move',
    userId: 'ana',
    from: at(2, 5),
    path: [at(4, 3), at(6, 1)],
  }).state;
  assert.equal(played.board[at(3, 4)], null);
  assert.equal(played.board[at(5, 2)], null);
  assert.equal(played.board[at(6, 1)]?.color, 'w');
});

test('a man that reaches the last row is crowned', () => {
  const state = empty();
  state.board[at(0, 1)] = { color: 'w', king: false };
  const played = applyCheckers(state, { type: 'move', userId: 'ana', from: at(0, 1), to: at(1, 0) }).state;
  assert.equal(played.board[at(1, 0)]?.king, true);
});

test('a king flies along the diagonal and captures at distance', () => {
  const state = empty();
  state.board[at(1, 1)] = { color: 'w', king: true };
  state.board[at(3, 3)] = { color: 'b', king: false };
  const steps = capturePaths(state.board, at(1, 1), { color: 'w', king: true });
  assert.ok(steps.some(step => step.captures[0] === at(3, 3) && step.path[0] === at(4, 4)));
});

test('a player with no moves loses', () => {
  const state = empty();
  state.board[at(2, 2)] = { color: 'w', king: true };
  state.board[at(1, 1)] = { color: 'b', king: false };
  const played = applyCheckers(state, { type: 'move', userId: 'ana', from: at(2, 2), path: [at(0, 0)] }).state;
  assert.equal(played.status, 'finished');
  assert.equal(played.winner, 'w');
});
