import { getSupabase } from './supabase';
import { uploadPickedFile } from './upload';
import { videoType, type PickedVideo } from './pick-video';

/**
 * The entry video on the person's own profile: upload, read and switch off.
 * The server keeps the address and the day it stops playing; the room reads
 * both with the profile it already loads when someone arrives.
 */

export const ENTRY_VIDEO_DAYS = 15;

export function entryVideoUrl(path: string | null | undefined): string | null {
  const client = getSupabase();
  if (!client || !path) return null;
  return client.storage.from('entry-videos').getPublicUrl(path).data.publicUrl;
}

/** The clip that should play right now, or null when there is none or it lapsed. */
export function liveEntryVideo(profile: { entry_video_path?: string | null; entry_video_until?: string | null } | null | undefined): string | null {
  if (!profile?.entry_video_path || !profile.entry_video_until) return null;
  const until = new Date(profile.entry_video_until).getTime();
  if (Number.isNaN(until) || until <= Date.now()) return null;
  return entryVideoUrl(profile.entry_video_path);
}

/** Days left of the clip, so the profile can say when it ends. */
export function entryVideoDaysLeft(profile: { entry_video_until?: string | null } | null | undefined): number {
  if (!profile?.entry_video_until) return 0;
  const until = new Date(profile.entry_video_until).getTime();
  if (Number.isNaN(until)) return 0;
  return Math.max(0, Math.ceil((until - Date.now()) / 86_400_000));
}

/** Uploads the clip and turns it on for fifteen days. */
export async function uploadEntryVideo(userId: string, video: PickedVideo): Promise<string> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { contentType, extension } = videoType(video);
  const path = `${userId}/entrada-${Date.now()}.${extension}`;
  await uploadPickedFile({
    bucket: 'entry-videos',
    path,
    uri: video.uri,
    contentType,
    failure: 'No pudimos subir tu video',
  });
  const { data, error } = await client.rpc('set_entry_video', { p_path: path, p_days: ENTRY_VIDEO_DAYS });
  if (error) throw new Error(error.message);
  return typeof data === 'string' ? data : new Date(Date.now() + ENTRY_VIDEO_DAYS * 86_400_000).toISOString();
}

export async function clearEntryVideo(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.rpc('clear_entry_video');
  if (error) throw new Error(error.message);
}
