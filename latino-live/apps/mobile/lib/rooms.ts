import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { assetUrl } from '@/lib/asset-host';
import { getSupabase } from '@/lib/supabase';
import { uploadPickedFile } from '@/lib/upload';
import { imageType } from '@/lib/pick-photo';
import { keepLiveChannel } from '@/lib/live-channel';
import { rememberProfiles } from '@/lib/profile-cache';

export type RoomRow = {
  id: string;
  slug: string;
  title: string;
  host_id: string | null;
  host_name: string;
  country: string;
  cover: 'palace' | 'pool' | 'terrace';
  max_seats: number;
  announcement: string;
  is_official: boolean;
  background_path: string | null;
  /** The YouTube video shared by the room, when it is in cinema mode. */
  video_url?: string | null;
  /** The design the room wears: one of ROOM_LAYOUTS, or null for the grid. */
  layout?: string | null;
  /** A private room only opens with its code. */
  is_private?: boolean | null;
  /**
   * Whether the room shows cameras. The host closes them for a night that is
   * only for voices; a room opens with them allowed.
   */
  allow_camera?: boolean | null;
  /**
   * The kind of hall: `audio` keeps the round seats the app always had, and
   * `camera` draws the square places that hold a live picture.
   */
  room_mode?: 'audio' | 'camera' | null;
  closed_at: string | null;
  created_at: string;
};

export type SeatRow = {
  room_id: string;
  seat_no: number;
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  muted: boolean;
  speaking: boolean;
  joined_at: string;
};

export type VoiceRow = {
  id: number;
  room_id: string;
  user_id: string | null;
  author: string;
  storage_path: string;
  duration_ms: number;
  created_at: string;
};

export type MessageRow = {
  id: number;
  room_id: string;
  user_id: string | null;
  author: string;
  kind: 'welcome' | 'system' | 'user' | 'announcement' | 'gift' | 'photo' | 'luck';
  body: string;
  image_path: string | null;
  created_at: string;
};

export type GiftRow = {
  id: number;
  room_id: string;
  sender_id: string | null;
  sender_name: string;
  gift_key: string;
  cost: number;
  created_at: string;
};

export type ProfileRow = {
  id: string;
  display_name: string;
  bio: string;
  country: string;
  avatar_url: string | null;
  cover_url: string | null;
  level: number;
  xp: number;
  diamonds: number;
  gold: number;
  svip_level: number;
  svip_expires_at: string | null;
  svip_show: Record<string, boolean> | null;
  equipped_frame: string | null;
  user_number: number | null;
  /** Insignia de rol ya resuelta: dueño, agencia, oficial, host, CS. */
  badge: string | null;
  /** La agencia que representa, cuando lleva la insignia de Agencia. */
  agency_name: string | null;
  /** El logo de esa agencia, para la tarjeta del perfil. */
  agency_photo_url: string | null;
  /** Mujer, hombre u otro; vacío mientras la persona no lo elige. */
  gender: string;
  /** The clip that plays when this person enters a room, while it lasts. */
  entry_video_path: string | null;
  entry_video_until: string | null;
  created_at: string;
};

export const MAX_MESSAGES = 20;

export async function listRooms(): Promise<RoomRow[]> {
  const client = getSupabase();
  if (!client) return [];
  // Private rooms belong to their host and their invited people; they are not
  // on the public list anybody can browse.
  const { data, error } = await client
    .from('rooms')
    .select('*')
    .is('closed_at', null)
    .eq('is_private', false)
    .order('is_official', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as RoomRow[];
}

export async function getRoom(id: string): Promise<RoomRow | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('rooms').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data ?? null) as RoomRow | null;
}

/**
 * A request on a phone with weak signal can hang forever, which leaves the
 * room on its spinner with nothing to do. This ends the wait instead.
 */
export function withTimeout<T>(promise: Promise<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

export async function findRoomBySlug(slug: string): Promise<RoomRow | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('rooms').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return (data ?? null) as RoomRow | null;
}

