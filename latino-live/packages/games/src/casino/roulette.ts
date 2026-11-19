/**
 * Ruleta europea (un solo cero). Se apuesta y se gira en la misma acción: el
 * servidor cobra la suma de las fichas y paga las que aciertan.
 */

import { assertBet, type BetLimits } from '../betting.ts';
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

export type RouletteBetKind = 'straight' | 'red' | 'black' | 'odd' | 'even' | 'low' | 'high' | 'dozen' | 'column';
export type RouletteBet = { kind: RouletteBetKind; value?: number; amount: number };
export type RouletteSpin = {
  number: number;
  color: 'red' | 'black' | 'green';
  bets: Array<RouletteBet & { won: boolean; payout: number }>;
  stake: number;
  totalWin: number;
  net: number;
};

export type RouletteState = {
  kind: 'roulette';
  seats: Seat[];
  status: 'betting' | 'settled';
  spin: RouletteSpin | null;
};

export const WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5,
  24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
] as const;

const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

export function wheelColor(number: number): 'red' | 'black' | 'green' {
  if (number === 0) return 'green';
  return RED.has(number) ? 'red' : 'black';
}

function betWins(bet: RouletteBet, number: number): boolean {
  switch (bet.kind) {
    case 'straight': return bet.value === number;
    case 'red': return wheelColor(number) === 'red';
    case 'black': return wheelColor(number) === 'black';
    case 'odd': return number !== 0 && number % 2 === 1;
    case 'even': return number !== 0 && number % 2 === 0;
    case 'low': return number >= 1 && number <= 18;
    case 'high': return number >= 19 && number <= 36;
    case 'dozen': return number >= 1 && Math.ceil(number / 12) === bet.value;
    case 'column': return number > 0 && ((number - 1) % 3) + 1 === bet.value;
    default: return false;
  }
}

function multiplier(kind: RouletteBetKind): number {
  if (kind === 'straight') return 36;
  if (kind === 'dozen' || kind === 'column') return 3;
  return 2;
}

function parseBets(raw: unknown, limits?: BetLimits): RouletteBet[] {
  if (!Array.isArray(raw) || raw.length === 0) fail('no_bets', 'Pon al menos una ficha.');
  if (raw.length > 20) fail('too_many_bets', 'Demasiadas fichas en una tirada.');
  return raw.map((entry): RouletteBet => {
    if (!entry || typeof entry !== 'object') fail('bad_bet', 'Esa ficha no se entiende.');
    const record = entry as Record<string, unknown>;
    const kind = record.kind as RouletteBetKind;
    const amount = assertBet(Number(record.amount), limits);
    if (kind === 'straight') {
      const value = Number(record.value);
      if (!Number.isInteger(value) || value < 0 || value > 36) fail('bad_bet', 'Ese número no existe.');
      return { kind, value, amount };
    }
    if (kind === 'dozen' || kind === 'column') {
      const value = Number(record.value);
      if (![1, 2, 3].includes(value)) fail('bad_bet', 'Elige una docena o columna del 1 al 3.');
      return { kind, value, amount };
    }
    if (!['red', 'black', 'odd', 'even', 'low', 'high'].includes(kind)) fail('bad_bet', 'Ese tipo de apuesta no existe.');
    return { kind, amount };
  });
}

export function createRoulette(input: CreateInput): RouletteState {
  const seat = input.seats[0];
  if (!seat) fail('not_seated', 'Necesitas una cuenta para jugar.');
  return { kind: 'roulette', seats: [seat], status: 'betting', spin: null };
}

export function spinRoulette(
  state: RouletteState,
  action: GameAction,
  rng: Rng,
  limits?: BetLimits,
): ActionResult<RouletteState> {
  if (state.status === 'settled') fail('game_over', 'Esta tirada ya terminó.');
  if (action.type !== 'spin') fail('bad_action', 'Esa acción no existe en la ruleta.');
  const bets = parseBets(action.bets, limits);
  const number = WHEEL[Math.floor(rng() * WHEEL.length)]!;
  const color = wheelColor(number);
  const settled = bets.map(bet => {
    const won = betWins(bet, number);
    return { ...bet, won, payout: won ? bet.amount * multiplier(bet.kind) : 0 };
  });
  const stake = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const totalWin = settled.reduce((sum, bet) => sum + bet.payout, 0);
  const spin: RouletteSpin = { number, color, bets: settled, stake, totalWin, net: totalWin - stake };
  const events: GameEvent[] = [{ type: 'spin', userId: action.userId, number, color, totalWin, net: spin.net }];
  return { state: { ...state, status: 'settled', spin }, events };
}

export const rouletteEngine: Engine<RouletteState> = {
  kind: 'roulette',
  visibility: 'private',
  minPlayers: 1,
  maxPlayers: 1,
  create: createRoulette,
  legalActions: () => [],
  apply: (state, action, rng) => spinRoulette(state, action, rng),
  view: state => state,
  settlement: (state): SettlementEntry[] => (
    state.spin ? [{ userId: state.seats[0]!.userId, delta: state.spin.net }] : []
  ),
  isOver: state => state.status === 'settled',
};
