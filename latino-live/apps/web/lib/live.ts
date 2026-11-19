import { getSupabase } from "@/lib/supabase";

/**
 * The room data of Latino Live in the browser. It reads and writes the same
 * tables and calls the same SQL functions the phone app uses, so both see the
 * same rooms, seats, chat, gifts and ranking at the same moment.
 */

export type RoomRow = {
  id: string;
  slug: string;
  title: string;
  host_id: string | null;
  host_name: string;
  country: string;
  cover: "palace" | "pool" | "terrace";
  max_seats: number;
  announcement: string;
  is_official: boolean;
  background_path: string | null;
  video_url?: string | null;
  /** A private room only opens with its code. */
  is_private?: boolean | null;
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

export type MessageRow = {
  id: number;
  room_id: string;
  user_id: string | null;
  author: string;
  kind: "welcome" | "system" | "user" | "announcement" | "gift" | "photo";
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
  equipped_frame: string | null;
  user_number: number | null;
  created_at: string;
};

export type RoomInviteRow = {
  id: string;
  room_id: string;
  room_slug: string;
  room_title: string;
  from_name: string;
  to_user_id: string;
  join_code: string | null;
  status: string;
  created_at: string;
};

export type RankedRoom = {
  room_id: string;
  title: string;
  host_name: string;
  cover: string;
  photo_path: string | null;
  gold: number;
  pk_wins: number;
  score: number;
};

export const MAX_MESSAGES = 20;

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Cuentas no disponibles");
  return supabase;
}

function unwrap<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function listRooms(): Promise<RoomRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .is("closed_at", null)
    .eq("is_private", false)
    .order("is_official", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []) as RoomRow[];
}

export async function findRoom(key: string): Promise<RoomRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq(uuid ? "id" : "slug", key)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RoomRow | null;
}

export async function getSeats(roomId: string): Promise<SeatRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("room_seats").select("*").eq("room_id", roomId).order("seat_no");
  if (error) throw error;
  return (data ?? []) as SeatRow[];
}

export async function getSeatsForRooms(roomIds: string[]): Promise<Record<string, SeatRow[]>> {
  const supabase = getSupabase();
  if (!supabase || roomIds.length === 0) return {};
  const { data, error } = await supabase.from("room_seats").select("*").in("room_id", roomIds);
  if (error) throw error;
  const grouped: Record<string, SeatRow[]> = {};
  for (const seat of (data ?? []) as SeatRow[]) (grouped[seat.room_id] ??= []).push(seat);
  return grouped;
}

export async function getMessages(roomId: string): Promise<MessageRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("room_messages")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(MAX_MESSAGES);
  if (error) throw error;
  return ((data ?? []) as MessageRow[]).reverse();
}

export async function getGifts(roomId: string): Promise<GiftRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("room_gifts")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data ?? []) as GiftRow[];
}

