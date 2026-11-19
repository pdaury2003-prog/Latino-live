/**
 * Texas Hold'em sin límite, de 2 a 6 jugadores.
 *
 * El motor lleva las ciegas, las rondas de apuesta, los all-in y los botes
 * laterales. Al terminar reparte el bote entre las mejores manos y deja en
 * `payouts` lo que vuelve a cada billetera.
 *
 * Variante de la casa: una sola mano por mesa (se vuelve a crear al terminar),
 * sin recompras a mitad de mano.
 */

import { assertBet, type BetLimits } from '../betting.ts';
import { drawCard, shuffledDeck, type Card } from '../cards.ts';
import {
  fail,
  type ActionResult,
  type CreateInput,
  type Engine,
  type GameAction,
  type GameEvent,
  type PlayerId,
  type Rng,
  type Seat,
  type SettlementEntry,
} from '../types.ts';

export type PokerStreet = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'finished';

export type HandRank = {
  category: number;
  values: number[];
  name: string;
};

export type PokerWinner = { userId: PlayerId; seat: number; amount: number; hand: string };

export type PokerResult = {
  winners: PokerWinner[];
  showdown: Array<{ userId: PlayerId; hand: string; best: number[] }>;
  pot: number;
};

export type PokerState = {
  kind: 'poker';
  seats: Seat[];
  deck: Card[];
  community: Card[];
  hole: Card[][];
  stacks: number[];
  button: number;
  smallBlind: number;
  bigBlind: number;
  street: PokerStreet;
  turn: number;
  currentBet: number;
  minRaise: number;
  roundBets: number[];
  committed: number[];
  folded: boolean[];
  allIn: boolean[];
  acted: boolean[];
  pot: number;
  status: 'playing' | 'finished';
  result: PokerResult | null;
  payouts: number[];
};

const CATEGORY_NAMES = [
  'Carta alta', 'Pareja', 'Dos parejas', 'Trío', 'Escalera', 'Color', 'Full', 'Póker', 'Escalera de color',
];
const MAX_PLAYERS = 6;

function straightHigh(ranks: readonly number[]): number | null {
  const unique = [...new Set(ranks)].sort((a, b) => b - a);
  if (unique.includes(14)) unique.push(1);
  for (let index = 0; index < unique.length - 4; index += 1) {
    const top = unique[index]!;
    if (
      unique[index + 1] === top - 1
      && unique[index + 2] === top - 2
      && unique[index + 3] === top - 3
      && unique[index + 4] === top - 4
    ) return top;
  }
  return null;
}

