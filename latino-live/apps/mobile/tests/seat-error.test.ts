import assert from 'node:assert/strict';
import test from 'node:test';
import { seatErrorText } from '../lib/seat-error.ts';

test('a seat taken in the same instant is said in words, not as a database error', () => {
  const raw = new Error('duplicate key value violates unique constraint "room_seats_pkey"');
  assert.equal(seatErrorText(raw), 'Ese asiento acaba de ocuparse. Elige otro.');
  // El error del servidor para el asiento ocupado también se explica.
  assert.equal(seatErrorText(new Error('Ese asiento está ocupado')), 'Ese asiento acaba de ocuparse. Elige otro.');
});

test('a locked seat and a closed room keep their own sentence', () => {
  assert.equal(seatErrorText(new Error('Ese asiento tiene candado')), 'El anfitrión cerró ese asiento.');
  assert.equal(seatErrorText(new Error('La sala ya no existe')), 'La sala se cerró.');
});

test('a seat move with no answer still tells the person something', () => {
  assert.equal(seatErrorText(null), 'No pudimos moverte de asiento');
  assert.equal(seatErrorText(new Error('')), 'No pudimos moverte de asiento');
});
