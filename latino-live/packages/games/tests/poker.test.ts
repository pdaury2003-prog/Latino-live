import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPoker, compareHands, createPoker, evaluateHand, pokerView, pokerEngine } from '../src/casino/poker.ts';
import { fullDeck, type Card, type Rank, type Suit } from '../src/cards.ts';
import { seededRng } from '../src/rng.ts';

const seats = [
  { userId: 'ana', name: 'Ana', seat: 0 },
  { userId: 'leo', name: 'Leo', seat: 1 },
  { userId: 'mia', name: 'Mia', seat: 2 },
];

const card = (rank: Rank, suit: Suit): Card => ({ rank, suit, code: `${rank}${suit}` });
const hand = (codes: string[]): Card[] => codes.map(code => {
  const suit = code.slice(-1) as Suit;
  const label = code.slice(0, -1);
  const rank = (label === 'A' ? 14 : label === 'K' ? 13 : label === 'J' ? 11 : label === 'Q' ? 12 : Number(label)) as Rank;
  return card(rank, suit);
});

test('the deck has fifty-two different cards', () => {
  const deck = fullDeck();
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(item => item.code)).size, 52);
});

test('the evaluator names every category', () => {
  assert.equal(evaluateHand(hand(['AS', 'KS', 'QS', 'JS', '10S'])).name, 'Escalera de color');
  assert.equal(evaluateHand(hand(['9S', '9H', '9D', '9C', '2S'])).name, 'Póker');
  assert.equal(evaluateHand(hand(['9S', '9H', '9D', '2C', '2S'])).name, 'Full');
  assert.equal(evaluateHand(hand(['AS', 'KS', '9S', '5S', '2S'])).name, 'Color');
  assert.equal(evaluateHand(hand(['9S', '8H', '7D', '6C', '5S'])).name, 'Escalera');
  assert.equal(evaluateHand(hand(['9S', '9H', '9D', 'KC', '2S'])).name, 'Trío');
  assert.equal(evaluateHand(hand(['9S', '9H', 'KD', 'KC', '2S'])).name, 'Dos parejas');
  assert.equal(evaluateHand(hand(['9S', '9H', 'KD', 'QC', '2S'])).name, 'Pareja');
  assert.equal(evaluateHand(hand(['AS', 'KH', 'QD', 'JC', '9S'])).name, 'Carta alta');
});

test('the wheel is a five-high straight', () => {
  const wheel = evaluateHand(hand(['AS', '2H', '3D', '4C', '5S']));
  assert.equal(wheel.category, 4);
  assert.equal(wheel.values[0], 5);
});

test('hands compare by category and then by kickers', () => {
  const pairKings = evaluateHand(hand(['KS', 'KH', 'QD', 'JC', '9S']));
  const pairQueens = evaluateHand(hand(['QS', 'QH', 'KD', 'JC', '9S']));
  assert.ok(compareHands(pairKings, pairQueens) > 0);
  assert.equal(compareHands(pairKings, pairKings), 0);
});

test('a new table posts the blinds and the button acts first', () => {
  const state = createPoker({
    seats: seats.slice(0, 2),
    rng: seededRng(4),
    stakes: { ana: 100, leo: 100 },
  });
  assert.deepEqual(state.committed, [1, 2]);
  assert.equal(state.currentBet, 2);
  assert.equal(state.turn, 0);
  assert.equal(state.hole[0]!.length, 2);
});

test('a full hand runs to showdown and returns the whole pot', () => {
  let state = createPoker({
    seats: seats.slice(0, 2),
    rng: seededRng(11),
    stakes: { ana: 100, leo: 100 },
  });
  state = applyPoker(state, { type: 'call', userId: 'ana' }).state;
  state = applyPoker(state, { type: 'check', userId: 'leo' }).state;
  assert.equal(state.street, 'flop');
  assert.equal(state.community.length, 3);
  for (const street of ['turn', 'river']) {
    state = applyPoker(state, { type: 'check', userId: state.seats[state.turn]!.userId }).state;
    state = applyPoker(state, { type: 'check', userId: state.seats[state.turn]!.userId }).state;
    assert.equal(state.street, street);
  }
  state = applyPoker(state, { type: 'check', userId: state.seats[state.turn]!.userId }).state;
  state = applyPoker(state, { type: 'check', userId: state.seats[state.turn]!.userId }).state;
  assert.equal(state.status, 'finished');
  const paid = state.payouts.reduce((sum, value) => sum + value, 0);
  assert.equal(paid, 4);
  const net = pokerEngine.settlement(state).reduce((sum, entry) => sum + entry.delta, 0);
  assert.equal(net, 0);
});

test('folding gives the pot to the rival', () => {
  const state = createPoker({
    seats: seats.slice(0, 2),
    rng: seededRng(5),
    stakes: { ana: 100, leo: 100 },
  });
  const folded = applyPoker(state, { type: 'fold', userId: 'ana' }).state;
  assert.equal(folded.status, 'finished');
  assert.equal(folded.payouts[1], 3);
  const net = pokerEngine.settlement(folded).reduce((sum, entry) => sum + entry.delta, 0);
  assert.equal(net, 0);
});

test('side pots pay each level and never lose a diamond', () => {
  let state = createPoker({
    seats,
    rng: seededRng(21),
    stakes: { ana: 100, leo: 50, mia: 20 },
    options: { bigBlind: 2 },
  });
  state = applyPoker(state, { type: 'all_in', userId: 'ana' }).state;
  state = applyPoker(state, { type: 'all_in', userId: 'leo' }).state;
  state = applyPoker(state, { type: 'all_in', userId: 'mia' }).state;
  assert.equal(state.status, 'finished');
  assert.deepEqual(state.committed, [100, 50, 20]);
  assert.equal(state.result!.pot, 170);
  assert.equal(state.payouts.reduce((sum, value) => sum + value, 0), 170);
  assert.ok(state.payouts[0]! >= 50, 'the uncalled part comes back');
  const net = pokerEngine.settlement(state).reduce((sum, entry) => sum + entry.delta, 0);
  assert.equal(net, 0);
});

test('a viewer sees only their own hole cards', () => {
  const state = createPoker({
    seats,
    rng: seededRng(8),
    stakes: { ana: 100, leo: 100, mia: 100 },
  });
  const view = pokerView(state, 'ana');
  assert.equal(view.hole[0]!.length, 2);
  assert.equal(view.hole[1]!.length, 0);
  assert.equal(view.hole[2]!.length, 0);
  assert.equal(view.deck.length, 0);
});

test('a raise below the minimum is refused', () => {
  const state = createPoker({
    seats: seats.slice(0, 2),
    rng: seededRng(5),
    stakes: { ana: 100, leo: 100 },
  });
  assert.throws(() => applyPoker(state, { type: 'raise', userId: 'ana', amount: 3 }), /mínima/i);
});

test('a player cannot act out of turn', () => {
  const state = createPoker({
    seats: seats.slice(0, 2),
    rng: seededRng(5),
    stakes: { ana: 100, leo: 100 },
  });
  assert.throws(() => applyPoker(state, { type: 'call', userId: 'leo' }), /turno/i);
});
