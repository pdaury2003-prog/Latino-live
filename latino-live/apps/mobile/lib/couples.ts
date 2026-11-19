import { getSupabase } from './supabase';

/**
 * Couples (CP): one link per person, shown on both profiles with the two
 * faces together. The server holds the truth (one row per pair, answered by
 * the person who was asked); this module only speaks its language.
 */
export type Couple = {
  partnerId: string;
  partnerName: string;
  partnerAvatar: string | null;
  status: 'pending' | 'active';
  /** True when the other person asked and this one has to answer. */
  incoming: boolean;
};

export async function readCouple(): Promise<Couple | null> {
  const client = getSupabase();
  if (!client) return null;
  const { data, error } = await client.rpc('my_couple');
  if (error) return null;
  const rows = data as
    | { partner_id?: string; partner_name?: string; partner_avatar?: string | null; status?: string; incoming?: boolean }[]
    | null;
  const row = rows?.[0];
  if (!row?.partner_id) return null;
  return {
    partnerId: row.partner_id,
    partnerName: row.partner_name ?? 'Alguien',
    partnerAvatar: row.partner_avatar ?? null,
    status: row.status === 'active' ? 'active' : 'pending',
    incoming: Boolean(row.incoming),
  };
}

function message(cause: unknown) {
  const text = cause instanceof Error ? cause.message : '';
  if (/ya tiene pareja|ya tienes una pareja/i.test(text)) return text;
  if (/Elige a otra persona/i.test(text)) return 'Elige a otra persona.';
  if (/ya fue respondida|ya no existe/i.test(text)) return 'Esa solicitud ya no está disponible.';
  return 'No pudimos completar la solicitud.';
}

export async function askCouple(otherId: string): Promise<Couple | null> {
  const client = getSupabase();
  if (!client) throw new Error('Inicia sesión para pedir pareja.');
  const { error } = await client.rpc('request_couple', { p_other: otherId });
  if (error) throw new Error(message(error));
  return readCouple();
}

export async function answerCouple(otherId: string, accept: boolean): Promise<Couple | null> {
  const client = getSupabase();
  if (!client) throw new Error('Inicia sesión para responder.');
  const { error } = await client.rpc('answer_couple', { p_other: otherId, p_accept: accept });
  if (error) throw new Error(message(error));
  return readCouple();
}

export async function endCouple(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client.rpc('end_couple');
  if (error) throw new Error(message(error));
}