export async function getSeatsForRooms(roomIds: string[]): Promise<Record<string, SeatRow[]>> {
  const client = getSupabase();
  if (!client || roomIds.length === 0) return {};
  const { data, error } = await client.from('room_seats').select('*').in('room_id', roomIds).order('seat_no');
  if (error) throw error;
  const grouped: Record<string, SeatRow[]> = {};
  for (const seat of (data ?? []) as SeatRow[]) {
    (grouped[seat.room_id] ??= []).push(seat);
  }
  return grouped;
}

export async function getSeats(roomId: string): Promise<SeatRow[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('room_seats').select('*').eq('room_id', roomId).order('seat_no');
  if (error) throw error;
  return (data ?? []) as SeatRow[];
}

export async function getMessages(roomId: string): Promise<MessageRow[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('room_messages').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(MAX_MESSAGES);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).reverse();
}

export async function getGifts(roomId: string): Promise<GiftRow[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('room_gifts').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(12);
  if (error) throw error;
  return (data ?? []) as GiftRow[];
}

/**
 * What one person on a seat has been given during this visit: the count starts
 * when they sit down and is zero again once they stand up or leave.
 */
export type SeatGiftTotal = {
  /** Diamonds received since they sat down, which is what the seat shows. */
  diamonds: number;
  /** How many gifts landed since then. */
  gifts: number;
};

/**
 * The diamonds each person has received in the room, by user. One read serves
 * every seat, and each phone shows the same numbers.
 */
export async function getSeatGiftTotals(roomId: string): Promise<Record<string, SeatGiftTotal>> {
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.rpc('room_seat_gifts', { p_room: roomId });
  if (error) throw error;
  const rows = (data ?? []) as {
    user_id: string;
    diamonds: number;
    gifts: number;
  }[];
  const totals: Record<string, SeatGiftTotal> = {};
  for (const row of rows) {
    totals[row.user_id] = {
      diamonds: Number(row.diamonds) || 0,
      gifts: Number(row.gifts) || 0,
    };
  }
  return totals;
}

/** One person who sent gifts to a seat during its visit, with their total. */
export type SeatGiftSender = {
  sender_id: string | null;
  sender_name: string;
  /** Diamonds these gifts were worth during this visit. */
  diamonds: number;
  /** How many gifts this person sent during this visit. */
  gifts: number;
  last_at: string;
};

/**
 * Who filled a seat's counter: the people who sent gifts to that person since
 * they sat down, biggest first. The seat only shows the total; this names each
 * giver.
 */
export async function getSeatGiftSenders(roomId: string, userId: string): Promise<SeatGiftSender[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('room_seat_gift_senders', { p_room: roomId, p_user: userId });
  if (error) throw error;
  return ((data ?? []) as {
    sender_id: string | null;
    sender_name: string;
    diamonds: number;
    gifts: number;
    last_at: string;
  }[]).map(row => ({
    sender_id: row.sender_id,
    sender_name: row.sender_name,
    diamonds: Number(row.diamonds) || 0,
    gifts: Number(row.gifts) || 0,
    last_at: row.last_at,
  }));
}

export async function getVoices(roomId: string): Promise<VoiceRow[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('room_voices').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as VoiceRow[];
}

export function voiceUrl(path: string) {
  const client = getSupabase();
  if (!client) return '';
  return assetUrl(client.storage.from('room-voice').getPublicUrl(path).data.publicUrl);
}

