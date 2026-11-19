import type { RoomRow, SeatRow } from '@/lib/rooms';

export type BillboardCard = { room: RoomRow; seats: SeatRow[] };

/** Whether a card still holds exactly the room and the people it held. */
function sameCard(before: BillboardCard, room: RoomRow, seats: SeatRow[]) {
  return JSON.stringify(before.room) === JSON.stringify(room)
    && JSON.stringify(before.seats) === JSON.stringify(seats);
}

/**
 * The billboard arrives new with every live event, but it is almost always the
 * same list with one room changed. Each card that still matches keeps its own
 * object, so its card is not drawn again: only the room that really changed
 * moves.
 *
 * The same list, in the same order, comes back untouched, so React skips the
 * whole screen.
 */
export function mergeCards(
  current: BillboardCard[],
  rooms: RoomRow[],
  seats: Record<string, SeatRow[]>,
): BillboardCard[] {
  const known = new Map(current.map(card => [card.room.id, card]));
  let kept = 0;
  const next = rooms.map(room => {
    const before = known.get(room.id);
    const nowSeats = seats[room.id] ?? [];
    if (before && sameCard(before, room, nowSeats)) {
      kept += 1;
      return before;
    }
    return { room, seats: nowSeats };
  });
  if (kept === current.length && next.length === current.length
    && next.every((card, index) => card === current[index])) return current;
  return next;
}
