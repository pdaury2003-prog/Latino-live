import { assetUrl } from '@/lib/asset-host';
import { getSupabase } from '@/lib/supabase';
import { uploadPickedFile } from '@/lib/upload';
import { imageType } from '@/lib/pick-photo';

export type Moment = {
  id: string;
  author_id: string;
  author: string;
  avatar_url: string | null;
  level: number;
  body: string;
  image_path: string | null;
  room_slug: string | null;
  created_at: string;
  likes: number;
  comments: number;
  liked: boolean;
};

export type MomentComment = {
  id: number;
  moment_id: string;
  user_id: string;
  author: string;
  body: string;
  created_at: string;
};

export async function getMomentFeed(limit = 30): Promise<Moment[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('moment_feed', { p_limit: limit });
  if (error) throw error;
  return (data ?? []) as Moment[];
}

export function momentPhotoUrl(path: string) {
  const client = getSupabase();
  if (!client) return '';
  return assetUrl(client.storage.from('moments').getPublicUrl(path).data.publicUrl);
}

/** Uploads the chosen photo and saves the moment with its words. */
export async function publishMoment(userId: string, body: string, photo: { uri: string; mimeType?: string | null; fileName?: string | null } | null, roomSlug?: string | null) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const text = body.trim();
  if (!text && !photo) throw new Error('Escribe algo o elige una foto');

  let imagePath: string | null = null;
  if (photo) {
    const { contentType, extension } = imageType(photo);
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    await uploadPickedFile({ bucket: 'moments', path, uri: photo.uri, contentType, failure: 'No pudimos subir la foto. Inténtalo otra vez.' });
    imagePath = path;
  }

  const { error } = await client.from('moments').insert({
    author_id: userId,
    body: text,
    image_path: imagePath,
    room_slug: roomSlug ?? null,
  });
  if (error) throw new Error('No pudimos publicar tu momento. Inténtalo otra vez.');
}

export async function toggleLike(momentId: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('toggle_moment_like', { p_moment: momentId });
  if (error) throw error;
  return Boolean(data);
}

export async function getComments(momentId: string): Promise<MomentComment[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('moment_comments').select('*').eq('moment_id', momentId).order('created_at');
  if (error) throw error;
  return (data ?? []) as MomentComment[];
}

export async function addComment(momentId: string, body: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('add_moment_comment', { p_moment: momentId, p_body: body });
  if (error) throw error;
}

export async function deleteMoment(momentId: string, imagePath: string | null) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  if (imagePath) await client.storage.from('moments').remove([imagePath]).catch(() => undefined);
  const { error } = await client.from('moments').delete().eq('id', momentId);
  if (error) throw error;
}
