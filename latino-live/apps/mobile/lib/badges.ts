/**
 * Las insignias de rol que acompañan al nombre en la sala y en el perfil.
 * Cada una es el arte que entregó el dueño; el servidor decide cuál se usa.
 */

export type BadgeKind = 'owner' | 'super-admin' | 'agency' | 'official' | 'host' | 'cs';

export const BADGE_ART: Record<BadgeKind, { source: number; label: string; ratio: number }> = {
  owner: { source: require('@/assets/roles/owner.webp'), label: 'Dueño', ratio: 480 / 180 },
  'super-admin': { source: require('@/assets/roles/super-admin.webp'), label: 'Super Admin', ratio: 520 / 230 },
  agency: { source: require('@/assets/roles/agency.webp'), label: 'Agencia', ratio: 520 / 230 },
  official: { source: require('@/assets/roles/official.webp'), label: 'Oficial', ratio: 480 / 264 },
  host: { source: require('@/assets/roles/host.webp'), label: 'Host', ratio: 520 / 230 },
  cs: { source: require('@/assets/roles/cs.webp'), label: 'Atención al cliente', ratio: 520 / 230 },
};

/** The badges an owner can hand out by hand; the rest follow from a role. */
export const ASSIGNABLE_BADGES: { kind: 'agency' | 'official' | 'cs'; label: string; hint: string }[] = [
  { kind: 'agency', label: 'Agencia', hint: 'Representa a una agencia de la casa' },
  { kind: 'official', label: 'Oficial', hint: 'Cuenta oficial de Latino Live' },
  { kind: 'cs', label: 'Atención al cliente', hint: 'Ayuda a las personas en la app' },
];

export function isBadgeKind(value: string | null | undefined): value is BadgeKind {
  return Boolean(value) && value! in BADGE_ART;
}

/**
 * La insignia que debe verse, si el servidor no la mandó ya. Se usa en las
 * pantallas que solo tienen la ficha del perfil.
 */
export function badgeFor(profile: { badge?: string | null; id?: string | null } | null | undefined, hostId?: string | null): BadgeKind | null {
  if (!profile) return null;
  if (isBadgeKind(profile.badge)) return profile.badge;
  if (hostId && profile.id && hostId === profile.id) return 'host';
  return null;
}