/** Uploads one finished microphone clip and announces it to the room. Refused when muted. */
export async function publishVoice(roomId: string, userId: string, uri: string, durationMs: number, mimeType?: string | null) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const type = mimeType || 'audio/webm';
  const extension = type.includes('mp4') || type.includes('m4a') || type.includes('aac') ? 'm4a'
    : type.includes('3gpp') ? '3gp'
    : type.includes('mpeg') ? 'mp3'
    : 'webm';
  const path = `${roomId}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  await uploadPickedFile({ bucket: 'room-voice', path, uri, contentType: type, failure: 'No pudimos enviar tu voz' });
  const { error: rpcError } = await client.rpc('publish_voice', { p_room: roomId, p_path: path, p_duration: Math.round(durationMs) });
  if (rpcError) throw new Error(rpcError.message);
}

export async function setSpeaking(roomId: string, speaking: boolean) {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.rpc('set_speaking', { p_room: roomId, p_speaking: speaking });
  if (error) throw new Error(error.message);
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  const row = (data ?? null) as ProfileRow | null;
  if (!row) return null;
  // Both answers are needed at once: asking them in parallel saves a full
  // round trip on every profile the app opens.
  const [badges, cards] = await Promise.all([
    badgesFor([userId]).catch((): Record<string, string | null> => ({})),
    agencyCards([userId]).catch((): Record<string, { name: string; photo: string | null }> => ({})),
  ]);
  const profile: ProfileRow = {
    ...row,
    badge: badges[userId] ?? row.badge ?? null,
    agency_name: cards[userId]?.name ?? row.agency_name ?? null,
    agency_photo_url: cards[userId]?.photo ?? null,
  };
  // Lo que llegó se guarda para abrir esta ficha al instante la próxima vez.
  rememberProfiles([profile]);
  return profile;
}

/** Profiles of several people at once, for the list of who is in a room. */
export async function listProfiles(ids: string[]): Promise<ProfileRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('profiles').select('*').in('id', unique);
  if (error) throw error;
  const rows = (data ?? []) as ProfileRow[];
  const [badges, cards] = await Promise.all([
    badgesFor(unique).catch((): Record<string, string | null> => ({})),
    agencyCards(unique).catch((): Record<string, { name: string; photo: string | null }> => ({})),
  ]);
  const profiles = rows.map(row => ({
    ...row,
    badge: badges[row.id] ?? row.badge ?? null,
    agency_name: cards[row.id]?.name ?? row.agency_name ?? null,
    agency_photo_url: cards[row.id]?.photo ?? null,
  }));
  rememberProfiles(profiles);
  return profiles;
}

/** El nombre y el logo de la agencia de cada persona, en una sola llamada. */
export async function agencyCards(ids: string[]): Promise<Record<string, { name: string; photo: string | null }>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.rpc('agency_cards', { p_users: unique });
  if (error) throw error;
  const found = (data ?? []) as { user_id: string; agency_name: string; agency_photo_url: string | null }[];
  return Object.fromEntries(found.map(row => [row.user_id, { name: row.agency_name, photo: row.agency_photo_url }]));
}

/**
 * La insignia de rol de cada persona, ya resuelta por el servidor: el rol de
 * equipo, la insignia guardada y si es anfitrión de una sala abierta.
 */
export async function badgesFor(ids: string[]): Promise<Record<string, string | null>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return {};
  const client = getSupabase();
  if (!client) return {};
  const { data, error } = await client.rpc('profile_badges', { p_users: unique });
  if (error) throw error;
  const found = (data ?? []) as { user_id: string; badge: string | null }[];
  return Object.fromEntries(found.map(row => [row.user_id, row.badge]));
}

/** People of the app whose name starts with what was written. */
export async function searchPeople(query: string, excludeId?: string): Promise<ProfileRow[]> {
  const client = getSupabase();
  if (!client) return [];
  const text = query.trim();
  if (text.length < 2) return [];
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .ilike('display_name', `%${text}%`)
    .limit(12);
  if (error) return [];
  return ((data ?? []) as ProfileRow[]).filter(row => row.id !== excludeId);
}

export type RoomInviteRow = {
  id: string;
  room_id: string;
  room_slug: string;
  room_title: string;
  from_user_id: string;
  from_name: string;
  to_user_id: string;
  join_code: string | null;
  status: string;
  created_at: string;
};

/** The invitations this person received and has not answered yet. */
export async function listRoomInvites(userId: string): Promise<RoomInviteRow[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('room_invites')
    .select('*')
    .eq('to_user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as RoomInviteRow[];
}

/** The room's invitation to one person. The server checks who is asking. */
export async function inviteToRoom(roomId: string, toUserId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('invite_to_room', { p_room: roomId, p_to_user: toUserId }));
}

/** The guest accepts the invitation and the room opens. */
export async function acceptRoomInvite(inviteId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.from('room_invites').update({ status: 'accepted' }).eq('id', inviteId);
}

export async function saveProfile(
  userId: string,
  patch: Partial<Pick<ProfileRow, 'display_name' | 'bio' | 'country' | 'avatar_url' | 'cover_url' | 'svip_level' | 'svip_show' | 'equipped_frame' | 'gender'>>,
) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.from('profiles').update(patch).eq('id', userId);
  if (error) throw error;
}

export type ProfileStats = { followers: number; following: number; friends: number; visitors: number; is_following: boolean };

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const client = getSupabase();
  if (!client) return { followers: 0, following: 0, friends: 0, visitors: 0, is_following: false };
  const { data, error } = await client.rpc('profile_stats', { p_profile: userId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ProfileStats | null;
  return row ?? { followers: 0, following: 0, friends: 0, visitors: 0, is_following: false };
}

/** Toggles following and answers whether the person is followed now. */
export async function toggleFollow(userId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('follow_user', { p_user: userId });
  if (error) throw error;
  return Boolean(data);
}

export async function recordProfileVisit(userId: string) {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.rpc('record_profile_visit', { p_profile: userId });
  if (error) throw error;
}

export async function uploadProfileImage(userId: string, kind: 'avatar' | 'cover', photo: { uri: string; mimeType?: string | null; fileName?: string | null }) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { contentType, extension } = imageType(photo);
  const path = `${userId}/${kind}-${Date.now()}.${extension}`;
  await uploadPickedFile({ bucket: 'profile-media', path, uri: photo.uri, contentType, upsert: true, failure: 'No pudimos subir la foto' });
  return assetUrl(client.storage.from('profile-media').getPublicUrl(path).data.publicUrl);
}

type RpcResult<T> = { data: T | null; error: { message: string } | null };

function unwrap<T>(result: RpcResult<T>): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/**
 * Opens the person's room. A shape chosen here is drawn from the very first
 * moment, so the people who walk in find the hall they were invited to;
 * without one the room keeps the plain grid of ten places.
 */
export async function openRoom(
  title: string,
  cover: string,
  country: string,
  shape?: { layout: string | null; seats: number; mode?: 'audio' | 'camera' },
): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  return unwrap(await client.rpc('open_room', {
    p_title: title,
    p_cover: cover,
    p_country: country,
    p_layout: shape?.layout ?? null,
    p_seats: shape?.seats ?? 10,
    p_mode: shape?.mode ?? 'audio',
  }));
}

/**
 * Sits the person down. One account lives in one room: when it was sitting
 * somewhere else, the server gives that seat back and returns the title of the
 * room it left, so the app can say where they came from.
 */
export async function takeSeat(roomId: string, seatNo: number): Promise<string | null> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const movedFrom = unwrap<string | null>(await client.rpc('take_seat', { p_room: roomId, p_seat: seatNo }));
  return typeof movedFrom === 'string' && movedFrom.trim() ? movedFrom : null;
}

export async function leaveSeat(roomId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('leave_seat', { p_room: roomId }));
}

export async function postMessage(roomId: string, body: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('post_room_message', { p_room: roomId, p_body: body }));
}

export async function setSeats(roomId: string, seats: number) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('expand_room_seats', { p_room: roomId, p_seats: seats }));
}

/**
 * The design a room wears, and the places it draws. Both travel together: a
 * design of nine places sets the room to nine seats, so no chair is left
 * without a place on the square.
 */
export async function setRoomLayout(roomId: string, layout: string | null, seats: number) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('set_room_layout', { p_room: roomId, p_layout: layout, p_seats: seats }));
}

/** The host opens or closes the room's cameras. Returns what is now allowed. */
export async function setRoomCamera(roomId: string, allow: boolean): Promise<boolean> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('set_room_camera', { p_room: roomId, p_allow: allow });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** The host turns the room into a voice hall or a camera hall. */
export async function setRoomMode(roomId: string, mode: 'audio' | 'camera'): Promise<'audio' | 'camera'> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('set_room_mode', { p_room: roomId, p_mode: mode });
  if (error) throw new Error(error.message);
  return data === 'camera' ? 'camera' : 'audio';
}

/** Which seats of this room carry a padlock right now. */
export async function getSeatLocks(roomId: string): Promise<number[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('room_seat_locks').select('seat_no').eq('room_id', roomId);
  if (error) return [];
  return ((data ?? []) as { seat_no: number }[]).map(row => row.seat_no);
}

/** The host closes or opens one seat. The server checks who is asking. */
export async function setSeatLock(roomId: string, seatNo: number, locked: boolean) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('set_seat_lock', { p_room: roomId, p_seat: seatNo, p_locked: locked }));
}

/** The host's own code for a private room. Nobody else can read it. */
export async function getRoomCode(roomId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('room_join_codes').select('code').eq('room_id', roomId).maybeSingle();
  if (error) return null;
  return (data as { code: string } | null)?.code ?? null;
}

/** Makes the room private (with a code) or public again; returns the code. */
export async function setRoomPrivate(roomId: string, isPrivate: boolean, code?: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  return unwrap(await client.rpc('set_room_private', { p_room: roomId, p_private: isPrivate, p_code: code ?? null }));
}

/** Whether these words are the room's own code. */
export async function roomCodeMatches(roomId: string, code: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  const { data, error } = await client.rpc('room_code_matches', { p_room: roomId, p_code: code });
  if (error) return false;
  return Boolean(data);
}

/** The host's own words at the top of the room. */
export async function setRoomTitle(roomId: string, title: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('set_room_title', { p_room: roomId, p_title: title }));
}

/** The host or a moderator shares one YouTube video with the whole room. */
export async function setRoomVideo(roomId: string, url: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('set_room_video', { p_room: roomId, p_url: url }));
}

export async function clearRoomVideo(roomId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('clear_room_video', { p_room: roomId }));
}

export async function moderate(roomId: string, userId: string, action: 'mute' | 'unmute' | 'kick') {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('moderate_member', { p_room: roomId, p_user: userId, p_action: action }));
}

/** How long this person is kept out of the room after being expelled. */
export async function roomBan(roomId: string): Promise<{ until: string } | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('room_ban_state', { p_room: roomId });
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as { banned?: boolean; until?: string } | null;
  return row?.banned && row.until ? { until: row.until } : null;
}

/** The host lets everyone expelled back in. */
export async function forgiveRoomBans(roomId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('forgive_room_member', { p_room: roomId, p_user: null }));
}

/** People the host kept out of this room right now. */
export async function listRoomBans(roomId: string): Promise<{ user_id: string; until: string }[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('room_bans')
    .select('user_id, until')
    .eq('room_id', roomId)
    .gt('until', new Date().toISOString());
  if (error) return [];
  return (data ?? []) as { user_id: string; until: string }[];
}

export async function setAnnouncement(roomId: string, text: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  unwrap(await client.rpc('set_room_announcement', { p_room: roomId, p_text: text }));
}

export function roomPhotoUrl(path: string) {
  const client = getSupabase();
  if (!client) return '';
  return assetUrl(client.storage.from('room-photos').getPublicUrl(path).data.publicUrl);
}

async function uploadRoomImage(roomId: string, userId: string, photo: { uri: string; mimeType?: string | null; fileName?: string | null }, kind: 'background' | 'chat') {
  const { contentType, extension } = imageType(photo);
  const path = `${roomId}/${userId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  await uploadPickedFile({ bucket: 'room-photos', path, uri: photo.uri, contentType, failure: 'No pudimos subir la imagen. Inténtalo otra vez.' });
  return path;
}

