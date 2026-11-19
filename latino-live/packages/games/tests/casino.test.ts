import assert from 'node:assert/strict';
import test from 'node:test';
import { createSlots, slotsEngine } from '../src/casino/slots.ts';
import { createRoulette, spinRoulette, wheelColor } from '../src/casino/roulette.ts';
import {
  applyBlackjack,
  blackjackView,
  createBlackjack,
  type BlackjackState,
} from '../src/casino/blackjack.ts';
import { handValue, isBlackjack, type Card, type Rank } from '../src/cards.ts';
import { seededRng } from '../src/rng.ts';
import { assertBet } from '../src/betting.ts';
import type { Seat } from '../src/types.ts';

const ana: Seat = { userId: 'ana', name: 'Ana', seat: 0 };
const leo: Seat = { userId: 'leo', name: 'Leo', seat: 1 };

const card = (rank: Rank, suit: Card['suit'] = 'S'): Card => ({ rank, suit, code: `${rank}${suit}` });

test('slots rejects a stake under five diamonds', () => {
  assert.throws(
    () => createSlots({ seats: [ana], rng: seededRng(1), stakes: { ana: 4 } }),
    /mínima/i,
  );
});

test('slots pays every line and settles the wallet', () => {
  const state = createSlots({ seats: [ana], rng: () => 0.99, stakes: { ana: 50 } });
  assert.equal(state.lineBet, 10);
  assert.equal(state.stake, 50);
  assert.ok(state.grid.flat().every(symbol => symbol === 'wild'));
  assert.equal(state.totalWin, 5 * 34 * 10);
  assert.deepEqual(slotsEngine.settlement(state), [{ userId: 'ana', delta: state.totalWin - 50 }]);
});

test('roulette pays a straight on zero and loses the red bet', () => {
  const state = createRoulette({ seats: [ana], rng: seededRng(1) });
  const result = spinRoulette(state, {
    type: 'spin',
    userId: 'ana',
    bets: [
      { kind: 'straight', value: 0, amount: 10 },
      { kind: 'red', amount: 10 },
    ],
  }, () => 0);
  assert.equal(result.state.spin?.number, 0);
  assert.equal(result.state.spin?.color, 'green');
  assert.equal(result.state.spin?.totalWin, 360);
  assert.equal(result.state.spin?.net, 340);
});

test('roulette pays a dozen and a column three to one', () => {
  const state = createRoulette({ seats: [ana], rng: seededRng(1) });
  const result = spinRoulette(state, {
    type: 'spin',
    userId: 'ana',
    bets: [
      { kind: 'dozen', value: 1, amount: 10 },
      { kind: 'column', value: 2, amount: 10 },
    ],
  }, () => 0.52);
  const number = result.state.spin!.number;
  assert.ok(number >= 1 && number <= 12);
  assert.equal(result.state.spin!.bets[0]!.won, true);
  assert.equal(result.state.spin!.bets[1]!.won, ((number - 1) % 3) + 1 === 2);
  assert.equal(wheelColor(number), 'red');
});

test('roulette refuses numbers that do not exist', () => {
  const state = createRoulette({ seats: [ana], rng: seededRng(1) });
  assert.throws(() => spinRoulette(state, {
    type: 'spin',
    userId: 'ana',
    bets: [{ kind: 'straight', value: 37, amount: 10 }],
  }, () => 0), /no existe/i);
});

test('bets must be whole diamonds inside the limits', () => {
  assert.equal(assertBet(50), 50);
  assert.throws(() => assertBet(0), /mínima/i);
  assert.throws(() => assertBet(5_001), /máxima/i);
  assert.throws(() => assertBet(2.5), /mínima/i);
});

test('blackjack counts aces as one or eleven', () => {
  assert.deepEqual(handValue([card(14), card(9)]), { total: 20, soft: true });
  assert.deepEqual(handValue([card(14), card(14), card(9)]), { total: 21, soft: true });
  assert.equal(isBlackjack([card(14), card(13)]), true);
});

function blackjackState(overrides: Partial<BlackjackState>): BlackjackState {
  return {
    kind: 'blackjack',
    seats: [ana],
    deck: [card(5)],
    player: [card(10), card(9)],
    dealer: [card(10), card(7)],
    status: 'playing',
    stake: 100,
    doubled: false,
    result: null,
    payout: 0,
    net: 0,
    dealerHidden: true,
    ...overrides,
  };
}

test('standing on nineteen beats the dealer seventeen', () => {
  const result = applyBlackjack(blackjackState({}), { type: 'stand', userId: 'ana' }, seededRng(1));
  assert.equal(result.state.status, 'finished');
  assert.equal(result.state.result, 'win');
  assert.equal(result.state.payout, 200);
  assert.equal(result.state.net, 100);
});

test('going over twenty-one loses at once', () => {
  const result = applyBlackjack(
    blackjackState({ player: [card(10), card(6)], deck: [card(10)] }),
    { type: 'hit', userId: 'ana' },
    seededRng(1),
  );
  assert.equal(result.state.result, 'bust');
  assert.equal(result.state.net, -100);
});

test('doubling doubles the stake and draws one card', () => {
  const result = applyBlackjack(
    blackjackState({ player: [card(5), card(6)], deck: [card(10)] }),
    { type: 'double', userId: 'ana' },
    seededRng(1),
  );
  assert.equal(result.state.stake, 200);
  assert.equal(result.state.player.length, 3);
  assert.equal(result.state.status, 'finished');
});

test('the dealer hole card stays hidden while you play', () => {
  const state = blackjackState({});
  const view = blackjackView(state);
  assert.equal(view.dealer.length, 1);
  assert.equal(view.dealerHidden, true);
  assert.equal(blackjackView({ ...state, status: 'finished' }).dealer.length, 2);
});

test('blackjack deals two cards to each side', () => {
  const state = createBlackjack({ seats: [ana, leo], rng: seededRng(9), stakes: { ana: 100 } });
  assert.equal(state.player.length, 2);
  assert.equal(state.dealer.length, 2);
  assert.equal(state.stake, 100);
});
