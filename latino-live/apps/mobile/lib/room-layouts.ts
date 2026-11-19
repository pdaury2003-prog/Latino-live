/**
 * Where the seats of a room stand.
 *
 * A layout is only a set of places on a square: positions and sizes are
 * percentages of its width, so the same arrangement fits any phone. The room
 * keeps its own wall behind them. A place marked as the host's is drawn a
 * little larger, and the room's own seat numbers fill the places in the
 * layout's reading order.
 *
 * The list came from the sheets the owner supplied; the plain grid the app had
 * before is still there as `grid`, so a room without a layout opens exactly as
 * it always did.
 */

export type LayoutSeat = {
  x: number;
  y: number;
  /** Diameter as a share of the square's width. */
  size: number;
  host?: boolean;
};

export type RoomLayout = {
  id: string;
  name: string;
  seats: LayoutSeat[];
  /**
   * The diameter of an ordinary place, as a share of the square. A shape with
   * fewer places can spend the room on bigger faces; a crowded one keeps them
   * small enough that no two ever touch.
   */
  seatSize: number;
  /** The host's place is drawn a little larger, so their chair reads first. */
  hostSize?: number;
  /**
   * How the numbers run. `rows` counts left to right, row by row; `sides`
   * counts the left half first, which keeps each team of `teams` on one block.
   * `angle` goes around the shape, clockwise from the top, which is how a
   * circle, a heart or a ring of seats is read.
   */
  numbering?: 'rows' | 'sides' | 'angle';
};

function row(y: number, xs: number[]): LayoutSeat[] {
  return xs.map(x => ({ x, y, size: 11 }));
}

/** The places of a layout with the size that shape gives its seats. */
export function layoutSeats(layout: RoomLayout): LayoutSeat[] {
  return layout.seats.map(seat => ({
    ...seat,
    size: seat.host ? layout.hostSize ?? layout.seatSize : layout.seatSize,
  }));
}

/**
 * The same arrangement, grown to fill its square.
 *
 * A shape that leaves a wide margin around itself wastes the phone's room and
 * its faces come out small. The places are measured with their own rims and
 * scaled up together, so the shape keeps its proportions, no two seats touch
 * and the whole drawing sits inside the square with a small even margin.
 */
export function layoutFrame(layout: RoomLayout): LayoutSeat[] {
  const places = layoutSeats(layout);
  if (places.length === 0) return places;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const seat of places) {
    const half = seat.size / 2;
    minX = Math.min(minX, seat.x - half);
    maxX = Math.max(maxX, seat.x + half);
    minY = Math.min(minY, seat.y - half);
    maxY = Math.max(maxY, seat.y + half);
  }
  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  // Two percent of margin at each side, and a little more at the bottom where
  // the seat's own number hangs under its circle.
  const box = 96;
  const scale = Math.min(box / spanX, (box - 4) / spanY);
  const top = (100 - spanY * scale) / 2;
  const left = (100 - spanX * scale) / 2;
  return places.map(seat => ({
    ...seat,
    x: left + (seat.x - minX) * scale,
    y: top + (seat.y - minY) * scale,
    size: seat.size * scale,
  }));
}