/** The host's own photo as the room background; `null` returns to the built-in cover. */
export async function setRoomBackground(roomId: string, userId: string, photo: { uri: string; mimeType?: string | null; fileName?: string | null } | null) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const path = photo ? await uploadRoomImage(roomId, userId, photo, 'background') : null;
  const { error } = await client.rpc('set_room_background', { p_room: roomId, p_path: path });
  if (error) throw new Error(error.message);
}

export async function sendRoomPhoto(roomId: string, userId: string, photo: { uri: string; mimeType?: string | null; fileName?: string | null }, caption = '') {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const path = await uploadRoomImage(roomId, userId, photo, 'chat');
  const { error } = await client.rpc('post_room_photo', { p_room: roomId, p_path: path, p_caption: caption });
  if (error) throw new Error(error.message);
}

export async function clearRoomChat(roomId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('clear_room_chat', { p_room: roomId });
  if (error) throw new Error(error.message);
}

export async function getModerators(roomId: string): Promise<string[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('room_moderators').select('user_id').eq('room_id', roomId);
  if (error) throw error;
  return ((data ?? []) as { user_id: string }[]).map(row => row.user_id);
}

export async function setModerator(roomId: string, userId: string, on: boolean) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('set_room_moderator', { p_room: roomId, p_user: userId, p_on: on });
  if (error) throw new Error(error.message);
}