export async function getRoomRanking(limit = 8): Promise<RankedRoom[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.rpc("room_ranking", { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as RankedRoom[];
}

export async function getProfile(userId: string): Promise<ProfileRow | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as ProfileRow | null;
}

export async function listProfiles(ids: string[]): Promise<ProfileRow[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("profiles").select("*").in("id", unique);
  if (error) throw error;
  return (data ?? []) as ProfileRow[];
}

export type ProfileStats = {
  followers: number;
  following: number;
  friends: number;
  visitors: number;
  is_following: boolean;
};

/** The four counts a profile shows, counted by the database itself. */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = getSupabase();
  const empty: ProfileStats = { followers: 0, following: 0, friends: 0, visitors: 0, is_following: false };
  if (!supabase) return empty;
  const { data, error } = await supabase.rpc("profile_stats", { p_profile: userId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ProfileStats | null;
  return row ?? empty;
}

/** People of the app whose name starts with what was written. */
export async function searchPeople(query: string, excludeId?: string): Promise<ProfileRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const text = query.trim();
  if (text.length < 2) return [];
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .ilike("display_name", `%${text}%`)
    .limit(12);
  if (error) return [];
  return ((data ?? []) as ProfileRow[]).filter(row => row.id !== excludeId);
}

/** The room's invitation to one person. The server checks who is asking. */
export async function inviteToRoom(roomId: string, toUserId: string): Promise<void> {
  unwrap(await client().rpc("invite_to_room", { p_room: roomId, p_to_user: toUserId }));
}

/** The invitations this person received and has not answered yet. */
export async function listRoomInvites(userId: string): Promise<RoomInviteRow[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("room_invites")
    .select("*")
    .eq("to_user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []) as RoomInviteRow[];
}

/** The guest accepts the invitation and the room opens. */
export async function acceptRoomInvite(inviteId: string): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  await supabase.from("room_invites").update({ status: "accepted" }).eq("id", inviteId);
}

export async function takeSeat(roomId: string, seatNo: number) {
  unwrap(await client().rpc("take_seat", { p_room: roomId, p_seat: seatNo }));
}

/** Which seats of this room carry a padlock right now. */
export async function getSeatLocks(roomId: string): Promise<number[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("room_seat_locks").select("seat_no").eq("room_id", roomId);
  if (error) return [];
  return ((data ?? []) as { seat_no: number }[]).map(row => row.seat_no);
}

/** The host closes or opens one seat. The server checks who is asking. */
export async function setSeatLock(roomId: string, seatNo: number, locked: boolean) {
  unwrap(await client().rpc("set_seat_lock", { p_room: roomId, p_seat: seatNo, p_locked: locked }));
}

/** The host's own code for a private room. Nobody else can read it. */
export async function getRoomCode(roomId: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("room_join_codes").select("code").eq("room_id", roomId).maybeSingle();
  if (error) return null;
  return (data as { code: string } | null)?.code ?? null;
}

/** Makes the room private (with a code) or public again; returns the code. */
export async function setRoomPrivate(roomId: string, isPrivate: boolean, code?: string): Promise<string | null> {
  return unwrap(await client().rpc("set_room_private", { p_room: roomId, p_private: isPrivate, p_code: code ?? null }));
}

/** Whether these words are the room's own code. */
export async function roomCodeMatches(roomId: string, code: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { data, error } = await supabase.rpc("room_code_matches", { p_room: roomId, p_code: code });
  if (error) return false;
  return Boolean(data);
}

export async function leaveSeat(roomId: string) {
  unwrap(await client().rpc("leave_seat", { p_room: roomId }));
}

export async function postMessage(roomId: string, body: string) {
  unwrap(await client().rpc("post_room_message", { p_room: roomId, p_body: body }));
}

export async function setSpeaking(roomId: string, speaking: boolean) {
  try {
    unwrap(await client().rpc("set_speaking", { p_room: roomId, p_speaking: speaking }));
  } catch {
    // The speaking ring is decoration: never break the call for it.
  }
}

export async function sendGift(roomId: string, giftKey: string): Promise<number> {
  return unwrap(await client().rpc("send_gift_quantity", {
    p_room: roomId,
    p_gift: giftKey,
    p_recipient: null,
    p_qty: 1,
  }));
}

/** A gift of the catalogue, with its price in diamonds. */
export type GiftItem = { key: string; name: string; cost: number; art: string };

export const GIFTS: GiftItem[] = [
  { key: "corona", name: "Corona", cost: 10, art: "/gift/gift-corona.png" },
  { key: "dragon", name: "Dragón", cost: 50, art: "/gift/gift-dragon.png" },
  { key: "leon", name: "León", cost: 100, art: "/gift/gift-leon.png" },
  { key: "fenix", name: "Fénix", cost: 200, art: "/gift/gift-fenix.png" },
  { key: "trono", name: "Trono SVIP", cost: 500, art: "/gift/gift-trono.png" },
];

/** The public address of a photo stored in the room's bucket. */
export function photoUrl(path: string) {
  const supabase = getSupabase();
  if (!supabase) return "";
  return supabase.storage.from("room-photos").getPublicUrl(path).data.publicUrl;
}

export function coverArt(cover: string) {
  if (cover === "pool") return "/rooms/pool.jpg";
  if (cover === "terrace") return "/rooms/terrace.jpg";
  return "/rooms/palace.jpg";
}

/** The chat keeps its twenty newest messages, exactly as the room's rule says. */
export function appendMessage(list: MessageRow[], message: MessageRow): MessageRow[] {
  if (list.some(item => item.id === message.id)) return list;
  return [...list, message].slice(-MAX_MESSAGES);
}
