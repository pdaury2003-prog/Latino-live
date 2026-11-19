/**
 * Blackjack clásico de una mano contra el crupier.
 *
 * - El crupier se planta en 17 (incluido el 17 blando).
 * - El blackjack natural paga 3:2 y las tablas devuelven la apuesta.
 * - Se puede doblar solo con las dos primeras cartas.
 * - No hay seguro ni divisiones: la mesa lo dice antes de sentarse.
 */

import { assertBet, type BetLimits } from '../betting.ts';
import { drawCard, handValue, isBlackjack, shuffledDeck, type Card } from '../cards.ts';
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
} from '../types.ts';

export type BlackjackResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust' | null;

export type BlackjackState = {
  kind: 'blackjack';
  seats: Seat[];
  deck: Card[];
  player: Card[];
  dealer: Card[];
  status: 'playing' | 'finished';
  stake: number;
  doubled: boolean;
  result: BlackjackResult;
  payout: number;
  net: number;
  dealerHidden: boolean;
};

function finish(state: BlackjackState, result: Exclude<BlackjackResult, null>, payout: number): BlackjackState {
  return {
    ...state,
    status: 'finished',
    result,
    payout,
    net: payout - state.stake,
    dealerHidden: false,
  };
}

function settle(state: BlackjackState): BlackjackState {
  const player = handValue(state.player).total;
  const dealer = handValue(state.dealer).total;
  if (isBlackjack(state.player) && isBlackjack(state.dealer)) return finish(state, 'push', state.stake);
  if (isBlackjack(state.player)) return finish(state, 'blackjack', Math.floor(state.stake * 2.5));
  if (isBlackjack(state.dealer)) return finish(state, 'lose', 0);
  if (player > 21) return finish(state, 'bust', 0);
  if (dealer > 21 || player > dealer) return finish(state, 'win', state.stake * 2);
  if (player === dealer) return finish(state, 'push', state.stake);
  return finish(state, 'lose', 0);
}

function dealerPlay(state: BlackjackState): BlackjackState {
  const deck = [...state.deck];
  const dealer = [...state.dealer];
  while (handValue(dealer).total < 17) dealer.push(drawCard(deck));
  return settle({ ...state, deck, dealer });
}

export function createBlackjack(input: CreateInput, limits?: BetLimits): BlackjackState {
  const seat = input.seats[0];
  if (!seat) fail('not_seated', 'Necesitas una cuenta para jugar.');
  const stake = assertBet(input.stakes?.[seat.userId] ?? 0, limits);
  const deck = shuffledDeck(input.rng, 6);
  const player = [drawCard(deck), drawCard(deck)];
  const dealer = [drawCard(deck), drawCard(deck)];
  let state: BlackjackState = {
    kind: 'blackjack',
    seats: [seat],
    deck,
    player,
    dealer,
    status: 'playing',
    stake,
    doubled: false,
    result: null,
    payout: 0,
    net: 0,
    dealerHidden: true,
  };
  if (isBlackjack(player) || isBlackjack(dealer)) state = settle(state);
  return state;
}

export function applyBlackjack(
  state: BlackjackState,
  action: GameAction,
  _rng: Rng,
  limits?: BetLimits,
): ActionResult<BlackjackState> {
  if (state.status !== 'playing') fail('game_over', 'Esta mano ya terminó.');
  const events: GameEvent[] = [];

  if (action.type === 'hit' || action.type === 'double') {
    const doubling = action.type === 'double';
    if (doubling && (state.player.length !== 2 || state.doubled)) {
      fail('cannot_double', 'Solo puedes doblar con las dos primeras cartas.');
    }
    const deck = [...state.deck];
    const player = [...state.player, drawCard(deck)];
    let next: BlackjackState = {
      ...state,
      deck,
      player,
      stake: doubling ? state.stake * 2 : state.stake,
      doubled: doubling || state.doubled,
    };
    if (doubling && limits) assertBet(next.stake, limits);
    events.push({ type: action.type, userId: action.userId, card: player[player.length - 1]!.code });
    const total = handValue(player).total;
    if (total > 21) {
      next = finish(next, 'bust', 0);
    } else if (total === 21 || doubling) {
      next = dealerPlay(next);
    }
    if (next.status === 'finished') {
      events.push({ type: 'game_over', result: next.result, payout: next.payout, net: next.net });
    }
    return { state: next, events };
  }

  if (action.type === 'stand') {
    events.push({ type: 'stand', userId: action.userId });
    const next = dealerPlay(state);
    events.push({ type: 'game_over', result: next.result, payout: next.payout, net: next.net });
    return { state: next, events };
  }

  fail('bad_action', 'Esa acción no existe en el blackjack.');
}

export function blackjackView(state: BlackjackState): BlackjackState {
  if (state.status === 'finished') return { ...state, deck: [] };
  return { ...state, deck: [], dealer: state.dealer.slice(0, 1), dealerHidden: true };
}

export const blackjackEngine: Engine<BlackjackState> = {
  kind: 'blackjack',
  visibility: 'private',
  minPlayers: 1,
  maxPlayers: 1,
  create: input => createBlackjack(input),
  legalActions(state, userId) {
    if (state.status !== 'playing') return [];
    const actions: GameAction[] = [{ type: 'hit', userId }, { type: 'stand', userId }];
    if (state.player.length === 2 && !state.doubled) actions.push({ type: 'double', userId });
    return actions;
  },
  apply: (state, action, rng) => applyBlackjack(state, action, rng),
  view: state => blackjackView(state),
  settlement: (state): SettlementEntry[] => [{ userId: state.seats[0]!.userId, delta: state.net }],
  isOver: state => state.status === 'finished',
};