/** Las cinco mejores cartas de una mano de 5 a 7. */
export function evaluateHand(cards: readonly Card[]): HandRank {
  if (cards.length < 5) fail('short_hand', 'Hacen falta cinco cartas para comparar.');
  const byRank = new Map<number, number>();
  const bySuit = new Map<string, number[]>();
  for (const card of cards) {
    byRank.set(card.rank, (byRank.get(card.rank) ?? 0) + 1);
    const list = bySuit.get(card.suit) ?? [];
    list.push(card.rank);
    bySuit.set(card.suit, list);
  }
  const counts = [...byRank.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
  const flush = [...bySuit.values()].find(list => list.length >= 5);

  if (flush) {
    const flushRanks = [...flush].sort((a, b) => b - a);
    const high = straightHigh(flushRanks);
    if (high !== null) return { category: 8, values: [high], name: CATEGORY_NAMES[8]! };
  }

  const four = counts.find(([, count]) => count === 4);
  if (four) {
    const kicker = Math.max(...ranks.filter(rank => rank !== four[0]));
    return { category: 7, values: [four[0], kicker], name: CATEGORY_NAMES[7]! };
  }

  const trips = counts.filter(([, count]) => count >= 3).map(([rank]) => rank);
  const pairs = counts.filter(([, count]) => count >= 2).map(([rank]) => rank);
  if (trips.length > 0) {
    const trip = Math.max(...trips);
    const pair = pairs.filter(rank => rank !== trip).sort((a, b) => b - a)[0];
    if (pair !== undefined) return { category: 6, values: [trip, pair], name: CATEGORY_NAMES[6]! };
  }

  if (flush) {
    const top = [...flush].sort((a, b) => b - a).slice(0, 5);
    return { category: 5, values: top, name: CATEGORY_NAMES[5]! };
  }

  const straight = straightHigh(ranks);
  if (straight !== null) return { category: 4, values: [straight], name: CATEGORY_NAMES[4]! };

  if (trips.length > 0) {
    const trip = Math.max(...trips);
    const kickers = ranks.filter(rank => rank !== trip).slice(0, 2);
    return { category: 3, values: [trip, ...kickers], name: CATEGORY_NAMES[3]! };
  }

  const sortedPairs = pairs.sort((a, b) => b - a);
  if (sortedPairs.length >= 2) {
    const [high, low] = sortedPairs;
    const kicker = Math.max(...ranks.filter(rank => rank !== high && rank !== low));
    return { category: 2, values: [high!, low!, kicker], name: CATEGORY_NAMES[2]! };
  }

  if (sortedPairs.length === 1) {
    const pair = sortedPairs[0]!;
    const kickers = ranks.filter(rank => rank !== pair).slice(0, 3);
    return { category: 1, values: [pair, ...kickers], name: CATEGORY_NAMES[1]! };
  }

  return { category: 0, values: ranks.slice(0, 5), name: CATEGORY_NAMES[0]! };
}

export function compareHands(a: HandRank, b: HandRank): number {
  if (a.category !== b.category) return a.category - b.category;
  for (let index = 0; index < Math.max(a.values.length, b.values.length); index += 1) {
    const left = a.values[index] ?? 0;
    const right = b.values[index] ?? 0;
    if (left !== right) return left - right;
  }
  return 0;
}

function stackLeft(state: PokerState, seat: number): number {
  return state.stacks[seat]! - state.committed[seat]!;
}

function activeSeats(state: PokerState): number[] {
  return state.folded.map((folded, seat) => (folded ? -1 : seat)).filter(seat => seat >= 0);
}

function seatsWithChips(state: PokerState): number[] {
  return activeSeats(state).filter(seat => stackLeft(state, seat) > 0);
}

function findTurn(state: PokerState, from: number): number {
  const count = state.seats.length;
  for (let step = 1; step <= count; step += 1) {
    const seat = (from + step) % count;
    if (!state.folded[seat] && stackLeft(state, seat) > 0) return seat;
  }
  return -1;
}

function firstFrom(state: PokerState, start: number): number {
  const count = state.seats.length;
  for (let step = 0; step < count; step += 1) {
    const seat = (start + step + count) % count;
    if (!state.folded[seat] && stackLeft(state, seat) > 0) return seat;
  }
  return -1;
}

function firstAfterButton(state: PokerState, preflop: boolean): number {
  const count = state.seats.length;
  if (preflop) {
    if (count === 2) return state.button;
    return firstFrom(state, state.button + 3);
  }
  return firstFrom(state, state.button + 1);
}

function post(state: PokerState, seat: number, amount: number): number {
  const paid = Math.min(amount, stackLeft(state, seat));
  state.committed[seat] = (state.committed[seat] ?? 0) + paid;
  state.roundBets[seat] = (state.roundBets[seat] ?? 0) + paid;
  if (stackLeft(state, seat) === 0) state.allIn[seat] = true;
  return paid;
}

export function createPoker(input: CreateInput, limits?: BetLimits): PokerState {
  const seats = input.seats.slice(0, MAX_PLAYERS).map((seat, index) => ({ ...seat, seat: index }));
  if (seats.length < 2) fail('not_enough_players', 'El póker necesita al menos dos personas.');
  const bigBlind = Math.max(2, Math.floor(Number(input.options?.bigBlind ?? 2)));
  const smallBlind = Math.max(1, Math.floor(bigBlind / 2));
  const stacks = seats.map(seat => assertBet(input.stakes?.[seat.userId] ?? 0, limits));
  if (stacks.some(stack => stack < bigBlind)) fail('short_stack', `Cada jugador entra con al menos ${bigBlind} diamantes.`);
  const deck = shuffledDeck(input.rng, 1);
  const hole = seats.map(() => [drawCard(deck), drawCard(deck)]);
  const button = 0;
  const state: PokerState = {
    kind: 'poker',
    seats,
    deck,
    community: [],
    hole,
    stacks,
    button,
    smallBlind,
    bigBlind,
    street: 'preflop',
    turn: 0,
    currentBet: 0,
    minRaise: bigBlind,
    roundBets: seats.map(() => 0),
    committed: seats.map(() => 0),
    folded: seats.map(() => false),
    allIn: seats.map(() => false),
    acted: seats.map(() => false),
    pot: 0,
    status: 'playing',
    result: null,
    payouts: seats.map(() => 0),
  };

  if (seats.length === 2) {
    post(state, 0, smallBlind);
    post(state, 1, bigBlind);
  } else {
    post(state, (button + 1) % seats.length, smallBlind);
    post(state, (button + 2) % seats.length, bigBlind);
  }
  state.currentBet = Math.max(...state.roundBets);
  const first = firstAfterButton(state, true);
  state.turn = first >= 0 ? first : 0;
  state.pot = state.committed.reduce((sum, value) => sum + value, 0);
  return state;
}

function buildPots(state: PokerState): Array<{ amount: number; eligible: number[] }> {
  const levels = [...new Set(state.committed.filter(value => value > 0))].sort((a, b) => a - b);
  const pots: Array<{ amount: number; eligible: number[] }> = [];
  let previous = 0;
  for (const level of levels) {
    let amount = 0;
    state.committed.forEach(committed => {
      amount += Math.min(committed, level) - Math.min(committed, previous);
    });
    const eligible = state.folded
      .map((folded, seat) => (!folded && state.committed[seat]! >= level ? seat : -1))
      .filter(seat => seat >= 0);
    if (amount > 0) pots.push({ amount, eligible });
    previous = level;
  }
  return pots;
}

function award(state: PokerState, winners: number[], amount: number, labels: Map<number, string>): PokerWinner[] {
  if (winners.length === 0 || amount <= 0) return [];
  const share = Math.floor(amount / winners.length);
  let remainder = amount - share * winners.length;
  const ordered: number[] = [];
  for (let step = 1; step <= state.seats.length; step += 1) {
    const seat = (state.button + step) % state.seats.length;
    if (winners.includes(seat)) ordered.push(seat);
  }
  const paid: PokerWinner[] = [];
  for (const seat of ordered) {
    let value = share;
    if (remainder > 0) {
      value += 1;
      remainder -= 1;
    }
    state.payouts[seat] = (state.payouts[seat] ?? 0) + value;
    paid.push({
      userId: state.seats[seat]!.userId,
      seat,
      amount: value,
      hand: labels.get(seat) ?? '',
    });
  }
  return paid;
}

function finishHand(state: PokerState): PokerState {
  const active = activeSeats(state);
  const total = state.committed.reduce((sum, value) => sum + value, 0);
  let winners: PokerWinner[] = [];
  const labels = new Map<number, string>();
  if (active.length === 1) {
    const seat = active[0]!;
    state.payouts[seat] = total;
    winners = [{
      userId: state.seats[seat]!.userId,
      seat,
      amount: total,
      hand: 'Sin mostrar',
    }];
  } else {
    const ranks = new Map<number, HandRank>();
    for (const seat of active) {
      const hand = evaluateHand([...state.hole[seat]!, ...state.community]);
      ranks.set(seat, hand);
      labels.set(seat, hand.name);
    }
    for (const pot of buildPots(state)) {
      const candidates = pot.eligible.length > 0 ? pot.eligible : active;
      let best: HandRank | null = null;
      let winnersSeats: number[] = [];
      for (const seat of candidates) {
        const hand = ranks.get(seat)!;
        if (!best || compareHands(hand, best) > 0) {
          best = hand;
          winnersSeats = [seat];
        } else if (compareHands(hand, best) === 0) {
          winnersSeats.push(seat);
        }
      }
      winners = [...winners, ...award(state, winnersSeats, pot.amount, labels)];
    }
  }
  const showdown = active.length > 1
    ? active.map(seat => {
      const hand = evaluateHand([...state.hole[seat]!, ...state.community]);
      return { userId: state.seats[seat]!.userId, hand: hand.name, best: [hand.category, ...hand.values] };
    })
    : [];
  return {
    ...state,
    street: 'finished',
    status: 'finished',
    pot: total,
    result: { winners, showdown, pot: total },
    turn: -1,
  };
}

function dealStreet(state: PokerState, street: PokerStreet): PokerState {
  const deck = [...state.deck];
  const community = [...state.community];
  if (street === 'flop') community.push(drawCard(deck), drawCard(deck), drawCard(deck));
  if (street === 'turn' || street === 'river') community.push(drawCard(deck));
  return {
    ...state,
    deck,
    community,
    street,
    roundBets: state.roundBets.map(() => 0),
    currentBet: 0,
    minRaise: state.bigBlind,
    acted: state.acted.map(() => false),
  };
}

const NEXT_STREET: Record<string, PokerStreet | null> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
  river: null,
};

