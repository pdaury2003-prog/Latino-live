import { assetUrl } from '@/lib/asset-host';
import { getSupabase } from '@/lib/supabase';
import { imageType } from '@/lib/pick-photo';
import { uploadPickedFile } from '@/lib/upload';
import type { AgencyMember } from '@/lib/agency-meta';

export { metaBreakdown, metaProgress } from '@/lib/agency-meta';
export type { AgencyMember } from '@/lib/agency-meta';

/**
 * El panel de una agencia. El servidor decide quién lo ve: la persona que el
 * dueno marco con la insignia de Agencia, y su gente. Aquí solo se llama.
 */

export type AgencyInfo = {
  id: string;
  name: string;
  photo_url: string | null;
  owner_id: string;
};

export type AgencyDashboard = {
  role: 'manager' | 'member' | null;
  agency: AgencyInfo | null;
  members: AgencyMember[];
  totals: { members: number; month_diamonds: number };
};

export type AgencyCandidate = {
  id: string;
  display_name: string;
  user_number: number | null;
  avatar_url: string | null;
  level: number;
  agency_name: string | null;
};

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cuentas no disponibles');
  return supabase;
}

export async function agencyDashboard(): Promise<AgencyDashboard> {
  const { data, error } = await client().rpc('agency_dashboard');
  if (error) throw new Error(error.message);
  const value = data as AgencyDashboard | null;
  return value ?? { role: null, agency: null, members: [], totals: { members: 0, month_diamonds: 0 } };
}

/** Guarda nombre y logo; la primera vez crea la agencia. */
export async function saveAgency(name: string, photoUrl: string | null): Promise<void> {
  const { error } = await client().rpc('agency_save', { p_name: name.trim(), p_photo: photoUrl });
  if (error) throw new Error(error.message);
}

export async function lookUpPeople(query: string): Promise<AgencyCandidate[]> {
  if (query.trim().length < 2) return [];
  const { data, error } = await client().rpc('agency_lookup', { p_query: query.trim() });
  if (error) throw new Error(error.message);
  return (data ?? []) as AgencyCandidate[];
}

export async function addAgencyMember(userId: string): Promise<void> {
  const { error } = await client().rpc('agency_add_member', { p_user: userId });
  if (error) throw new Error(error.message);
}

export async function removeAgencyMember(userId: string): Promise<void> {
  const { error } = await client().rpc('agency_remove_member', { p_user: userId });
  if (error) throw new Error(error.message);
}

export async function leaveAgency(): Promise<void> {
  const { error } = await client().rpc('agency_leave');
  if (error) throw new Error(error.message);
}

/** Sube el logo de la agencia a su propia carpeta y devuelve su dirección. */
export async function uploadAgencyPhoto(agencyId: string, photo: { uri: string; mimeType?: string | null; fileName?: string | null }): Promise<string> {
  const supabase = client();
  const { contentType, extension } = imageType(photo);
  const path = `${agencyId}/logo-${Date.now()}.${extension}`;
  await uploadPickedFile({ bucket: 'agency-media', path, uri: photo.uri, contentType, upsert: true, failure: 'No pudimos subir el logo' });
  return assetUrl(supabase.storage.from('agency-media').getPublicUrl(path).data.publicUrl);
}

