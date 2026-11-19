import { useEffect, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';
import { keepLiveChannel } from '@/lib/live-channel';
import type { AppNotice } from '@/lib/notices';

type GiftRow = { id: number; room_id: string; sender_name: string; gift_key: string; created_at: string };

type FollowRow = { follower_id: string; created_at: string };
type RoomRow = { id: string; slug: string; title: string };
type ChatRow = { id: number; room_id: string; author: string; body: string; kind: string; created_at: string };
type InviteRow = { id: string; room_slug: string; room_title: string; from_name: string; join_code: string | null; created_at: string };

/** A room opened by someone this account follows. */
export type FollowedRoomOpen = {
  id: number;
  room_id: string;
  room_slug: string;
  room_title: string;
  host_id: string;
  host_name: string;
  opened_at: string;
};

/**
 * The rooms opened lately by the people this account follows. The server
 * answers only for hosts the person follows, and leaves out private rooms and
 * rooms already closed.
 */
export async function getFollowedRoomOpens(limit = 6): Promise<FollowedRoomOpen[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('followed_room_opens', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as FollowedRoomOpen[];
}

/**
 * Listens for a room opening while the app is open. Only the openings of
 * followed hosts are announced: the server filters them, so an event nobody
 * follows never reaches the person.
 */
export function useFollowedRoomLive(hostId: string | null, onOpen: (event: FollowedRoomOpen) => void) {
  const callback = useRef(onOpen);
  callback.current = onOpen;
  const newest = useRef<number | null>(null);
  useEffect(() => {
    const client = getSupabase();
    if (!client || !hostId) return;
    void getFollowedRoomOpens(1)
      .then(rows => { newest.current = rows[0]?.id ?? null; })
      .catch(() => undefined);
    return keepLiveChannel(client, `followed-rooms:${hostId}`, channel => channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_open_events' }, () => {
        void getFollowedRoomOpens(1)
          .then(rows => {
            const row = rows[0];
            if (!row) return;
            if (newest.current === null) { newest.current = row.id; return; }
            if (row.id <= newest.current) return;
            newest.current = row.id;
            callback.current(row);
          })
          .catch(() => undefined);
      }),
    );
  }, [hostId]);
}

/**
 * The real events addressed to this person: gifts they received, people who
 * started following them, and messages in the rooms they host.
 */
export async function getNotices(userId: string): Promise<AppNotice[]> {
  const client = getSupabase();
  if (!client) return [];

  const [gifts, follows, rooms, invites, opens] = await Promise.all([
    client
      .from('room_gifts')
      .select('id, room_id, sender_name, gift_key, created_at')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    client
      .from('profile_follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    client.from('rooms').select('id, slug, title, host_id').limit(60),
    client
      .from('room_invites')
      .select('id, room_slug, room_title, from_name, join_code, created_at')
      .eq('to_user_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(20),
    getFollowedRoomOpens(20).catch(() => [] as FollowedRoomOpen[]),
  ]);
  if (gifts.error) throw gifts.error;
  if (follows.error) throw follows.error;
  if (rooms.error) throw rooms.error;

  const allRooms = (rooms.data ?? []) as (RoomRow & { host_id: string | null })[];
  const hostedIds = allRooms.filter(room => room.host_id === userId).map(room => room.id);
  const chat = hostedIds.length
    ? await client
      .from('room_messages')
      .select('id, room_id, author, body, kind, created_at')
      .in('room_id', hostedIds)
      .neq('user_id', userId)
      .in('kind', ['user', 'photo'])
      .order('created_at', { ascending: false })
      .limit(20)
    : { data: [] as ChatRow[], error: null };
  if (chat.error) throw chat.error;

  const followerRows = (follows.data ?? []) as FollowRow[];
  const followerNames = new Map<string, string>();
  if (followerRows.length) {
    const profiles = await client
      .from('profiles')
      .select('id, display_name')
      .in('id', followerRows.map(row => row.follower_id));
    if (profiles.error) throw profiles.error;
    for (const row of (profiles.data ?? []) as { id: string; display_name: string }[]) {
      followerNames.set(row.id, row.display_name);
    }
  }

  const roomById = new Map(allRooms.map(room => [room.id, room]));

  const notices: AppNotice[] = [
    ...opens.map(row => ({
      id: `room-${row.id}`,
      kind: 'room' as const,
      title: `${row.host_name} abrió una sala`,
      body: `${row.room_title} · ya está abierta para entrar.`,
      at: row.opened_at,
      slug: row.room_slug,
    })),
    ...((invites.data ?? []) as InviteRow[]).map(row => ({
      id: `invite-${row.id}`,
      kind: 'invite' as const,
      title: `${row.from_name} te invitó a ${row.room_title}`,
      body: row.join_code ? 'La sala es privada: el código ya viene en la invitación.' : 'Entra con un toque y ocupa un asiento.',
      at: row.created_at,
      slug: row.room_slug,
      code: row.join_code,
    })),
    ...((gifts.data ?? []) as unknown as GiftRow[]).map(row => ({
      id: `gift-${row.id}`,
      kind: 'gift' as const,
      title: `${row.sender_name} te envió un regalo`,
      body: roomById.get(row.room_id) ? `En ${roomById.get(row.room_id)?.title}.` : 'En una de tus salas.',
      at: row.created_at,
      slug: roomById.get(row.room_id)?.slug ?? null,
    })),
    ...followerRows.map(row => ({
      id: `follow-${row.follower_id}-${row.created_at}`,
      kind: 'follow' as const,
      title: `${followerNames.get(row.follower_id) ?? 'Alguien'} empezó a seguirte`,
      body: 'Ya puedes ver su perfil y regalarle desde su ficha.',
      at: row.created_at,
      slug: null,
    })),
    ...((chat.data ?? []) as ChatRow[]).map(row => {
      const room = roomById.get(row.room_id);
      return {
        id: `chat-${row.id}`,
        kind: 'chat' as const,
        title: `${row.author} escribió en ${room?.title ?? 'tu sala'}`,
        body: row.kind === 'photo' ? 'Envió una foto al chat.' : row.body,
        at: row.created_at,
        slug: room?.slug ?? null,
      };
    }),
  ];

  return notices.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 40);
}
