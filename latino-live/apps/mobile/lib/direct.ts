import { useCallback, useEffect, useRef } from 'react';
import { assetUrl } from '@/lib/asset-host';
import { getSupabase } from '@/lib/supabase';
import { uploadPickedFile } from '@/lib/upload';
import { imageType } from '@/lib/pick-photo';
import { keepLiveChannel } from '@/lib/live-channel';

export type Conversation = {
  partner_id: string;
  display_name: string;
  avatar_url: string | null;
  last_body: string;
  last_at: string;
  last_mine: boolean;
  unread: number;
};

export type DirectMessage = {
  id: number;
  sender_id: string;
  recipient_id: string;
  body: string;
  image_path: string | null;
  created_at: string;
  read_at: string | null;
};

export type DirectGift = {
  id: number;
  sender_id: string;
  recipient_id: string;
  gift_key: string;
  cost: number;
  created_at: string;
};

export const DIRECT_GIFTS = [
  { key: 'rosa', name: 'Rosa', cost: 1 },
  { key: 'fuego', name: 'Fuego', cost: 5 },
  { key: 'abrazo', name: 'Abrazo', cost: 10 },
  { key: 'corona', name: 'Corona', cost: 30 },
  { key: 'fiesta', name: 'Fiesta', cost: 50 },
  { key: 'cofre', name: 'Cofre', cost: 99 },
] as const;

export async function listConversations(): Promise<Conversation[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('direct_conversations');
  if (error) throw error;
  return ((data ?? []) as Conversation[]).map(row => ({ ...row, unread: Number(row.unread) }));
}

export async function listDirectMessages(partnerId: string): Promise<DirectMessage[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('direct_messages')
    .select('*')
    .or(`sender_id.eq.${partnerId},recipient_id.eq.${partnerId}`)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as DirectMessage[];
}

export async function sendDirectMessage(partnerId: string, body: string) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const me = (await client.auth.getUser()).data.user?.id;
  if (!me) throw new Error('Inicia sesión para escribir');
  const { error } = await client.from('direct_messages').insert({
    sender_id: me,
    recipient_id: partnerId,
    body: body.trim().slice(0, 1000),
  });
  if (error) {
    throw new Error(error.message.includes('row-level security')
      ? 'Solo puedes escribir a tus amigos. Síganse mutuamente para conversar.'
      : error.message);
  }
}

export async function markConversationRead(partnerId: string) {
  const client = getSupabase();
  if (!client) return;
  await client.rpc('mark_direct_read', { p_from: partnerId });
}

export function directPhotoUrl(path: string) {
  const client = getSupabase();
  if (!client) return '';
  return assetUrl(client.storage.from('direct-photos').getPublicUrl(path).data.publicUrl);
}

/** Uploads a photo for the thread and posts it as a message. */
export async function sendDirectPhoto(partnerId: string, photo: { uri: string; mimeType?: string | null; fileName?: string | null }, caption = '') {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const me = (await client.auth.getUser()).data.user?.id;
  if (!me) throw new Error('Inicia sesión para escribir');
  const { contentType, extension } = imageType(photo);
  const path = `${me}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${extension}`;
  await uploadPickedFile({ bucket: 'direct-photos', path, uri: photo.uri, contentType, failure: 'No pudimos subir la foto. Inténtalo otra vez.' });
  const { error } = await client.from('direct_messages').insert({
    sender_id: me,
    recipient_id: partnerId,
    body: caption.trim().slice(0, 1000),
    image_path: path,
  });
  if (error) throw new Error(error.message);
}

export async function listDirectGifts(partnerId: string): Promise<DirectGift[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from('direct_gifts')
    .select('*')
    .or(`sender_id.eq.${partnerId},recipient_id.eq.${partnerId}`)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as DirectGift[];
}

export async function sendDirectGift(partnerId: string, giftKey: string, cost: number) {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { error } = await client.rpc('send_direct_gift', { p_to: partnerId, p_gift: giftKey, p_cost: cost });
  if (error) throw new Error(error.message);
}

/** Re-reads the thread whenever the other person writes. */
export function useDirectLive(partnerId: string | null, onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callback.current(), 300);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  useEffect(() => {
    const client = getSupabase();
    if (!client || !partnerId) return;
    return keepLiveChannel(client, `direct:${partnerId}`, channel => channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, later)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'direct_messages' }, later)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_gifts' }, later),
    later);
  }, [partnerId, later]);
}

/** Unread totals for the Mensajes tab badge. */
export function useDirectInbox(onChange: () => void) {
  const callback = useRef(onChange);
  callback.current = onChange;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const later = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => callback.current(), 400);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    return keepLiveChannel(client, 'direct:inbox', channel => channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, later),
    later);
  }, [later]);
}