export async function sendGift(roomId: string, giftKey: string, recipientId?: string | null, quantity = 1): Promise<number> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const qty = Math.min(999, Math.max(1, Math.round(quantity)));
  return unwrap(
    await client.rpc('send_gift_quantity', {
      p_room: roomId,
      p_gift: giftKey,
      p_recipient: recipientId ?? null,
      p_qty: qty,
    }),
  );
}

export type Connection = { id: string; display_name: string; avatar_url: string | null; level: number; is_following: boolean };

export async function getConnections(userId: string, kind: 'followers' | 'following' | 'friends'): Promise<Connection[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('profile_connections', { p_profile: userId, p_kind: kind });
  if (error) throw error;
  return (data ?? []) as Connection[];
}

type RoomLiveHandlers = {
  /** The room itself changed: seats count, announcement, closing. */
  onChange: () => void;
  /**
   * A seat change is one small read, so it reaches every phone right away
   * instead of waiting for the whole room to reload.
   */
  onSeatsChange?: () => void;
  /** Chat and gifts are their own small read: a message never reloads the room. */
  onChatChange?: () => void;
  onProfileChange?: () => void;
  onBanChange?: () => void;
};

/**
 * Runs an optional handler by reference. A screen replaced while a channel is
 * still open can leave an older callback behind; it must never throw.
 */