export const ROOM_LAYOUTS: RoomLayout[] = [
  /*
   * The camera squares: two rows of equal chairs, one person per place. They
   * are the shape a small room uses when everyone is seen talking, and they
   * come in the three sizes a room is opened with: four, six and ten.
   */
  {
    id: 'square4',
    seatSize: 30,
    name: 'Cuadro 4',
    seats: [
      { x: 30, y: 32, size: 30 }, { x: 70, y: 32, size: 30 },
      { x: 30, y: 70, size: 30 }, { x: 70, y: 70, size: 30 },
    ],
  },
  {
    id: 'square6',
    seatSize: 26,
    name: 'Cuadro 6',
    seats: [
      ...row(30, [18, 50, 82]),
      ...row(70, [18, 50, 82]),
    ],
  },
  {
    id: 'square10',
    seatSize: 17,
    name: 'Cuadro 10',
    seats: [
      ...row(34, [10, 30, 50, 70, 90]),
      ...row(66, [10, 30, 50, 70, 90]),
    ],
  },
  {
    id: 'classic',
    seatSize: 12,
    name: 'Clásico',
    seats: [
      ...row(42, [15, 29, 43, 57, 71, 85]),
      ...row(62, [15, 29, 43, 57, 71, 85]),
    ],
  },
  {
    id: 'neon',
    seatSize: 12,
    hostSize: 17,
    name: 'Neón',
    seats: [
      { x: 50, y: 20, size: 16, host: true },
      ...row(42, [15, 29, 43, 57, 71, 85]),
      ...row(62, [22, 36, 50, 64, 78]),
    ],
  },
  {
    id: 'stage',
    seatSize: 14,
    hostSize: 19.5,
    name: 'Escenario',
    seats: [
      { x: 50, y: 34, size: 16, host: true },
      { x: 14, y: 22, size: 11 }, { x: 14, y: 38, size: 11 }, { x: 14, y: 54, size: 11 },
      { x: 86, y: 22, size: 11 }, { x: 86, y: 38, size: 11 }, { x: 86, y: 54, size: 11 },
      ...row(80, [14, 32, 50, 68, 86]),
    ],
  },
  {
    id: 'diamond',
    seatSize: 11.5,
    hostSize: 16,
    name: 'Diamante',
    seats: [
      { x: 50, y: 18, size: 16, host: true },
      { x: 34, y: 34, size: 11 }, { x: 18, y: 50, size: 11 }, { x: 34, y: 66, size: 11 },
      { x: 50, y: 82, size: 11 }, { x: 66, y: 66, size: 11 }, { x: 82, y: 50, size: 11 },
      { x: 66, y: 34, size: 11 }, { x: 50, y: 34, size: 11 }, { x: 34, y: 50, size: 11 },
      { x: 50, y: 66, size: 11 }, { x: 66, y: 50, size: 11 },
    ],
  },
  {
    id: 'galaxy',
    seatSize: 14,
    name: 'Galaxia',
    seats: [
      { x: 38, y: 26, size: 11 }, { x: 58, y: 26, size: 11 },
      ...row(54, [18, 34, 50, 66, 82]),
      ...row(76, [18, 34, 50, 66, 82]),
    ],
  },
  {
    id: 'circle',
    seatSize: 17,
    hostSize: 22,
    numbering: 'angle',
    name: 'Círculo',
    seats: [
      { x: 50, y: 50, size: 16, host: true },
      { x: 50, y: 16, size: 11 }, { x: 74, y: 26, size: 11 }, { x: 84, y: 50, size: 11 },
      { x: 74, y: 74, size: 11 }, { x: 50, y: 84, size: 11 }, { x: 26, y: 74, size: 11 },
      { x: 16, y: 50, size: 11 }, { x: 26, y: 26, size: 11 },
    ],
  },
  {
    id: 'heart',
    seatSize: 10.5,
    numbering: 'angle',
    name: 'Corazón',
    seats: [
      // The two places either side of the heart's dip are pulled apart: on the
      // sheet they touch, and they set the size of every other face.
      { x: 58.5, y: 24.6, size: 11 }, { x: 71.3, y: 17.9, size: 11 }, { x: 85.8, y: 30, size: 11 },
      { x: 82.3, y: 48.5, size: 11 }, { x: 68.6, y: 62.3, size: 11 }, { x: 56.4, y: 75.8, size: 11 },
      { x: 42, y: 75.5, size: 11 }, { x: 31, y: 61.9, size: 11 }, { x: 17.4, y: 48.1, size: 11 },
      { x: 14.4, y: 29.6, size: 11 }, { x: 29.2, y: 17.8, size: 11 }, { x: 41.5, y: 24.8, size: 11 },
    ],
  },
  {
    id: 'amphitheater',
    seatSize: 11,
    hostSize: 15.5,
    numbering: 'angle',
    name: 'Anfiteatro',
    seats: [
      { x: 50, y: 20, size: 16, host: true },
      { x: 89.1, y: 75.7, size: 11 }, { x: 81.5, y: 59.4, size: 11 }, { x: 67.5, y: 48, size: 11 },
      { x: 50, y: 44, size: 11 }, { x: 32.5, y: 48, size: 11 }, { x: 18.5, y: 59.4, size: 11 },
      { x: 10.9, y: 75.7, size: 11 },
      { x: 75.1, y: 77.3, size: 11 }, { x: 65.8, y: 63.4, size: 11 }, { x: 50, y: 58, size: 11 },
      { x: 34.2, y: 63.4, size: 11 }, { x: 24.9, y: 77.3, size: 11 },
    ],
  },
  {
    id: 'teams',
    seatSize: 14,
    name: 'Equipos',
    numbering: 'sides',
    seats: [
      { x: 14, y: 34, size: 11 }, { x: 86, y: 34, size: 11 }, { x: 30, y: 34, size: 11 }, { x: 70, y: 34, size: 11 },
      { x: 14, y: 52, size: 11 }, { x: 86, y: 52, size: 11 }, { x: 30, y: 52, size: 11 }, { x: 70, y: 52, size: 11 },
      { x: 14, y: 70, size: 11 }, { x: 86, y: 70, size: 11 }, { x: 30, y: 70, size: 11 }, { x: 70, y: 70, size: 11 },
    ],
  },
];

/** The design a room wears, or null when it keeps the plain grid. */
export function roomLayout(id: string | null | undefined): RoomLayout | null {
  if (!id || id === 'grid') return null;
  return ROOM_LAYOUTS.find(item => item.id === id) ?? null;
}

/** How many places a design draws. */
export function layoutCapacity(layout: RoomLayout): number {
  return layout.seats.length;
}

/**
 * The places of a design, in the order their seat numbers run. The host's
 * place is always number one, because seat one is the host's seat in the app;
 * the rest follow the design's own order, which is drawn so the numbers go
 * around the shape (the circle, the heart, the amphitheatre). Only a design
 * with two halves asks for its numbers to run side by side.
 */
export function layoutPlaces(layout: RoomLayout): LayoutSeat[] {
  const seats = layoutFrame(layout);
  const host = seats.find(seat => seat.host);
  const rest = seats.filter(seat => seat !== host);
  if (layout.numbering === 'angle') {
    // Around the square's own centre, clockwise from the top: a guest finds a
    // number by following the shape instead of hunting for it.
    rest.sort((a, b) => angle(a) - angle(b));
    return host ? [host, ...rest] : rest;
  }
  if (layout.numbering !== 'sides') return host ? [host, ...rest] : rest;
  const bucket = (value: number) => Math.round(value / 6);
  rest.sort((a, b) => {
    const sideA = a.x < 50 ? 0 : 1;
    const sideB = b.x < 50 ? 0 : 1;
    if (sideA !== sideB) return sideA - sideB;
    if (bucket(a.y) !== bucket(b.y)) return bucket(a.y) - bucket(b.y);
    return a.x - b.x;
  });
  return host ? [host, ...rest] : rest;
}

function angle(seat: LayoutSeat): number {
  const dx = seat.x - 50;
  const dy = seat.y - 50;
  const radians = Math.atan2(dx, -dy);
  const turn = radians < 0 ? radians + Math.PI * 2 : radians;
  return turn;
}
