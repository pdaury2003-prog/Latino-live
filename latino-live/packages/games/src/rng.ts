/**
 * Azar reproducible. El servidor usa `cryptoRng`; las pruebas usan una semilla
 * fija para que una mano se pueda repetir y auditar.
 */

import type { Rng } from './types.ts';

/** Mulberry32: rápido, uniforme y con el mismo resultado en cualquier equipo. */
export function seededRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Azar del dispositivo. Node lo tiene desde la versión 19; si el entorno no lo
 * ofrece, se cae a `Math.random` para no romper una mesa de salón.
 */
export const cryptoRng: Rng = () => {
  const crypto = (globalThis as {
    crypto?: { getRandomValues?: (buffer: Uint32Array) => Uint32Array };
  }).crypto;
  if (crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return buffer[0]! / 4294967296;
  }
  return Math.random();
};
