import assert from 'node:assert/strict';
import test from 'node:test';
import { applyLudo, createLudo, LUDO_GOAL, type LudoState } from '../src/ludo.ts';

const seats = [
  { userId: 'ana', name: 'Ana', seat: 0 },
  { userId: 'leo', name: 'Leo', seat: 1 },
  { userId: 'mia', name: 'Mia', seat: 2 },
  { userId: 'sol', name: 'Sol', seat: 3 },
];

const six = () => 0.99;
const one = () => 0;

function fresh(): LudoState {
  return createLudo({ seats, rng: six });
}

test('a new table keeps every token in the yard', () => {
  const state = fresh();
  assert.equal(state.tokens.flat().length, 16);
  assert.ok(state.tokens.flat().every(token => token.pos === -1));
});

test('only a six opens the yard', () => {
  const state = fresh();
  const other = applyLudo(state, { type: 'roll', userId: 'ana' }, one).state;
  assert.equal(other.turn, 1);
  assert.equal(other.dice, null);
  const rolled = applyLudo(state, { type: 'roll', userId: 'ana' }, six).state;
  assert.equal(rolled.phase, 'move');
  assert.equal(rolled.dice, 6);
  const moved = applyLudo(rolled, { type: 'move', userId: 'ana', token: 0 }, six).state;
  assert.equal(moved.tokens[0]![0]!.pos, 0);
});

test('a token needs the exact number to reach the goal', () => {
  const state = fresh();
  state.tokens[0]![0] = { pos: LUDO_GOAL - 1 };
  state.phase = 'move';
  state.dice = 1;
  const done = applyLudo(state, { type: 'move', userId: 'ana', token: 0 }, one).state;
  assert.equal(done.tokens[0]![0]!.pos, LUDO_GOAL);
  const blocked = { ...state, dice: 2 };
  assert.throws(() => applyLudo(blocked, { type: 'move', userId: 'ana', token: 0 }, one), /no puede/i);
});

test('landing on a rival on an unsafe square sends it home', () => {
  const state = fresh();
  state.tokens[0]![0] = { pos: 6 };
  state.tokens[1]![0] = { pos: 48 };
  state.phase = 'move';
  state.dice = 3;
  const moved = applyLudo(state, { type: 'move', userId: 'ana', token: 0 }, one).state;
  assert.equal(moved.tokens[1]![0]!.pos, -1);
});

test('safe squares never capture', () => {
  const state = fresh();
  state.tokens[0]![0] = { pos: 7 };
  state.tokens[1]![0] = { pos: 9 };
  state.phase = 'move';
  state.dice = 1;
  const moved = applyLudo(state, { type: 'move', userId: 'ana', token: 0 }, one).state;
  assert.equal(moved.tokens[0]![0]!.pos, 8);
  assert.equal(moved.tokens[1]![0]!.pos, 9);
});

test('three sixes in a row loses the turn', () => {
  const state = fresh();
  state.sixes = 2;
  const result = applyLudo(state, { type: 'roll', userId: 'ana' }, six).state;
  assert.equal(result.turn, 1);
  assert.equal(result.sixes, 0);
});

test('four tokens on the goal finish the game', () => {
  const state = fresh();
  state.tokens[0] = [{ pos: LUDO_GOAL }, { pos: LUDO_GOAL }, { pos: LUDO_GOAL }, { pos: LUDO_GOAL - 1 }];
  state.phase = 'move';
  state.dice = 1;
  const done = applyLudo(state, { type: 'move', userId: 'ana', token: 3 }, one).state;
  assert.equal(done.phase, 'finished');
  assert.equal(done.winner, 0);
});
