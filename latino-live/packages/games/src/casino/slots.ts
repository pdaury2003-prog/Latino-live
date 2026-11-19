/**
 * Tragamonedas de 3 rodillos y 5 líneas. El RTP teórico es 93,6 % con la tabla
 * de abajo; cada tirada es independiente y se paga en el acto.
 */

import { assertBet, type BetLimits } from '../betting.ts';
import {
  fail,
  type ActionResult,
  type CreateInput,
  type Engine,
  type Rng,
  type Seat,
  type SettlementEntry,
} from '../types.ts';

export type SlotsSymbol = 'cherry' | 'lemon' | 'bell' | 'star' | 'seven' | 'diamond' | 'wild';
export type SlotLine = { line: number; symbols: SlotsSymbol[]; multiplier: number; win: number };

export type SlotsState = {
  kind: 'slots';
  seats: Seat[];
  status: 'settled';
  stake: number;
  lineBet: number;
  grid: SlotsSymbol[][];
  lines: SlotLine[];
  totalWin: number;
  net: number;
};

const WEIGHTS: Array<[SlotsSymbol, number]> = [
  ['cherry', 30],
  ['lemon', 25],
  ['bell', 20],
  ['star', 12],
  ['seven', 8],
  ['diamond', 3],
  ['wild', 2],
];
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0);

export const SLOTS_PAYTABLE: Record<SlotsSymbol, number> = {
  cherry: 3,
  lemon: 3,
  bell: 5,
  star: 7,
  seven: 12,
  diamond: 30,
  wild: 34,
};

/** Las cinco líneas: filas y diagonales de la cuadrícula 3×3. */
const LINES: Array<Array<[number, number]>> = [
  [[1, 0], [1, 1], [1, 2]],
  [[0, 0], [0, 1], [0, 2]],
  [[2, 0], [2, 1], [2, 2]],
  [[0, 0], [1, 1], [2, 2]],
  [[2, 0], [1, 1], [0, 2]],
];

function pick(rng: Rng): SlotsSymbol {
  let roll = rng() * TOTAL_WEIGHT;
  for (const [symbol, weight] of WEIGHTS) {
    roll -= weight;
    if (roll < 0) return symbol;
  }
  return 'cherry';
}

function sameSymbol(symbols: SlotsSymbol[]): SlotsSymbol | null {
  const [a, b, c] = symbols;
  if (!a || !b || !c) return null;
  if (a === b && b === c) return a;
  return null;
}

export function createSlots(input: CreateInput, limits?: BetLimits): SlotsState {
  const seat = input.seats[0];
  if (!seat) fail('not_seated', 'Necesitas una cuenta para jugar.');
  const stake = assertBet(input.stakes?.[seat.userId] ?? 0, limits);
  if (stake < LINES.length) fail('bet_too_small', `La apuesta mínima es de ${LINES.length} diamantes.`);
  const lineBet = Math.floor(stake / LINES.length);
  const grid: SlotsSymbol[][] = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => pick(input.rng)));
  const lines: SlotLine[] = LINES.map((cells, index) => {
    const symbols = cells.map(([row, col]) => grid[row]![col]!);
    const kind = sameSymbol(symbols);
    const multiplier = kind ? SLOTS_PAYTABLE[kind] : 0;
    return { line: index, symbols, multiplier, win: multiplier * lineBet };
  });
  const totalStake = lineBet * LINES.length;
  const totalWin = lines.reduce((sum, line) => sum + line.win, 0);
  return {
    kind: 'slots',
    seats: [seat],
    status: 'settled',
    stake: totalStake,
    lineBet,
    grid,
    lines,
    totalWin,
    net: totalWin - totalStake,
  };
}

export const slotsEngine: Engine<SlotsState> = {
  kind: 'slots',
  visibility: 'private',
  minPlayers: 1,
  maxPlayers: 1,
  create: input => createSlots(input),
  legalActions: () => [],
  apply: (): ActionResult<SlotsState> => {
    fail('game_over', 'Cada tirada es una mesa nueva.');
  },
  view: state => state,
  settlement: (state): SettlementEntry[] => [{ userId: state.seats[0]!.userId, delta: state.net }],
  isOver: () => true,
};
