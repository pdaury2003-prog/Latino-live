import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeCards, type BillboardCard } from '../lib/billboard-merge.ts';
import type { RoomRow, SeatRow } from '../lib/rooms.ts';

function room(id: string, title: string): RoomRow {
  return { id, slug: id, title } as RoomRow;
}

function seat(seatNo: number, userId: string): SeatRow {
  return { seat_no: seatNo, user_id: userId } as SeatRow;
}

test('untouched rooms keep their own card object', () => {
  const one = { room: room('a', 'Sala A'), seats: [seat(1, 'u1')] };
  const two = { room: room('b', 'Sala B'), seats: [] };
  const current: BillboardCard[] = [one, two];
  const next = mergeCards(
    current,
    [room('a', 'Sala A'), room('b', 'Sala B')],
    { a: [seat(1, 'u1')] },
  );
  assert.equal(next[0], one);
  assert.equal(next[1], two);
});

test('a whole unchanged billboard comes back as the same list', () => {
  const current: BillboardCard[] = [{ room: room('a', 'Sala A'), seats: [] }];
  const next = mergeCards(current, [room('a', 'Sala A')], {});
  assert.equal(next, current);
});

test('only the room that changed gets a new card', () => {
  const one = { room: room('a', 'Sala A'), seats: [] };
  const two = { room: room('b', 'Sala B'), seats: [] };
  const current: BillboardCard[] = [one, two];
  const next = mergeCards(
    current,
    [room('a', 'Sala A'), room('b', 'Sala B con otro nombre')],
    {},
  );
  assert.notEqual(next, current);
  assert.equal(next[0], one);
  assert.notEqual(next[1], two);
  assert.equal(next[1].room.title, 'Sala B con otro nombre');
});

test('a new person on a seat changes only that room', () => {
  const one = { room: room('a', 'Sala A'), seats: [] };
  const two = { room: room('b', 'Sala B'), seats: [] };
  const next = mergeCards(
    [one, two],
    [room('a', 'Sala A'), room('b', 'Sala B')],
    { b: [seat(2, 'u9')] },
  );
  assert.equal(next[0], one);
  assert.equal(next[1].seats.length, 1);
});

test('a room that closes disappears from the billboard', () => {
  const current: BillboardCard[] = [
    { room: room('a', 'Sala A'), seats: [] },
    { room: room('b', 'Sala B'), seats: [] },
  ];
  const next = mergeCards(current, [room('b', 'Sala B')], {});
  assert.equal(next.length, 1);
  assert.equal(next[0].room.id, 'b');
});