function run(ref: { current?: unknown }) {
  const handler = ref.current;
  if (typeof handler === 'function') (handler as () => void)();
}

/**
 * Subscribes to everything the room shows. Events arrive as rows are written,
 * and each one re-reads only what its table changes, so every phone stays in
 * step without stalling the app.
 */
export function useRoomLive(roomId: string | null, handlers: RoomLiveHandlers) {
  const onChange = handlers.onChange;
  const onProfileChange = handlers.onProfileChange;
  const onBanChange = handlers.onBanChange;
  const onSeatsChange = handlers.onSeatsChange;
  const onChatChange = handlers.onChatChange;
  const callback = useRef(onChange);
  callback.current = onChange;
  const profileCallback = useRef(onProfileChange);
  profileCallback.current = onProfileChange;
  const banCallback = useRef(onBanChange);
  banCallback.current = onBanChange;
  const seatsCallback = useRef(onSeatsChange);
  seatsCallback.current = onSeatsChange;
  const chatCallback = useRef(onChatChange);
  chatCallback.current = onChatChange;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounced = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(callback), 400);
  }, []);
  const seatDebounced = useCallback(() => {
    if (seatTimer.current) clearTimeout(seatTimer.current);
    seatTimer.current = setTimeout(() => run(seatsCallback), 60);
  }, []);
  const chatDebounced = useCallback(() => {
    if (chatTimer.current) clearTimeout(chatTimer.current);
    chatTimer.current = setTimeout(() => run(chatCallback), 80);
  }, []);
  // A photo or a level changes in any profile of the app, not only in this
  // room. One read answers a burst of changes instead of one read each.
  const profileDebounced = useCallback(() => {
    if (profileTimer.current) clearTimeout(profileTimer.current);
    profileTimer.current = setTimeout(() => profileCallback.current?.(), 700);
  }, []);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (seatTimer.current) clearTimeout(seatTimer.current);
    if (chatTimer.current) clearTimeout(chatTimer.current);
    if (profileTimer.current) clearTimeout(profileTimer.current);
  }, []);
  useEffect(() => {
    const client = getSupabase();
    if (!client || !roomId) return;
    let channel: RealtimeChannel | null = null;
    let open = true;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    const refresh = debounced;

    const schedule = () => {
      if (!open) return;
      if (retry) clearTimeout(retry);
      // A dropped socket reconnects on its own most of the time; when it does
      // not, the room opens a fresh channel, waiting a little longer each time
      // so a phone without signal does not hammer the server.
      const wait = Math.min(8000, 600 * 2 ** attempt);
      attempt += 1;
      retry = setTimeout(() => { void start(); }, wait);
    };

    const start = async () => {
      if (!open) return;
      if (channel) {
        try { await client.removeChannel(channel); } catch { /* already gone */ }
        channel = null;
      }
      if (!open) return;
      channel = client.channel(`room:${roomId}:${Math.random().toString(36).slice(2)}`);
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_seats', filter: `room_id=eq.${roomId}` }, () => {
          if (typeof seatsCallback.current === 'function') seatDebounced();
          else refresh();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_seat_locks', filter: `room_id=eq.${roomId}` }, () => {
          if (typeof seatsCallback.current === 'function') seatDebounced();
          else refresh();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` }, () => {
          if (typeof chatCallback.current === 'function') chatDebounced();
          else refresh();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_gifts', filter: `room_id=eq.${roomId}` }, () => {
          if (typeof chatCallback.current === 'function') chatDebounced();
          else refresh();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'room_moderators', filter: `room_id=eq.${roomId}` }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, refresh);
      // People already sitting can change their photo, level or SVIP while here.
      if (onProfileChange) {
        channel.on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
          profileDebounced();
        });
      }
      // Being expelled reaches the person's phone at once, not on the next open.
      if (onBanChange) {
        channel.on('postgres_changes', { event: '*', schema: 'public', table: 'room_bans', filter: `room_id=eq.${roomId}` }, () => {
          banCallback.current?.();
        });
      }
      channel.subscribe(status => {
        if (!open) return;
        if (status === 'SUBSCRIBED') {
          attempt = 0;
          // Whatever changed while the socket was down is read once now.
          refresh();
          return;
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') schedule();
      });
    };

    void start();

    // Coming back from another app or a locked screen: the phone may have lost
    // its socket, so the room re-reads its data and reconnects.
    const activity = AppState.addEventListener('change', state => {
      if (state !== 'active') return;
      refresh();
      if (!open) return;
      const socket = channel;
      if (!socket || String(socket.state) !== 'joined') schedule();
    });

    return () => {
      open = false;
      activity.remove();
      if (retry) clearTimeout(retry);
      if (channel) void client.removeChannel(channel);
    };
  }, [roomId, Boolean(onProfileChange), Boolean(onBanChange)]);
}

export function useRoomsLive(onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // While the app is in another window nothing is being read, so the events
  // are remembered and answered once, on the way back, instead of waking the
  // phone for every seat that moves.
  const paused = useRef(false);
  const pending = useRef(false);
  const debounced = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callback.current(), 600);
  }, []);
  const changed = useCallback(() => {
    if (paused.current) {
      pending.current = true;
      return;
    }
    debounced();
  }, [debounced]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const activity = AppState.addEventListener('change', state => {
      paused.current = state !== 'active';
      if (!paused.current && pending.current) {
        pending.current = false;
        debounced();
      }
    });
    return () => activity.remove();
  }, [debounced]);
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    return keepLiveChannel(client, 'rooms:catalog', channel => channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, changed)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_seats' }, changed),
    changed);
  }, []);
}

export function useTicker(active: boolean, intervalMs = 15000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setTick(value => value + 1), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return tick;
}

export type FoundProfile = { id: string; display_name: string; avatar_url: string | null; user_number: number; level: number; svip_level: number };

/** Finds a person by their seven digit number. */
export async function profileByNumber(userNumber: number): Promise<FoundProfile | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('profile_by_number', { p_number: Math.round(userNumber) });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as FoundProfile | null;
  return row ?? null;
}

/** Closes the host's room for everyone; a new one can be opened afterwards. */
export async function closeRoom(roomId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('close_room', { p_room: roomId });
  if (error) throw new Error(error.message);
}

export type ModeratorColor = { user_id: string; bubble_color: string };

/** The bubble colour each moderator wears in this room. */
export async function getModeratorColors(roomId: string): Promise<ModeratorColor[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('room_moderator_colors', { p_room: roomId });
  if (error) throw error;
  return (data ?? []) as ModeratorColor[];
}

/** The host gives a moderator their bubble colour (rose, blue or red). */
export async function setModeratorBubble(roomId: string, userId: string, color: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('set_moderator_bubble', { p_room: roomId, p_user: userId, p_color: color });
  if (error) throw new Error(error.message);
}
