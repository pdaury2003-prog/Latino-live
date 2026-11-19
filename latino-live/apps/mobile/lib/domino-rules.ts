/**
 * Las reglas que la pantalla necesita sin hablar con el servidor: qué fichas
 * son, cuántos puntos valen y por dónde entra cada una. El servidor decide el
 * turno; esto solo evita ofrecer una jugada que va a ser rechazada.
 */

export type DominoStatus = 'waiting' | 'playing' | 'finished';
export type DominoSide = 'left' | 'right' | 'first';

export type DominoBoardTile = { l: number; r: number };

export type DominoLogEntry = {
  kind: 'play' | 'draw' | 'pass';
  user: string;
  tile?: string;
  side?: DominoSide;
  at?: string;
};

export type DominoTable = {
  id: string;
  host_id: string;
  seats: 2 | 4;
  status: DominoStatus;
  turn_seat: number;
  passes: number;
  board: DominoBoardTile[];
  left_pip: number | null;
  right_pip: number | null;
  winner: string | null;
  reason: string | null;
  log: DominoLogEntry[];
  created_at: string;
  updated_at: string;
};

/** The two numbers of a tile written as "a-b". */
export function tileValues(tile: string): [number, number] {
  const [a, b] = tile.split('-').map(Number);
  return [Number.isFinite(a) ? a : 0, Number.isFinite(b) ? b : 0];
}

/** Points left in a hand; the lowest one wins a blocked table. */
export function pipTotal(tiles: string[]): number {
  return tiles.reduce((sum, tile) => {
    const [a, b] = tileValues(tile);
    return sum + a + b;
  }, 0);
}

/** Where this tile can go, if it is your turn. An empty board takes it anywhere. */
export function sidesForTile(table: DominoTable, tile: string): DominoSide[] {
  if (table.status !== 'playing') return [];
  if (!table.board || table.board.length === 0) return ['first'];
  const [a, b] = tileValues(tile);
  const sides: DominoSide[] = [];
  if (a === table.left_pip || b === table.left_pip) sides.push('left');
  if (a === table.right_pip || b === table.right_pip) sides.push('right');
  return sides;
}