function runToShowdown(state: PokerState): PokerState {
  let next = state;
  while (next.street !== 'river' && next.street !== 'showdown' && next.street !== 'finished') {
    const street = NEXT_STREET[next.street];
    if (!street) break;
    next = dealStreet(next, street);
  }
  return finishHand(next);
}

function roundComplete(state: PokerState): boolean {
  const contenders = seatsWithChips(state);
  if (contenders.length === 0) return true;
  return contenders.every(seat => state.acted[seat] && state.roundBets[seat] === state.currentBet);
}

function advance(state: PokerState): PokerState {
  const active = activeSeats(state);
  if (active.length <= 1) return finishHand(state);
  if (state.street === 'river') return finishHand(state);
  const contenders = seatsWithChips(state);
  if (contenders.length <= 1) return runToShowdown(state);
  const street = NEXT_STREET[state.street];
  if (!street) return finishHand(state);
  let next = dealStreet(state, street);
  const first = firstAfterButton(next, false);
  if (first < 0) return runToShowdown(next);
  next = { ...next, turn: first };
  return next;
}

function payCall(state: PokerState, seat: number): void {
  post(state, seat, state.currentBet - state.roundBets[seat]!);
  state.acted[seat] = true;
}

export function applyPoker(state: PokerState, action: GameAction): ActionResult<PokerState> {
  if (state.status !== 'playing') fail('game_over', 'Esta mano ya terminó.');
  const seat = state.seats.findIndex(item => item.userId === action.userId);
  if (seat < 0) fail('not_seated', 'No estás sentado en esta mesa.');
  if (seat !== state.turn) fail('not_your_turn', 'Todavía no es tu turno.');
  if (state.folded[seat]) fail('folded', 'Ya no estás en esta mano.');

  const next: PokerState = {
    ...state,
    roundBets: [...state.roundBets],
    committed: [...state.committed],
    folded: [...state.folded],
    allIn: [...state.allIn],
    acted: [...state.acted],
    payouts: [...state.payouts],
  };
  const events: GameEvent[] = [];
  const toCall = next.currentBet - (next.roundBets[seat] ?? 0);
  let betRaised = false;

  switch (action.type) {
    case 'fold': {
      next.folded[seat] = true;
      next.acted[seat] = true;
      events.push({ type: 'fold', userId: action.userId, seat });
      break;
    }
    case 'check': {
      if (toCall > 0) fail('cannot_check', 'Hay una apuesta: iguala o retírate.');
      next.acted[seat] = true;
      events.push({ type: 'check', userId: action.userId, seat });
      break;
    }
    case 'call': {
      payCall(next, seat);
      events.push({ type: 'call', userId: action.userId, seat, amount: next.roundBets[seat] });
      break;
    }
    case 'raise': {
      const target = Number(action.amount);
      if (!Number.isInteger(target)) fail('bad_raise', 'Escribe cuánto quieres apostar.');
      const maxTarget = (next.roundBets[seat] ?? 0) + stackLeft(next, seat);
      if (target <= next.currentBet) fail('bad_raise', 'La subida tiene que superar la apuesta actual.');
      if (target > maxTarget) fail('bad_raise', 'No tienes tantos diamantes en la mesa.');
      const allInRaise = target === maxTarget;
      const raiseBy = target - next.currentBet;
      if (!allInRaise && raiseBy < next.minRaise) fail('bad_raise', `La subida mínima es ${next.minRaise}.`);
      const paid = post(next, seat, target - (next.roundBets[seat] ?? 0));
      if (paid <= toCall) fail('bad_raise', 'Esa subida no alcanza.');
      const previous = next.currentBet;
      next.currentBet = next.roundBets[seat]!;
      next.minRaise = Math.max(next.minRaise, next.currentBet - previous);
      next.acted[seat] = true;
      betRaised = true;
      events.push({ type: 'raise', userId: action.userId, seat, to: next.currentBet });
      break;
    }
    case 'all_in': {
      const previous = next.currentBet;
      const paid = post(next, seat, stackLeft(next, seat));
      if (paid <= 0) fail('no_chips', 'Ya no te quedan diamantes en la mesa.');
      next.acted[seat] = true;
      if (next.roundBets[seat]! > previous) {
        next.currentBet = next.roundBets[seat]!;
        next.minRaise = Math.max(next.minRaise, next.currentBet - previous);
        betRaised = true;
      }
      events.push({ type: 'all_in', userId: action.userId, seat, amount: next.roundBets[seat] });
      break;
    }
    default:
      fail('bad_action', 'Esa acción no existe en el póker.');
  }

  if (betRaised) {
    next.acted = next.acted.map((acted, other) => (
      other === seat || next.folded[other] || next.allIn[other] ? acted : false
    ));
  }
  next.pot = next.committed.reduce((sum, value) => sum + value, 0);

  const active = activeSeats(next);
  if (active.length <= 1) {
    const finished = finishHand(next);
    events.push({ type: 'game_over', result: finished.result });
    return { state: finished, events };
  }
  if (!roundComplete(next)) {
    const following = findTurn(next, seat);
    if (following < 0) {
      const finished = runToShowdown(next);
      events.push({ type: 'game_over', result: finished.result });
      return { state: finished, events };
    }
    return { state: { ...next, turn: following }, events };
  }
  const advanced = advance(next);
  if (advanced.status === 'finished') events.push({ type: 'game_over', result: advanced.result });
  return { state: advanced, events };
}

