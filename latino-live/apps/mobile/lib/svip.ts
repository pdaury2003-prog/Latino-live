/**
 * The four SVIP looks. Every level has its own animated frame, medal, profile
 * background and room entrance colour, so a person can be recognised from the
 * seat grid alone.
 */
export type SvipTheme = {
  level: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  name: string;
  tagline: string;
  /** Profile background picture shipped with the app. */
  art: number;
  /** Avatar frame sprite used by this level. */
  frame: string;
  /** Colours of the ring, in the order the light travels around it. */
  ring: [string, string, string];
  /** Profile background, from the top of the screen to the bottom. */
  background: [string, string, string];
  accent: string;
  /** Text that sits on top of the accent colour. */
  onAccent: string;
};

export const SVIP_LEVELS: SvipTheme[] = [
  {
    level: 1,
    name: 'SVIP 1 · Imperial esmeralda',
    tagline: 'Esmeralda y oro',
    art: require('@/assets/svip/svip1.jpg'),
    frame: 'corona',
    ring: ['#8FE08A', '#1E8A46', '#FFE39A'],
    background: ['#0C2B1E', '#0A1E16', '#080D0B'],
    accent: '#3FAF6A',
    onAccent: '#04241A',
  },
  {
    level: 2,
    name: 'SVIP 2 · Imperial zafiro',
    tagline: 'Zafiro y plata',
    art: require('@/assets/svip/svip2.jpg'),
    frame: 'leon-real',
    ring: ['#BFD8EA', '#3E6FB5', '#EAE3C4'],
    background: ['#101B2E', '#0B1421', '#07090C'],
    accent: '#6C9AC8',
    onAccent: '#06131F',
  },
  {
    level: 3,
    name: 'SVIP 3 · Imperial amatista',
    tagline: 'Amatista y oro',
    art: require('@/assets/svip/svip3.jpg'),
    frame: 'rubi',
    ring: ['#C79BF5', '#6E2FA8', '#F0D8FF'],
    background: ['#1B1030', '#120A20', '#08060C'],
    accent: '#9A5BD8',
    onAccent: '#F4E7FF',
  },
  {
    level: 4,
    name: 'SVIP 4 · Fénix dorado',
    tagline: 'Llamas y oro',
    art: require('@/assets/svip/svip4.jpg'),
    frame: 'fenix-oro',
    ring: ['#FFD08A', '#E0452F', '#FFEFC6'],
    background: ['#33220C', '#1F1508', '#0A0908'],
    accent: '#F0752F',
    onAccent: '#2A0F02',
  },
  {
    level: 5,
    name: 'SVIP 5 · Dragón esmeralda',
    tagline: 'Jade y oro',
    art: require('@/assets/svip/svip3.jpg'),
    frame: 'jade',
    ring: ['#8CE8B8', '#1F8A5A', '#D8F5C0'],
    background: ['#0C2B22', '#0A1D18', '#080D0B'],
    accent: '#46C98A',
    onAccent: '#04241A',
  },
  {
    level: 6,
    name: 'SVIP 6 · Guardián de oro',
    tagline: 'Oro antiguo',
    art: require('@/assets/svip/svip4.jpg'),
    frame: 'corona',
    ring: ['#FFE39A', '#B8862B', '#FFF6D8'],
    background: ['#2A1E08', '#171107', '#0A0908'],
    accent: '#D9AE52',
    onAccent: '#2A1B03',
  },
  {
    level: 7,
    name: 'SVIP 7 · Tormenta zafiro',
    tagline: 'Azul profundo',
    art: require('@/assets/svip/svip2.jpg'),
    frame: 'leon-real',
    ring: ['#9FD4FF', '#2F5FA8', '#E4F4FF'],
    background: ['#0B1B32', '#081324', '#06080D'],
    accent: '#5B8FD6',
    onAccent: '#06121F',
  },
  {
    level: 8,
    name: 'SVIP 8 · Dragón esmeralda',
    tagline: 'Jade antiguo',
    art: require('@/assets/svip/svip3.jpg'),
    frame: 'jade',
    ring: ['#B6F2CE', '#16764A', '#EAFBF1'],
    background: ['#08251A', '#061913', '#050B08'],
    accent: '#3FBF83',
    onAccent: '#04241A',
  },
  {
    level: 9,
    name: 'SVIP 9 · Fénix carmesí',
    tagline: 'Fuego profundo',
    art: require('@/assets/svip/svip1.jpg'),
    frame: 'fenix-oro',
    ring: ['#FFB28A', '#B3201F', '#FFE6D2'],
    background: ['#2A0A0A', '#190707', '#0A0908'],
    accent: '#D94A3C',
    onAccent: '#2A0805',
  },
  {
    level: 10,
    name: 'SVIP 10 · Imperial corona',
    tagline: 'Oro y rubí legendario',
    art: require('@/assets/svip/svip4.jpg'),
    frame: 'corona',
    ring: ['#FFE9A8', '#C6941F', '#FFFDF0'],
    background: ['#2E2206', '#1A1304', '#0A0908'],
    accent: '#E8C158',
    onAccent: '#241A03',
  },
];

export function svipTheme(level: number | null | undefined): SvipTheme | null {
  if (!level) return null;
  return SVIP_LEVELS.find(theme => theme.level === Math.round(level)) ?? null;
}

