import assert from 'node:assert/strict';
import test from 'node:test';
import { neighborSeat } from '../lib/seat-neighbors.ts';

test('a kiss reaches the seat beside it on the same row', () => {
  // Someone sits on 2 and on 3, in the first row of five.
  assert.equal(neighborSeat(2, [2, 3], 5), 3);
  // Seat 3 finds 2: its right neighbour is free, so it looks to the left.
  assert.equal(neighborSeat(3, [2, 3], 5), 2);
});

test('a row edge never reaches across to the next row', () => {
  // Seat 5 closes the first row and seat 6 opens the second: not neighbours.
  assert.equal(neighborSeat(5, [5, 6], 5), null);
  assert.equal(neighborSeat(6, [5, 6], 5), null);
  // Seat 10 closes the second row; nothing sits below it either.
  assert.equal(neighborSeat(10, [10, 1], 5), null);
});

test('a free or empty neighbour means no kiss', () => {
  assert.equal(neighborSeat(4, [4], 5), null);
  assert.equal(neighborSeat(7, [7, 9], 5), null);
  // A seat the room does not have cannot be asked.
  assert.equal(neighborSeat(0, [0, 1], 5), null);
  assert.equal(neighborSeat(3, [3, 4], 0), null);
});

test('the right neighbour wins when both sides are taken', () => {
  assert.equal(neighborSeat(3, [2, 3, 4], 5), 4);
  // Video rooms draw four seats per row: seat 5 opens the second row, so it
  // only reaches seat 6, never seat 4 in the row above.
  assert.equal(neighborSeat(5, [4, 5], 4), null);
  assert.equal(neighborSeat(5, [5, 6], 4), 6);
  assert.equal(neighborSeat(8, [7, 8], 4), 7);
});

