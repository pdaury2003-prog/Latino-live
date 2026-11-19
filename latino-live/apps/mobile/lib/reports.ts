import { getSupabase } from '@/lib/supabase';

/**
 * Denunciar a una persona desde su ficha. La denuncia llega al equipo, que la
 * revisa desde el panel; quien denuncia no vuelve a ver nada de ella.
 */
export type ReportReason = 'adult' | 'harass' | 'spam' | 'impersonate' | 'fraud' | 'other';

export const REPORT_REASONS: { key: ReportReason; label: string; hint: string }[] = [
  { key: 'adult', label: 'Contenido para adultos', hint: 'Fotos, video o palabras sexuales' },
  { key: 'harass', label: 'Acoso o insultos', hint: 'Amenazas, burlas o mensajes repetidos' },
  { key: 'spam', label: 'Spam o publicidad', hint: 'Vende cosas o llena el chat' },
  { key: 'impersonate', label: 'Se hace pasar por otra persona', hint: 'Usa el nombre o la foto de alguien' },
  { key: 'fraud', label: 'Estafa o pedir dinero', hint: 'Pide diamantes, pagos o datos' },
  { key: 'other', label: 'Otra cosa', hint: 'Cuéntalo con tus palabras' },
];

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cuentas no disponibles');
  return supabase;
}

export async function reportPerson(userId: string, reason: ReportReason, detail?: string, roomId?: string | null): Promise<void> {
  const { error } = await client().rpc('report_person', {
    p_user: userId,
    p_reason: reason,
    p_detail: detail?.trim() ? detail.trim() : null,
    p_room: roomId ?? null,
  });
  if (error) throw new Error(error.message);
}
