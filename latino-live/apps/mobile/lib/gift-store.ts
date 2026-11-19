import { GIFT_ART } from '@/lib/gold';

/**
 * The gift shop that opens from the gift button of a room: featured groups of
 * the catalogue the app can actually deliver, with the art each one shows.
 */
export type RoomGift = {
  key: string;
  name: string;
  cost: number;
  /** The gift plays a full-room video when it is sent. */
  video?: boolean;
  /** Marked as recently added in the shop. */
  isNew?: boolean;
  tabs: GiftTab[];
  tags: GiftTag[];
};

export type GiftTab = 'caliente' | 'actividad' | 'diversion' | 'vuelo';
export type GiftTag = 'cofre' | 'identidad' | 'gloria' | 'confesion';

export const GIFT_TABS: { key: GiftTab; label: string }[] = [
  { key: 'caliente', label: 'Caliente' },
  { key: 'actividad', label: 'Actividad' },
  { key: 'diversion', label: 'Diversión' },
  { key: 'vuelo', label: 'En vuelo' },
];

export const GIFT_TAGS: { key: GiftTag | 'todo'; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'cofre', label: 'Cofre del tesoro' },
  { key: 'identidad', label: 'Identidad' },
  { key: 'gloria', label: 'Gloria' },
  { key: 'confesion', label: 'Confesión' },
];

/** The bundles the shop offers, in the order the sheet shows them. */
export const GIFT_QUANTITIES = [1, 10, 99, 188, 999];

export const ROOM_GIFTS: RoomGift[] = [
  { key: 'tigre', name: 'Tigre de fuego', cost: 300, video: true, isNew: true, tabs: ['caliente', 'vuelo'], tags: ['confesion'] },
  { key: 'demonio', name: 'Demonio de fuego', cost: 800, video: true, tabs: ['caliente', 'vuelo'], tags: ['confesion'] },
  { key: 'corona', name: 'Corona', cost: 10, tabs: ['actividad', 'diversion'], tags: ['identidad', 'gloria'] },
  { key: 'dragon', name: 'Dragón', cost: 50, tabs: ['caliente', 'diversion', 'vuelo'], tags: ['gloria'] },
  { key: 'leon', name: 'León', cost: 100, tabs: ['actividad', 'diversion'], tags: ['gloria'] },
  { key: 'fenix', name: 'Fénix', cost: 200, isNew: true, tabs: ['caliente', 'diversion'], tags: ['gloria'] },
  { key: 'trono', name: 'Trono SVIP', cost: 500, tabs: ['actividad'], tags: ['identidad', 'cofre'] },
];

/** The picture of a gift. */
export function giftArt(key: string): number | null {
  if (key === 'tigre') return require('@/assets/gifts/tigre.jpg');
  if (key === 'demonio') return require('@/assets/gifts/demonio.jpg');
  return GIFT_ART[key] ?? null;
}

/** The gifts of one group and one tag, in catalogue order. */
export function giftsFor(tab: GiftTab | 'todo', tag: GiftTag | 'todo'): RoomGift[] {
  return ROOM_GIFTS.filter(gift => {
    if (tab !== 'todo' && !gift.tabs.includes(tab)) return false;
    if (tag !== 'todo' && !gift.tags.includes(tag)) return false;
    return true;
  });
}
