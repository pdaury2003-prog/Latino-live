import { getSupabase } from './supabase';

/**
 * Room luck: a die and a draw of seats.
 *
 * Neither costs anything and neither pays anything: they are room toys that
 * settle who goes first, which is what a voice room needs before a game. The
 * result goes into the chat as its own kind of message, so every phone in the
 * room sees the same number at the same moment.
 */

/** A fair die: the platform's own random, not Math.random's first guess. */
export function rollDie(sides = 6): number {
  const random = new Uint32Array(1);
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(random);
    return (random[0]! % sides) + 1;
  }
  return Math.floor(Math.random() * sides) + 1;
}

/** One roll per die, so a person can throw two and read both numbers. */
export function rollDice(count = 1, sides = 6): number[] {
  return Array.from({ length: Math.max(1, Math.min(count, 3)) }, () => rollDie(sides));
}

/** Picks one of the given seat numbers, without touching the order it came in. */
export function drawSeat(seats: number[]): number | null {
  if (seats.length === 0) return null;
  const random = new Uint32Array(1);
  const crypto = globalThis.crypto;
  if (crypto?.getRandomValues) {
    crypto.getRandomValues(random);
    return seats[random[0]! % seats.length] ?? null;
  }
  return seats[Math.floor(Math.random() * seats.length)] ?? null;
}

/** Writes the result into the room, where everyone can see it. */
export async function postLuck(roomId: string, body: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Inicia sesión para jugar.');
  const { error } = await client.rpc('post_room_luck', { p_room: roomId, p_body: body });
  if (error) throw new Error(/Sientate/i.test(error.message) ? 'Siéntate en un asiento para jugar.' : error.message);
}

/** The line the room reads when someone throws the dice. */
export function diceLine(name: string, values: number[]): string {
  if (values.length === 1) return `🎲 ${name} sacó ${values[0]}`;
  const total = values.reduce((sum, value) => sum + value, 0);
  return `🎲 ${name} sacó ${values.join(' + ')} = ${total}`;
}

/** The line the room reads when a seat is drawn. */
export function seatLine(name: string, seat: number, occupant?: string | null): string {
  return occupant
    ? `🎡 ${name} giró la ruleta: asiento ${seat}, ${occupant}`
    : `🎡 ${name} giró la ruleta: asiento ${seat}`;
}
