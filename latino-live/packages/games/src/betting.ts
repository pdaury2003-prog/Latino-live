/**
 * Límites y aritmética de una apuesta. El motor calcula cuánto entra y cuánto
 * sale; mover los diamantes es trabajo de una función transaccional en la base
 * de datos, nunca de un teléfono.
 */

import { fail } from './types.ts';

export type BetLimits = {
  min: number;
  max: number;
  /** Tope por persona y día, en diamantes. */
  maxDaily: number;
};

export const DEFAULT_LIMITS: BetLimits = { min: 1, max: 5_000, maxDaily: 20_000 };

export function assertBet(amount: number, limits: BetLimits = DEFAULT_LIMITS): number {
  if (!Number.isInteger(amount) || amount < limits.min) {
    fail('bet_too_small', `La apuesta mínima es ${limits.min} diamantes.`);
  }
  if (amount > limits.max) fail('bet_too_big', `La apuesta máxima es ${limits.max} diamantes.`);
  return amount;
}

/** Los premios se pagan en diamantes enteros, siempre hacia abajo. */
export function payoutDiamonds(stake: number, multiplier: number): number {
  return Math.max(0, Math.floor(stake * multiplier));
}

/** Lo que la billetera gana (+) o pierde (-) al cerrar la mano. */
export function netDiamonds(stake: number, payout: number): number {
  return Math.floor(payout) - Math.floor(stake);
}

export function assertStakeMap(stakes: Record<string, number> | undefined, players: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const player of players) {
    result[player] = assertBet(stakes?.[player] ?? 0);
  }
  return result;
}
