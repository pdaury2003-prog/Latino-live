/**
 * The SVIP kit: the art that comes with each level.
 *
 * Every level was drawn on one sheet with nine pieces on it: a background for
 * the profile and the room, a tall frame for the entrance to the room, the
 * crest with the animal head, the ring that goes around a photo, the winged
 * name banner, the button panel, the small nameplate, the room card and a
 * thin ring. They were cut apart and each level keeps its own colours.
 */

export type SvipKit = {
  level: number;
  /** Name of the animal and the colour of the level. */
  title: string;
  /** Background of the profile and of the room. */
  background: number;
  /** The tall frame shown when the person enters a room. */
  entry: number;
  /** The crest with the animal head and the level. */
  emblem: number;
  /** The ring that goes around the photo. */
  avatar: number;
  /** The wide winged banner that carries the name. */
  banner: number;
  /** The button panel with the roses. */
  panel: number;
  /** The small plate that carries the level. */
  plate: number;
  /** The card of the room. */
  card: number;
  /** A thin ring of light. */
  ring: number;
  /** Where the photo goes inside the avatar ring. */
  opening: { diameter: number; cx: number; cy: number; aspect: number };
  /** The colour of the level: the button, the panel and the ring of light. */
  accent: string;
  /** The deeper colour of the same, used behind the photo. */
  face: string;
  /** The gold edge of the panels. */
  edge: string;
  /** The light that lives around the level. */
  halo: string;
  /** The text on top of the level's colour. */
  ink: string;
};

const GOLD_EDGE = '#F3C86A';

