/**
 * La meta de cada persona de una agencia. Vive aparte de las llamadas al
 * servidor para poder probar las cuentas sin red.
 */

export type AgencyMember = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  diamonds: number;
  is_manager: boolean;
  /** Diamantes que recibió en regalos desde el día 1 del mes. */
  month_diamonds: number;
  meta_level: number;
  meta_target: number;
  since: string;
};

/** Cuánto lleva de su meta del mes, de 0 a 1. */
export function metaProgress(member: Pick<AgencyMember, 'month_diamonds' | 'meta_target'>): number {
  if (!member.meta_target || member.meta_target <= 0) return 0;
  return Math.max(0, Math.min(1, member.month_diamonds / member.meta_target));
}

/** Cuánta gente está en cada meta, para el resumen de arriba. */
export function metaBreakdown(members: Pick<AgencyMember, 'meta_level'>[]): { level: number; people: number }[] {
  const counts = new Map<number, number>();
  for (const member of members) counts.set(member.meta_level, (counts.get(member.meta_level) ?? 0) + 1);
  return [...counts.entries()]
    .map(([level, people]) => ({ level, people }))
    .sort((a, b) => a.level - b.level);
}
