import { getSupabase } from '@/lib/supabase';

export type RoomActivity = {
  roomId: string;
  slug: string;
  title: string;
  hostName: string;
  cover: string;
  lastBody: string;
  lastAuthor: string;
  lastAt: string;
};

/**
 * The most recent chat line of every room, newest room first — the room
 * activity list behind the messages tab.
 */
export async function getRoomActivity(): Promise<RoomActivity[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('room_messages')
    .select('body, author, created_at, room_id, rooms!inner(slug, title, host_name, cover)')
    .order('created_at', { ascending: false })
    .limit(120);
  if (error) throw error;

  const seen = new Set<string>();
  const rows: RoomActivity[] = [];
  type Row = {
    body: string;
    author: string;
    created_at: string;
    room_id: string;
    rooms: { slug: string; title: string; host_name: string; cover: string } | null;
  };
  for (const row of (data ?? []) as unknown as Row[]) {
    if (!row.rooms || seen.has(row.room_id)) continue;
    seen.add(row.room_id);
    rows.push({
      roomId: row.room_id,
      slug: row.rooms.slug,
      title: row.rooms.title,
      hostName: row.rooms.host_name,
      cover: row.rooms.cover,
      lastBody: row.body,
      lastAuthor: row.author,
      lastAt: row.created_at,
    });
  }
  return rows;
}

export function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'ayer' : `hace ${days} días`;
}