export const SVIP_KITS: SvipKit[] = [
  {
    level: 1,
    title: 'Guardián esmeralda',
    background: require('@/assets/svip/kit1/background.webp'),
    entry: require('@/assets/svip/kit1/entry.webp'),
    emblem: require('@/assets/svip/kit1/emblem.webp'),
    avatar: require('@/assets/svip/kit1/avatar.webp'),
    banner: require('@/assets/svip/kit1/banner.webp'),
    panel: require('@/assets/svip/kit1/panel.webp'),
    plate: require('@/assets/svip/kit1/plate.webp'),
    card: require('@/assets/svip/kit1/card.webp'),
    ring: require('@/assets/svip/kit1/ring.webp'),
    opening: { diameter: 0.4156, cx: 0.5047, cy: 0.5284, aspect: 1.0877 },
    accent: '#2FBE1E',
    face: '#0C3A12',
    edge: GOLD_EDGE,
    halo: '#7CFF6B',
    ink: '#F3FFF1',
  },
  {
    level: 2,
    title: 'Ciervo de plata',
    background: require('@/assets/svip/kit2/background.webp'),
    entry: require('@/assets/svip/kit2/entry.webp'),
    emblem: require('@/assets/svip/kit2/emblem.webp'),
    avatar: require('@/assets/svip/kit2/avatar.webp'),
    banner: require('@/assets/svip/kit2/banner.webp'),
    panel: require('@/assets/svip/kit2/panel.webp'),
    plate: require('@/assets/svip/kit2/plate.webp'),
    card: require('@/assets/svip/kit2/card.webp'),
    ring: require('@/assets/svip/kit2/ring.webp'),
    opening: { diameter: 0.5167, cx: 0.5004, cy: 0.502, aspect: 1.0243 },
    accent: '#6FA8B5',
    face: '#123038',
    edge: '#E4EAEF',
    halo: '#A8E4EE',
    ink: '#F1FDFF',
  },
  {
    level: 3,
    title: 'Leopardo violeta',
    background: require('@/assets/svip/kit3/background.webp'),
    entry: require('@/assets/svip/kit3/entry.webp'),
    emblem: require('@/assets/svip/kit3/emblem.webp'),
    avatar: require('@/assets/svip/kit3/avatar.webp'),
    banner: require('@/assets/svip/kit3/banner.webp'),
    panel: require('@/assets/svip/kit3/panel.webp'),
    plate: require('@/assets/svip/kit3/plate.webp'),
    card: require('@/assets/svip/kit3/card.webp'),
    ring: require('@/assets/svip/kit3/ring.webp'),
    opening: { diameter: 0.4196, cx: 0.4998, cy: 0.4866, aspect: 1.0662 },
    accent: '#7114AF',
    face: '#2A0B44',
    edge: GOLD_EDGE,
    halo: '#C08CFF',
    ink: '#FBF2FF',
  },
  {
    level: 4,
    title: 'Fénix carmesí',
    background: require('@/assets/svip/kit4/background.webp'),
    entry: require('@/assets/svip/kit4/entry.webp'),
    emblem: require('@/assets/svip/kit4/emblem.webp'),
    avatar: require('@/assets/svip/kit4/avatar.webp'),
    banner: require('@/assets/svip/kit4/banner.webp'),
    panel: require('@/assets/svip/kit4/panel.webp'),
    plate: require('@/assets/svip/kit4/plate.webp'),
    card: require('@/assets/svip/kit4/card.webp'),
    ring: require('@/assets/svip/kit4/ring.webp'),
    opening: { diameter: 0.4026, cx: 0.4995, cy: 0.5291, aspect: 1.0799 },
    accent: '#AA1320',
    face: '#3E0810',
    edge: '#FFD98C',
    halo: '#FF8090',
    ink: '#FFF0F2',
  },
  {
    level: 5,
    title: 'Búho de jade',
    background: require('@/assets/svip/kit5/background.webp'),
    entry: require('@/assets/svip/kit5/entry.webp'),
    emblem: require('@/assets/svip/kit5/emblem.webp'),
    avatar: require('@/assets/svip/kit5/avatar.webp'),
    banner: require('@/assets/svip/kit5/banner.webp'),
    panel: require('@/assets/svip/kit5/panel.webp'),
    plate: require('@/assets/svip/kit5/plate.webp'),
    card: require('@/assets/svip/kit5/card.webp'),
    ring: require('@/assets/svip/kit5/ring.webp'),
    opening: { diameter: 0.497, cx: 0.5063, cy: 0.515, aspect: 1.0183 },
    accent: '#8FA82F',
    face: '#2A3310',
    edge: GOLD_EDGE,
    halo: '#DCF065',
    ink: '#FBFFE8',
  },
  {
    level: 6,
    title: 'Tigre de zafiro',
    background: require('@/assets/svip/kit6/background.webp'),
    entry: require('@/assets/svip/kit6/entry.webp'),
    emblem: require('@/assets/svip/kit6/emblem.webp'),
    avatar: require('@/assets/svip/kit6/avatar.webp'),
    banner: require('@/assets/svip/kit6/banner.webp'),
    panel: require('@/assets/svip/kit6/panel.webp'),
    plate: require('@/assets/svip/kit6/plate.webp'),
    card: require('@/assets/svip/kit6/card.webp'),
    ring: require('@/assets/svip/kit6/ring.webp'),
    opening: { diameter: 0.481, cx: 0.4968, cy: 0.4841, aspect: 1.0665 },
    accent: '#134ABB',
    face: '#0A1E44',
    edge: GOLD_EDGE,
    halo: '#7FB2FF',
    ink: '#F0F6FF',
  },
  {
    level: 7,
    title: 'León de púrpura',
    background: require('@/assets/svip/kit7/background.webp'),
    entry: require('@/assets/svip/kit7/entry.webp'),
    emblem: require('@/assets/svip/kit7/emblem.webp'),
    avatar: require('@/assets/svip/kit7/avatar.webp'),
    banner: require('@/assets/svip/kit7/banner.webp'),
    panel: require('@/assets/svip/kit7/panel.webp'),
    plate: require('@/assets/svip/kit7/plate.webp'),
    card: require('@/assets/svip/kit7/card.webp'),
    ring: require('@/assets/svip/kit7/ring.webp'),
    opening: { diameter: 0.4593, cx: 0.5008, cy: 0.5203, aspect: 1.0945 },
    accent: '#8B27B8',
    face: '#2E0A3A',
    edge: GOLD_EDGE,
    halo: '#E08CFF',
    ink: '#FCF0FF',
  },
  {
    level: 8,
    title: 'Caballo de rubí',
    background: require('@/assets/svip/kit8/background.webp'),
    entry: require('@/assets/svip/kit8/entry.webp'),
    emblem: require('@/assets/svip/kit8/emblem.webp'),
    avatar: require('@/assets/svip/kit8/avatar.webp'),
    banner: require('@/assets/svip/kit8/banner.webp'),
    panel: require('@/assets/svip/kit8/panel.webp'),
    plate: require('@/assets/svip/kit8/plate.webp'),
    card: require('@/assets/svip/kit8/card.webp'),
    ring: require('@/assets/svip/kit8/ring.webp'),
    opening: { diameter: 0.5031, cx: 0.5038, cy: 0.5105, aspect: 1.0307 },
    accent: '#C43C89',
    face: '#3E0C24',
    edge: GOLD_EDGE,
    halo: '#FF9DD0',
    ink: '#FFF0F8',
  },
];

/** The kit of a level, or null when the level has no sheet of its own. */
export function svipKit(level: number | null | undefined): SvipKit | null {
  const value = Math.round(Number(level ?? 0));
  // Only the level's own sheet counts: every sheet has its number drawn on the
  // crest, so lending level 4's art to level 9 would print "SVIP 4" on a
  // level 9 member.
  return SVIP_KITS.find(kit => kit.level === value) ?? null;
}

/** Whether a level wears the kit with its own art. */
export function wearsKit(level: number | null | undefined): boolean {
  return svipKit(level) !== null;
}

