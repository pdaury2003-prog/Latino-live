/**
 * Who sits beside a seat.
 *
 * Seats are numbered from 1 across rows of `cols`, the way the room draws
 * them. A neighbour is on the same row, never on the one above or below, so a
 * kiss never reaches across the room.
 */
export function neighborSeat(seatNo: number, taken: number[], cols: number): number | null {
  // Seats are numbered from 1: a missing seat cannot be asked.
  if (!Number.isInteger(seatNo) || seatNo < 1 || !taken.includes(seatNo) || cols <= 0) return null;
  const column = (seatNo - 1) % cols;
  const right = seatNo + 1;
  if (column < cols - 1 && taken.includes(right)) return right;
  const left = seatNo - 1;
  if (column > 0 && taken.includes(left)) return left;
  return null;
}

