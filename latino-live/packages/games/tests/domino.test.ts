import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyDomino,
  createDomino,
  dominoView,
  fullDominoSet,
  pipTotal,
  sidesForTile,
  type DominoState,
} from '../src/domino.ts';
import { seededRng } from '../src/rng.ts';

const two = [
  { userId: 'ana', name: 'Ana', seat: 0 },
  { userId: 'leo', name: 'Leo', seat: 1 },
];
const four = [...two, { userId: 'mia', name: 'Mia', seat: 2 }, { userId: 'sol', name: 'Sol', seat: 3 }];

function game(seats = two): DominoState {
  return createDomino({ seats, rng: seededRng(7) });
}

test('double-six has twenty-eight tiles', () => {
  const set = fullDominoSet();
  assert.equal(set.length, 28);
  assert.equal(new Set(set).size, 28);
  assert.equal(pipTotal(['6-6', '3-2']), 17);
});

test('four players leave no boneyard and two leave fourteen', () => {
  assert.equal(game(four).boneyard.length, 0);
  assert.equal(game(two).boneyard.length, 14);
});

test('the holder of the double six opens', () => {
  const state = game(four);
  assert.ok(state.hands[state.turn]!.includes('6-6'));
});

test('a tile enters by a matching end and the turn passes', () => {
  const state = game(two);
  const seat = state.turn;
  const tile = state.hands[seat]!.find(item => sidesForTile(state, item).includes('first'))!;
  const played = applyDomino(state, { type: 'play', userId: state.seats[seat]!.userId, tile, side: 'first' }).state;
  assert.equal(played.board.length, 1);
  assert.equal(played.turn, (seat + 1) % 2);
  assert.equal(played.leftPip, played.board[0]!.l);
  assert.equal(played.rightPip, played.board[0]!.r);
});

test('playing a tile you do not hold is refused', () => {
  const state = game(two);
  const other = state.seats[(state.turn + 1) % 2]!.userId;
  assert.throws(() => applyDomino(state, { type: 'play', userId: other, tile: '0-0', side: 'first' }), /turno/i);
});

test('a viewer only sees their own hand', () => {
  const state = game(four);
  const mine = state.seats[0]!.userId;
  const view = dominoView(state, mine);
  assert.equal(view.hands[0]!.length, 7);
  assert.equal(view.hands[1]!.length, 0);
  assert.deepEqual(view.handCounts, [7, 7, 7, 7]);
  assert.equal(view.boneyard.length, 0);
});

test('drawing adds a tile and keeps the turn', () => {
  const state = game(two);
  const seat = state.turn;
  const drawn = applyDomino(state, { type: 'draw', userId: state.seats[seat]!.userId }).state;
  assert.equal(drawn.hands[seat]!.length, 8);
  assert.equal(drawn.turn, seat);
  assert.equal(drawn.boneyard.length, state.boneyard.length - 1);
});
