// The SVG-free gold look of Latino Live: transparent PNG sprites cut from the
// design board, each used where it belongs.

export type GoldFrameKey = 'rubi' | 'corona' | 'celest' | 'fenix-oro' | 'jade' | 'leon-real' | 'neon' | 'roses';

export type GoldFrame = {
  key: GoldFrameKey;
  name: string;
  note: string;
  art: number;
  /** The colour the light of this frame carries, used by its animation. */
  accent: string;
};

/** The frames in the shop. Each one breathes, sways and throws sparks. */
export const GOLD_FRAMES: GoldFrame[] = [
  { key: 'corona', name: 'Corona real', note: 'Oro fino y gemas azules', art: require('@/assets/gold/frame/frame-corona.webp'), accent: '#F2C14E' },
  { key: 'rubi', name: 'Corona de rubí', note: 'Rubí y alas violeta', art: require('@/assets/gold/frame/frame-rubi.webp'), accent: '#FF7A9C' },
  { key: 'celest', name: 'Alas celestiales', note: 'Plumas de cielo y hielo', art: require('@/assets/gold/frame/frame-celest.webp'), accent: '#8ED8FF' },
  { key: 'fenix-oro', name: 'Fénix de oro', note: 'Alas de fuego y gema ámbar', art: require('@/assets/gold/frame/frame-fenix-oro.webp'), accent: '#FFB347' },
  { key: 'jade', name: 'Alas de jade', note: 'Esmeralda, oro y marfil', art: require('@/assets/gold/frame/frame-jade.webp'), accent: '#5FE3C0' },
  { key: 'leon-real', name: 'León real', note: 'León alado con rubíes', art: require('@/assets/gold/frame/frame-leon-real.webp'), accent: '#7FA8FF' },
  { key: 'neon', name: 'Neón musical', note: 'Luces y notas de colores', art: require('@/assets/gold/frame/frame-neon.webp'), accent: '#FF6FD8' },
  { key: 'roses', name: 'Jardín de rosas', note: 'Rosas, perlas y corazón', art: require('@/assets/gold/frame/frame-roses.webp'), accent: '#FF9EC7' },
];

/** The frames the shop used before: the people who bought them keep them. */
export const LEGACY_FRAMES: { key: string; name: string; note: string; art: number; accent: string }[] = [
  { key: 'aureo', name: 'Corona áurea', note: 'Rubíes y oro real', art: require('@/assets/gold/frame/frame-aureo.png'), accent: '#FFC24B' },
  { key: 'violeta', name: 'Dragón amatista', note: 'Violeta y plata', art: require('@/assets/gold/frame/frame-violeta.png'), accent: '#C4A7FF' },
  { key: 'leon', name: 'León azul', note: 'Cristales de hielo', art: require('@/assets/gold/frame/frame-leon.png'), accent: '#8FD8FF' },
  { key: 'esmeralda', name: 'Dragón esmeralda', note: 'Jade y oro', art: require('@/assets/gold/frame/frame-esmeralda.png'), accent: '#6FE3B8' },
  { key: 'fenix', name: 'Fénix de fuego', note: 'Llamas rojas', art: require('@/assets/gold/frame/frame-fenix.png'), accent: '#FF8A5C' },
];

/** Every frame a person can wear: the new ones and the ones already bought. */
export const ALL_FRAMES: { key: string; name: string; note: string; art: number; accent: string }[] = [...GOLD_FRAMES, ...LEGACY_FRAMES];

export type RoomFrameKey = 'aureo' | 'violeta' | 'leon' | 'esmeralda' | 'fenix';

export const ROOM_FRAMES: Record<RoomFrameKey, number> = {
  aureo: require('@/assets/gold/roomframe/roomframe-aureo.png'),
  violeta: require('@/assets/gold/roomframe/roomframe-violeta.png'),
  leon: require('@/assets/gold/roomframe/roomframe-leon.png'),
  esmeralda: require('@/assets/gold/roomframe/roomframe-esmeralda.png'),
  fenix: require('@/assets/gold/roomframe/roomframe-fenix.png'),
};

/** Room card frame shown on the billboard, by the room's cover. */
export const ROOM_FRAME_BY_COVER = { palace: 'aureo', pool: 'leon', terrace: 'esmeralda' } as const;

export const SVIP_BADGES: Record<number, number> = {
  1: require('@/assets/gold/svip/svipbadge-svip1.png'),
  2: require('@/assets/gold/svip/svipbadge-svip2.png'),
  3: require('@/assets/gold/svip/svipbadge-svip3.png'),
  4: require('@/assets/gold/svip/svipbadge-svip4.png'),
  5: require('@/assets/gold/svip/svipbadge-svip5.png'),
};

export const ENTRY_CARDS: Record<number, number> = {
  1: require('@/assets/gold/entry/entry-svip1.png'),
  2: require('@/assets/gold/entry/entry-svip2.png'),
  3: require('@/assets/gold/entry/entry-svip3.png'),
  4: require('@/assets/gold/entry/entry-svip4.png'),
  5: require('@/assets/gold/entry/entry-svip5.png'),
};

export const USER_PLATES: Record<number, number> = {
  1: require('@/assets/gold/userplate/userplate-svip1.png'),
  2: require('@/assets/gold/userplate/userplate-svip2.png'),
  3: require('@/assets/gold/userplate/userplate-svip3.png'),
  4: require('@/assets/gold/userplate/userplate-svip4.png'),
  5: require('@/assets/gold/userplate/userplate-svip5.png'),
};

export const CREATOR_PLATES: Record<string, number> = {
  top: require('@/assets/gold/creator/creator-top.png'),
  svip2: require('@/assets/gold/creator/creator-svip2.png'),
  svip3: require('@/assets/gold/creator/creator-svip3.png'),
  svip4: require('@/assets/gold/creator/creator-svip4.png'),
  svip5: require('@/assets/gold/creator/creator-svip5.png'),
};

export const ACTION_ICONS = {
  like: require('@/assets/gold/icon/icon-like.png'),
  gift: require('@/assets/gold/icon/icon-gift.png'),
  comment: require('@/assets/gold/icon/icon-comment.png'),
  share: require('@/assets/gold/icon/icon-share.png'),
  follow: require('@/assets/gold/icon/icon-follow.png'),
  subscribe: require('@/assets/gold/icon/icon-subscribe.png'),
} as const;

export const GIFT_ART: Record<string, number> = {
  corona: require('@/assets/gold/gift/gift-corona.png'),
  dragon: require('@/assets/gold/gift/gift-dragon.png'),
  leon: require('@/assets/gold/gift/gift-leon.png'),
  fenix: require('@/assets/gold/gift/gift-fenix.png'),
  trono: require('@/assets/gold/gift/gift-trono.png'),
};

export function goldFrameArt(label: string | null | undefined): number | null {
  if (!label) return null;
  const found = ALL_FRAMES.find(frame => `frame:${frame.key}` === label || frame.key === label);
  return found?.art ?? null;
}

export function goldFrameName(label: string | null | undefined): string | null {
  if (!label) return null;
  const found = ALL_FRAMES.find(frame => `frame:${frame.key}` === label || frame.key === label);
  return found?.name ?? null;
}

/** Which SVIP level a person shows: 1..5, or 0 for none. */
export function badgeLevel(level: number | null | undefined): number {
  const value = Math.round(Number(level ?? 0));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(5, Math.max(1, value));
}
