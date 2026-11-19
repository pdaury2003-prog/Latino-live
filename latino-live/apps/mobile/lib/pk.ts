import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getSupabase } from '@/lib/supabase';
import { keepLiveChannel } from '@/lib/live-channel';

export type PkBattle = {
  id: string;
  room_a: string;
  room_b: string;
  title_a: string;
  title_b: string;
  score_a: number;
  score_b: number;
  status: 'live' | 'finished';
  winner: string | null;
  ends_at: string;
  duration_seconds: number;
};

/** A battle inside one room: the seated people split into red and blue. */
export type TeamPkBattle = {
  id: string;
  room_id: string;
  score_red: number;
  score_blue: number;
  status: 'live' | 'finished';
  winner: 'red' | 'blue' | null;
  ends_at: string;
  started_at: string;
  duration_seconds: number;
  /** The last seat of Equipo Rojo; every seat above it is Equipo Azul. */
  split_seat: number;
  max_seats: number;
};

/** The room's battle: the live one, or the last result while it is fresh. */
export async function getPk(roomId: string): Promise<PkBattle | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('pk_for_room', { p_room: roomId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as PkBattle | null;
  return row ?? null;
}

/** The host throws the room into a battle against another open room. */
export async function startPk(roomId: string, rivalId: string, seconds = 180): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('start_pk', { p_room: roomId, p_rival: rivalId, p_seconds: seconds });
  if (error) throw new Error(error.message);
}

export async function finishPk(battleId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('finish_pk', { p_battle: battleId });
  if (error) throw new Error(error.message);
}

/** The room's team battle: the live one, or the last result. */
export async function getTeamPk(roomId: string): Promise<TeamPkBattle | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('team_pk_for_room', { p_room: roomId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as TeamPkBattle | null;
  return row ?? null;
}

/** The host splits the room into Equipo Rojo and Equipo Azul. */
export async function startTeamPk(roomId: string, seconds = 180): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('start_team_pk', { p_room: roomId, p_seconds: seconds });
  if (error) throw new Error(error.message);
}

export async function finishTeamPk(battleId: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('finish_team_pk', { p_battle: battleId });
  if (error) throw new Error(error.message);
}

/** Which room the signed-in account is sitting in right now. */
export async function getMyRoomSeat(): Promise<{ room_id: string; title: string; slug: string } | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('my_current_room');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as { room_id: string; title: string; slug: string } | null;
  return row ?? null;
}

export type RankedRoom = {
  room_id: string;
  title: string;
  host_name: string;
  cover: string;
  /** The photo the host put on the room; null when it still shows its cover. */
  photo_path: string | null;
  gold: number;
  pk_wins: number;
  score: number;
};

/** Today's best rooms, by diamonds received and battles won. */
export async function getRoomRanking(limit = 8): Promise<RankedRoom[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('room_ranking', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as RankedRoom[];
}

export type UserPodium = {
  /** Place of the room the person hosts, 1 being the brightest of today. */
  place: number;
  room_id: string;
  room_title: string;
  photo_path: string | null;
  gold: number;
  pk_wins: number;
  /** How many rooms earned diamonds today, so the place reads "de N". */
  total_rooms: number;
};

/**
 * The person's own podium place: their room wears the same TOP frame on the
 * ranking, and the profile card wears it too. Null when their room has not
 * earned a single diamond today.
 */
export async function getUserPodium(userId: string): Promise<UserPodium | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('user_podium', { p_user: userId });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as UserPodium | null;
  return row ?? null;
}

/**
 * The battle keeps running on the server; the phone only watches it. Every
 * gift sent in either room arrives here as a score change.
 */
export function usePkLive(roomId: string | null, onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    const client = getSupabase();
    if (!client || !roomId) return;
    return keepLiveChannel(client, `pk:${roomId}`, channel => channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pk_battles' }, () => callback.current()),
    () => callback.current());
  }, [roomId]);
}

/** The team battle changes as gifts land: every phone sees the same score. */
export function useTeamPkLive(roomId: string | null, onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    const client = getSupabase();
    if (!client || !roomId) return;
    return keepLiveChannel(client, `team-pk:${roomId}`, channel => channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_pk_battles' }, () => callback.current()),
    () => callback.current());
  }, [roomId]);
}

/**
 * The daily ranking moves while the app is open. Every gift sent in any room
 * and every battle that ends can change the places, so the billboard re-reads
 * only the ranking — not the whole room list — once the burst of gifts settles.
 */
export function useRankingLive(onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nothing is read while the app is in another window; the events are
  // remembered and answered once, on the way back.
  const paused = useRef(false);
  const pending = useRef(false);
  const debounced = useCallback((wait = 900) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callback.current(), wait);
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
        debounced(0);
      }
    });
    return () => activity.remove();
  }, [debounced]);
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    return keepLiveChannel(client, 'ranking:today', channel => channel
      // A gift adds diamonds to a room; a battle that ends adds its bonus.
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_gifts' }, changed)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pk_battles' }, changed)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'team_pk_battles' }, changed),
    () => callback.current());
  }, [changed]);
}

/** The seconds left, ticking once a second while a battle is live. */
export function usePkClock(battle: { id: string; ends_at: string; status: 'live' | 'finished' } | null) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!battle || battle.status !== 'live') {
      setLeft(0);
      return;
    }
    const run = () => setLeft(Math.max(0, Math.round((new Date(battle.ends_at).getTime() - Date.now()) / 1000)));
    run();
    const timer = setInterval(run, 1000);
    return () => clearInterval(timer);
  }, [battle?.id, battle?.ends_at, battle?.status]);
  return left;
}
