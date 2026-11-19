import { useEffect, useRef } from 'react';
import { getSupabase } from '@/lib/supabase';
import { uploadPickedFile } from '@/lib/upload';
import { keepLiveChannel } from '@/lib/live-channel';

export type DjTrack = {
  id: string;
  user_id: string;
  title: string;
  storage_path: string;
  duration_ms: number;
  created_at: string;
};

export type PlaylistRow = {
  id: string;
  room_id: string;
  track_id: string;
  added_by: string;
  position: number;
  created_at: string;
  track: DjTrack;
};

export type PlaybackRow = {
  room_id: string;
  track_id: string | null;
  playing: boolean;
  position_ms: number;
  started_at: string;
  volume: number;
  updated_by: string | null;
  updated_at: string;
};

export type SongInRoom = PlaylistRow & { url: string; owner: string };

/** Songs are stored under the person's own folder in the room-music bucket. */
export function musicUrl(path: string) {
  const client = getSupabase();
  if (!client) return '';
  return client.storage.from('room-music').getPublicUrl(path).data.publicUrl;
}

export function formatSongTime(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** The person's own DJ library, newest first. */
export async function listMyTracks(userId: string): Promise<DjTrack[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('dj_tracks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) return [];
  return (data ?? []) as DjTrack[];
}

/**
 * Uploads one song from the phone and saves it in the person's library.
 * The player measures the real duration once the file is on the server.
 */
export async function uploadTrack(
  userId: string,
  picked: { uri: string; fileName?: string | null; mimeType?: string | null; size?: number | null },
  title: string,
  durationMs = 0,
): Promise<DjTrack> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  if (picked.size && picked.size > 35 * 1024 * 1024) throw new Error('La música debe pesar 35 MB o menos');
  const name = (picked.fileName ?? 'musica.mp3').toLowerCase();
  const extension = ['mp3', 'm4a', 'aac', 'ogg', 'wav', 'webm'].find(item => name.endsWith(`.${item}`)) ?? 'mp3';
  const contentType = picked.mimeType || (extension === 'mp3' ? 'audio/mpeg' : `audio/${extension}`);
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  await uploadPickedFile({ bucket: 'room-music', path, uri: picked.uri, contentType, failure: 'No pudimos subir la música' });
  const { data, error } = await client.rpc('save_dj_track', {
    p_title: title.trim().slice(0, 80) || extension.toUpperCase() + ' sin título',
    p_path: path,
    p_duration_ms: Math.round(durationMs),
  });
  if (error) throw new Error(error.message);
  const { data: row } = await client.from('dj_tracks').select('*').eq('id', data as string).maybeSingle();
  return row as DjTrack;
}

export async function deleteTrack(trackId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('delete_dj_track', { p_track: trackId });
  if (error) throw new Error(error.message);
}

/** The room playlist, in the order it was built, with playable addresses. */
export async function listPlaylist(roomId: string): Promise<SongInRoom[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('room_playlist')
    .select('*, track:dj_tracks(*)')
    .eq('room_id', roomId)
    .order('position', { ascending: true });
  if (error) return [];
  const rows = (data ?? []) as PlaylistRow[];
  return rows
    .filter(row => row.track)
    .map(row => ({ ...row, url: musicUrl(row.track.storage_path), owner: row.track.user_id }));
}

export async function addToPlaylist(roomId: string, trackId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('add_room_track', { p_room: roomId, p_track: trackId });
  if (error) throw new Error(error.message);
}

export async function removeFromPlaylist(roomId: string, trackId: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('remove_room_track', { p_room: roomId, p_track: trackId });
  if (error) throw new Error(error.message);
}

/** Plays, pauses or restarts one song for the whole room at once. */
export async function playForRoom(roomId: string, trackId: string, positionMs = 0) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('set_room_playback', {
    p_room: roomId, p_track: trackId, p_playing: true, p_position_ms: Math.max(0, Math.round(positionMs)),
  });
  if (error) throw new Error(error.message);
}

export async function pauseForRoom(roomId: string, trackId: string | null, positionMs: number) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('set_room_playback', {
    p_room: roomId, p_track: trackId, p_playing: false, p_position_ms: Math.max(0, Math.round(positionMs)),
  });
  if (error) throw new Error(error.message);
}

/** One volume for everyone: the DJ moves it, every phone follows. */
export async function setRoomVolume(roomId: string, volume: number) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('set_room_volume', { p_room: roomId, p_volume: Math.min(1, Math.max(0, volume)) });
  if (error) throw new Error(error.message);
}

export async function setRoomDj(roomId: string, userId: string | null) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('set_room_dj', { p_room: roomId, p_user: userId });
  if (error) throw new Error(error.message);
}

export async function getPlayback(roomId: string): Promise<PlaybackRow | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('room_playback').select('*').eq('room_id', roomId).maybeSingle();
  if (error) return null;
  return (data as PlaybackRow) ?? null;
}

export async function getRoomDj(roomId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.from('room_dj').select('user_id').eq('room_id', roomId).maybeSingle();
  if (error) return null;
  return (data as { user_id: string } | null)?.user_id ?? null;
}

/**
 * Where the room is in the song right now. Every phone adds the time since the
 * play started to the saved position, so all of them hear the same second.
 */
export function playheadMs(state: PlaybackRow, clockOffsetMs = 0, now = Date.now()) {
  if (!state.playing) return state.position_ms;
  const started = new Date(state.started_at).getTime() + clockOffsetMs;
  return Math.max(0, state.position_ms + (now - started));
}

export function useRommDjLive(roomId: string | null, onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    const client = getSupabase();
    if (!client || !roomId) return;
    return keepLiveChannel(client, `dj:${roomId}`, channel => channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_playlist', filter: `room_id=eq.${roomId}` }, () => callback.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_playback', filter: `room_id=eq.${roomId}` }, () => callback.current())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_dj', filter: `room_id=eq.${roomId}` }, () => callback.current()),
    () => callback.current());
  }, [roomId]);
}
