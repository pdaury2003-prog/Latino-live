import assert from 'node:assert/strict';
import test from 'node:test';
import { ROOM_LAYOUTS, layoutCapacity, layoutFrame, layoutPlaces, layoutSeats, roomLayout } from '../lib/room-layouts.ts';

test('every design fits inside the square and keeps its seats apart', () => {
  for (const layout of ROOM_LAYOUTS) {
    for (const seat of layoutSeats(layout)) {
      const half = seat.size / 2;
      assert.ok(seat.x - half >= 0 && seat.x + half <= 100, `${layout.id} leaves the square sideways`);
      assert.ok(seat.y - half >= 0 && seat.y + half <= 104, `${layout.id} leaves the square downwards`);
    }
    // Two places of the same design never share a centre exactly.
    const centres = new Set(layout.seats.map(seat => `${seat.x},${seat.y}`));
    assert.equal(centres.size, layout.seats.length, `${layout.id} repeats a place`);
  }
});

test('no two seats of a design touch, even on a small phone', () => {
  // The square a small phone leaves above the chat, in points.
  const square = 290;
  for (const layout of ROOM_LAYOUTS) {
    const seats = layoutSeats(layout);
    for (let a = 0; a < seats.length; a += 1) {
      for (let b = a + 1; b < seats.length; b += 1) {
        const one = seats[a];
        const other = seats[b];
        const distance = Math.hypot(one.x - other.x, one.y - other.y) / 100 * square;
        const needed = ((one.size + other.size) / 2 / 100) * square;
        assert.ok(distance - needed >= 3, `${layout.id} overlaps its places ${a + 1} and ${b + 1}`);
      }
    }
  }
});

test('a shape with more room gives its seats bigger faces', () => {
  const circle = roomLayout('circle');
  const teams = roomLayout('teams');
  assert.ok(circle && teams);
  assert.ok(circle.seatSize > teams.seatSize, 'the ring of nine should hold bigger faces than the twelve');
  // The host's place reads first in the shapes that have one.
  const neon = roomLayout('neon');
  assert.ok(neon);
  const places = layoutPlaces(neon);
  assert.ok(places[0].host && places[0].size > places[1].size);
});

test('a shape grows to fill its square, so the faces are as big as they fit', () => {
  for (const layout of ROOM_LAYOUTS) {
    const drawn = layoutFrame(layout);
    // Every place stays inside the square with its own rim.
    for (const seat of drawn) {
      const half = seat.size / 2;
      assert.ok(seat.x - half >= 0.5, `${layout.id} leaves the square sideways`);
      assert.ok(seat.x + half <= 99.5, `${layout.id} leaves the square sideways`);
      assert.ok(seat.y - half >= 0.5, `${layout.id} leaves the square downwards`);
      assert.ok(seat.y + half <= 99.5, `${layout.id} leaves the square downwards`);
    }
    // It reaches the margins instead of floating in the middle: at least one
    // place touches the left or right edge of the drawing.
    const left = Math.min(...drawn.map(seat => seat.x - seat.size / 2));
    const right = Math.max(...drawn.map(seat => seat.x + seat.size / 2));
    const top = Math.min(...drawn.map(seat => seat.y - seat.size / 2));
    const bottom = Math.max(...drawn.map(seat => seat.y + seat.size / 2));
    assert.ok(right - left >= 92 || bottom - top >= 88, `${layout.id} stays small inside its square`);
  }
});

test('the host place is number one, and a design has as many places as it draws', () => {
  for (const layout of ROOM_LAYOUTS) {
    const places = layoutPlaces(layout);
    assert.equal(places.length, layoutCapacity(layout));
    if (layout.seats.some(seat => seat.host)) {
      assert.equal(places[0].host, true, `${layout.id} does not start with the host`);
    }
  }
});

test('a ring of seats numbers clockwise from the top', () => {
  const circle = roomLayout('circle');
  assert.ok(circle);
  const places = layoutPlaces(circle);
  // The host sits in the middle; the first guest is the top of the ring.
  assert.ok(places[1].y < 30, 'the first guest is not at the top');
  assert.ok(places[2].x > 50, 'the numbering does not continue to the right');
});

test('a team design numbers one whole side before the other', () => {
  const teams = roomLayout('teams');
  assert.ok(teams);
  const places = layoutPlaces(teams);
  const left = places.slice(0, 6).every(seat => seat.x < 50);
  const right = places.slice(6).every(seat => seat.x > 50);
  assert.ok(left && right, 'the teams are split across their blocks');
});

test('an unknown design falls back to the plain grid', () => {
  assert.equal(roomLayout('grid'), null);
  assert.equal(roomLayout(null), null);
  assert.equal(roomLayout('no-existe'), null);
  assert.equal(roomLayout('neon')?.name, 'Neón');
});

test('the camera squares come in four, six and ten places', () => {
  // A room opened with one of these keeps exactly that many chairs: no place
  // is drawn empty, so every camera in the square has someone in it.
  const expected: Record<string, number> = { square4: 4, square6: 6, square10: 10 };
  for (const [id, capacity] of Object.entries(expected)) {
    const layout = roomLayout(id);
    assert.ok(layout, `${id} is missing`);
    assert.equal(layoutCapacity(layout), capacity, `${id} does not draw ${capacity} places`);
    assert.equal(layout.seats.length, capacity, `${id} has unused places`);
    // Two equal rows, left to right: the order a camera square is read in.
    const rows = new Set(layoutFrame(layout).map(seat => Math.round(seat.y)));
    assert.equal(rows.size, 2, `${id} is not two rows`);
  }
});
