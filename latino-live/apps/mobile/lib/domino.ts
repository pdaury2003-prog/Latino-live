import { getSupabase } from './supabase';
import type { DominoSide, DominoTable } from './domino-rules';

export { pipTotal, sidesForTile, tileValues } from './domino-rules';
export type { DominoBoardTile, DominoLogEntry, DominoSide, DominoStatus, DominoTable } from './domino-rules';

/**
 * El dominó de la casa: mesas de 2 o 4 jugadores. El servidor reparte, valida
 * los turnos y guarda cada mano en privado; la app solo dibuja lo que puede ver.
 */

export type DominoPlayer = {
  table_id: string;
  user_id: string;
  seat_no: number;
  tiles_left: number;
};

export type PassOutcome = { drew: boolean; tile?: string; finished?: boolean };

export async function createDominoTable(seats: 2 | 4): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('domino_create', { p_seats: seats });
  if (error) throw new Error(error.message);
  if (typeof data !== 'string') throw new Error('No pudimos abrir la mesa');
  return data;
}

export async function joinDominoTable(tableId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('domino_join', { p_table: tableId });
  if (error) throw new Error(error.message);
}

export async function getDominoTable(tableId: string): Promise<DominoTable | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('domino_tables').select('*').eq('id', tableId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? null) as DominoTable | null;
}

export async function listDominoTables(): Promise<DominoTable[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('domino_tables')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  return (data ?? []) as DominoTable[];
}

export async function listDominoPlayers(tableIds: string[]): Promise<DominoPlayer[]> {
  const unique = [...new Set(tableIds.filter(Boolean))];
  if (unique.length === 0) return [];
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('domino_players')
    .select('table_id, user_id, seat_no, tiles_left')
    .in('table_id', unique)
    .order('seat_no');
  if (error) throw new Error(error.message);
  return (data ?? []) as DominoPlayer[];
}

/** Only the caller's own tiles come back: the table is public, the hand is not. */
export async function getMyDominoHand(tableId: string): Promise<string[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('domino_hands')
    .select('tiles')
    .eq('table_id', tableId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { tiles: string[] | null } | null;
  return row?.tiles ?? [];
}

export async function playDominoTile(tableId: string, tile: string, side: DominoSide): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('domino_play', { p_table: tableId, p_tile: tile, p_side: side });
  if (error) throw new Error(error.message);
}

export async function passDominoTurn(tableId: string): Promise<PassOutcome> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('domino_pass', { p_table: tableId });
  if (error) throw new Error(error.message);
  return (data ?? { drew: false }) as PassOutcome;
}

export async function leaveDominoTable(tableId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.rpc('domino_leave', { p_table: tableId });
  if (error) throw new Error(error.message);
}

export async function rematchDomino(tableId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('domino_rematch', { p_table: tableId });
  if (error) throw new Error(error.message);
}

/** Calls back as soon as the table changes, so every phone sees the same turn. */
export function watchDominoTable(tableId: string, onChange: () => void): () => void {
  const client = getSupabase();
  if (!client) return () => undefined;
  const channel = client
    .channel(`domino-table-${tableId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'domino_tables', filter: `id=eq.${tableId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

