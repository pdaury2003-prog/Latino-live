import assert from 'node:assert/strict';
import test from 'node:test';
import { pipTotal, sidesForTile, tileValues, type DominoTable } from '../lib/domino-rules.ts';

function table(overrides: Partial<DominoTable> = {}): DominoTable {
  return {
    id: 'mesa-1',
    host_id: 'persona-1',
    seats: 2,
    status: 'playing',
    turn_seat: 0,
    passes: 0,
    board: [{ l: 6, r: 6 }, { l: 6, r: 3 }],
    left_pip: 6,
    right_pip: 3,
    winner: null,
    reason: null,
    log: [],
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('a tile reads its two numbers', () => {
  assert.deepEqual(tileValues('6-3'), [6, 3]);
  assert.deepEqual(tileValues('0-0'), [0, 0]);
  // A tile the server would never send still reads as numbers, never NaN.
  assert.deepEqual(tileValues('x-y'), [0, 0]);
});

test('a hand is worth the points it still holds', () => {
  assert.equal(pipTotal(['6-6', '3-2']), 17);
  assert.equal(pipTotal([]), 0);
});

test('a tile enters by the end it matches', () => {
  const open = table();
  assert.deepEqual(sidesForTile(open, '6-1'), ['left']);
  assert.deepEqual(sidesForTile(open, '3-4'), ['right']);
  assert.deepEqual(sidesForTile(open, '1-2'), []);
});

test('a tile matching both open ends can go either way', () => {
  const open = table({ left_pip: 5, right_pip: 5, board: [{ l: 5, r: 5 }] });
  assert.deepEqual(sidesForTile(open, '5-2'), ['left', 'right']);
  // A double that matches both ends also has two choices.
  assert.deepEqual(sidesForTile(open, '5-5'), ['left', 'right']);
});

test('the first tile of a round opens anywhere', () => {
  const fresh = table({ board: [], left_pip: null, right_pip: null });
  assert.deepEqual(sidesForTile(fresh, '2-1'), ['first']);
});

test('a finished or waiting table takes no tiles', () => {
  assert.deepEqual(sidesForTile(table({ status: 'finished' }), '6-1'), []);
  assert.deepEqual(sidesForTile(table({ status: 'waiting' }), '6-1'), []);
});