/** The look's own name, without the level in front: "Imperial esmeralda". */
export function svipStyleName(theme: SvipTheme | null | undefined): string {
  return theme ? theme.name.replace(/^SVIP \d+ · /, '') : '';
}

/** The pieces of an SVIP pack a person can show or hide. */
export const SVIP_PIECES = [
  { key: 'emblem', label: 'Emblema' },
  { key: 'frame', label: 'Marco de avatar' },
  { key: 'banner', label: 'Banner de entrada' },
  { key: 'bubble', label: 'Burbuja de chat' },
  { key: 'mic', label: 'Ondas del micrófono' },
  { key: 'room', label: 'Fondo y tarjeta' },
] as const;

export type SvipPiece = (typeof SVIP_PIECES)[number]['key'];

export type SvipHolder = {
  svip_level?: number | null;
  svip_expires_at?: string | null;
  svip_show?: Record<string, boolean> | null;
};

/** Days of membership left, rounded up; 0 when it lapsed or never existed. */
export function svipDaysLeft(profile: SvipHolder | null | undefined): number {
  if (!profile?.svip_expires_at || !profile.svip_level) return 0;
  const left = new Date(profile.svip_expires_at).getTime() - Date.now();
  if (!Number.isFinite(left) || left <= 0) return 0;
  return Math.ceil(left / 86_400_000);
}

/**
 * The level that really applies right now: a lapsed pack stops working, so
 * the whole set disappears until the person renews it.
 */
export function liveSvipLevel(profile: SvipHolder | null | undefined): number {
  if (!profile?.svip_level) return 0;
  if (!profile.svip_expires_at) return 0;
  return svipDaysLeft(profile) > 0 ? Math.min(10, Math.max(0, Math.round(profile.svip_level))) : 0;
}

/** Whether one piece of the pack is shown. Pieces are on unless turned off. */
export function svipShows(profile: SvipHolder | null | undefined, piece: SvipPiece): boolean {
  if (liveSvipLevel(profile) < 1) return false;
  return profile?.svip_show?.[piece] !== false;
}

/** Clamps anything a phone might send to a real level. */
export function svipLevelOf(value: unknown): number {
  const level = Math.round(Number(value ?? 0));
  if (!Number.isFinite(level)) return 0;
  return Math.min(10, Math.max(0, level));
}

/**
 * The member card's colours. The card is a light parchment panel framed in
 * gold; its tint is the colour of the person's SVIP level, so a level 1 card
 * glows emerald and a level 10 one shines in gold.
 */
export type ProfileCardPalette = {
  light: string;
  mid: string;
  deep: string;
  /** Dark text on the light panel. */
  ink: string;
  mutedInk: string;
  /** Small gems on the frame. */
  gem: string;
  gold: string;
};

const GOLD_CARD: ProfileCardPalette = {
  light: '#F7E9C4',
  mid: '#E9D096',
  deep: '#C6A056',
  ink: '#3A2A08',
  mutedInk: 'rgba(58,42,8,0.66)',
  gem: '#46C98A',
  gold: '#F3C86A',
};

const CARDS: Record<number, ProfileCardPalette> = {
  1: { light: '#E9F8EC', mid: '#C6E8CE', deep: '#8CC79C', ink: '#0E3320', mutedInk: 'rgba(14,51,32,0.66)', gem: '#2E9E5B', gold: '#EFC978' },
  2: { light: '#EDF4FE', mid: '#C9DCF4', deep: '#94B5DF', ink: '#0D2138', mutedInk: 'rgba(13,33,56,0.66)', gem: '#3E6FB5', gold: '#EFC978' },
  3: { light: '#F5EDFC', mid: '#DCC6F0', deep: '#B393D8', ink: '#251038', mutedInk: 'rgba(37,16,56,0.66)', gem: '#7C3AA8', gold: '#EFC978' },
  4: { light: '#FDF0E3', mid: '#F7CFAF', deep: '#E0A379', ink: '#361302', mutedInk: 'rgba(54,19,2,0.66)', gem: '#D9542C', gold: '#EFC978' },
  5: { light: '#E7F7EE', mid: '#C2E5D2', deep: '#8FC7AD', ink: '#072A1C', mutedInk: 'rgba(7,42,28,0.66)', gem: '#2F9E6E', gold: '#EFC978' },
  6: GOLD_CARD,
  7: { light: '#EAF2FC', mid: '#C4D8EE', deep: '#8FAFCE', ink: '#0B1E33', mutedInk: 'rgba(11,30,51,0.66)', gem: '#2F5FA8', gold: '#EFC978' },
  8: { light: '#E9F8F0', mid: '#C4E7D5', deep: '#8CC6AC', ink: '#072C1E', mutedInk: 'rgba(7,44,30,0.66)', gem: '#16764A', gold: '#EFC978' },
  9: { light: '#FCEDEA', mid: '#F4C7BF', deep: '#DE958A', ink: '#360D08', mutedInk: 'rgba(54,13,8,0.66)', gem: '#B3201F', gold: '#EFC978' },
  10: { light: '#FCF1D2', mid: '#F0D695', deep: '#CFA94F', ink: '#382603', mutedInk: 'rgba(56,38,3,0.66)', gem: '#C6941F', gold: '#FFE9A8' },
};

export function profileCardPalette(level: number | null | undefined): ProfileCardPalette {
  const value = Math.round(Number(level ?? 0));
  return CARDS[value] ?? GOLD_CARD;
}