export function pokerView(state: PokerState, viewerId: PlayerId | null): PokerState {
  const mine = viewerId ? state.seats.findIndex(seat => seat.userId === viewerId) : -1;
  const showAll = state.status === 'finished';
  return {
    ...state,
    deck: [],
    hole: state.hole.map((cards, seat) => {
      if (seat === mine) return cards;
      if (showAll && !state.folded[seat]) return cards;
      return [];
    }),
  };
}

export const pokerEngine: Engine<PokerState> = {
  kind: 'poker',
  visibility: 'private',
  minPlayers: 2,
  maxPlayers: MAX_PLAYERS,
  create: input => createPoker(input),
  legalActions(state, userId) {
    if (state.status !== 'playing') return [];
    const seat = state.seats.findIndex(item => item.userId === userId);
    if (seat < 0 || seat !== state.turn) return [];
    const toCall = state.currentBet - (state.roundBets[seat] ?? 0);
    const actions: GameAction[] = [{ type: 'fold', userId }];
    if (toCall === 0) actions.push({ type: 'check', userId });
    if (toCall > 0) actions.push({ type: 'call', userId });
    actions.push({ type: 'raise', userId }, { type: 'all_in', userId });
    return actions;
  },
  apply: (state, action) => applyPoker(state, action),
  view: (state, viewerId) => pokerView(state, viewerId),
  settlement: (state): SettlementEntry[] => state.seats.map((seat, index) => ({
    userId: seat.userId,
    // La entrada ya se cobró al abrir la mesa; aquí solo vuelve lo jugado.
    delta: (state.payouts[index] ?? 0) - (state.committed[index] ?? 0),
  })),
  isOver: state => state.status === 'finished',
};
