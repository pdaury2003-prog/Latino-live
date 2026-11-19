/**
 * The SVIP Imperial kits, cut from the animated bundles the owner supplied.
 * Level 1 is the green and gold set; level 2 the silver and sapphire one.
 */
export type ImperialKit = {
  level: 1 | 2 | 3 | 10;
  name: string;
  /** Inner opening of the avatar frame, as a share of the square. */
  opening: number;
  /** Where that opening starts, from the top of the square. */
  openingTop: number;
  frame: number;
  frameGlow: number;
  /** Size of the seat ring relative to the seat, so its metal circles the photo. */
  seatRingScale: number;
  medal: number;
  tag: number;
  bubble: number;
  rose: number;
  /** Chat bubble colours: centre, gold edge and text. */
  face: string;
  faceEdge: string;
  ink: string;
  halo: string;
  notice: number;
  micWave: number;
  micRing: number;
  card: number;
  roomFrame: number;
};

export const IMPERIAL: ImperialKit[] = [
  {
    level: 1,
    name: 'Imperial esmeralda',
    opening: 0.3466,
    openingTop: 0.3267,
    frame: require('@/assets/svip/imperial/frame.png'),
    frameGlow: require('@/assets/svip/imperial/frame-glow.png'),
    seatRingScale: 1.30,
    medal: require('@/assets/svip/imperial/medal.png'),
    tag: require('@/assets/svip/imperial/tag.png'),
    bubble: require('@/assets/svip/imperial/bubble.png'),
    rose: require('@/assets/svip/imperial/bubble-rose.png'),
    face: '#128B3B',
    faceEdge: '#F3C86A',
    ink: '#F7FCEF',
    halo: '#3FAF6A',
    notice: require('@/assets/svip/imperial/bubble.png'),
    micWave: require('@/assets/svip/imperial/bubble-glow.png'),
    micRing: require('@/assets/svip/imperial/star.png'),
    card: require('@/assets/svip/imperial/frame.png'),
    roomFrame: require('@/assets/svip/imperial/frame.png'),
  },
  {
    level: 2,
    name: 'Imperial zafiro',
    opening: 0.3451,
    openingTop: 0.3275,
    frame: require('@/assets/svip/imperial2/frame.png'),
    frameGlow: require('@/assets/svip/imperial2/frame-glow.png'),
    seatRingScale: 1.30,
    medal: require('@/assets/svip/imperial2/medal.png'),
    tag: require('@/assets/svip/imperial2/tag.png'),
    bubble: require('@/assets/svip/imperial2/bubble.png'),
    rose: require('@/assets/svip/imperial2/bubble-rose.png'),
    face: '#7FB9A8',
    faceEdge: '#F3C86A',
    ink: '#F4FFFB',
    halo: '#8FD4C2',
    notice: require('@/assets/svip/imperial2/notice.png'),
    micWave: require('@/assets/svip/imperial2/mic-wave.png'),
    micRing: require('@/assets/svip/imperial2/mic-ring.png'),
    card: require('@/assets/svip/imperial2/card.png'),
    roomFrame: require('@/assets/svip/imperial2/room-frame.png'),
  },
  {
    level: 3,
    name: 'Imperial amatista',
    opening: 0.3234,
    openingTop: 0.3383,
    frame: require('@/assets/svip/imperial3/frame.png'),
    frameGlow: require('@/assets/svip/imperial3/frame-glow.png'),
    seatRingScale: 1.30,
    medal: require('@/assets/svip/imperial3/medal.png'),
    tag: require('@/assets/svip/imperial3/tag.png'),
    bubble: require('@/assets/svip/imperial3/bubble.png'),
    rose: require('@/assets/svip/imperial3/bubble-rose.png'),
    face: '#6E2FA8',
    faceEdge: '#F3C86A',
    ink: '#FBF3FF',
    halo: '#A868E0',
    notice: require('@/assets/svip/imperial3/notice.png'),
    micWave: require('@/assets/svip/imperial3/mic-wave.png'),
    micRing: require('@/assets/svip/imperial3/mic-ring.png'),
    card: require('@/assets/svip/imperial3/card.png'),
    roomFrame: require('@/assets/svip/imperial3/room-frame.png'),
  },
  {
    level: 10,
    name: 'Imperial corona',
    opening: 0.3234,
    openingTop: 0.3383,
    frame: require('@/assets/svip/imperial10/frame.png'),
    frameGlow: require('@/assets/svip/imperial10/frame-glow.png'),
    seatRingScale: 1.30,
    medal: require('@/assets/svip/imperial10/medal.png'),
    tag: require('@/assets/svip/imperial10/tag.png'),
    bubble: require('@/assets/svip/imperial10/bubble.png'),
    rose: require('@/assets/svip/imperial10/bubble-rose.png'),
    face: '#8A6A16',
    faceEdge: '#FFDE8A',
    ink: '#FFFCEF',
    halo: '#E8C158',
    notice: require('@/assets/svip/imperial10/notice.png'),
    micWave: require('@/assets/svip/imperial10/mic-wave.png'),
    micRing: require('@/assets/svip/imperial10/mic-ring.png'),
    card: require('@/assets/svip/imperial10/card.png'),
    roomFrame: require('@/assets/svip/imperial10/room-frame.png'),
  },
];

/** The kit a level wears, or null for levels drawn with the app's own art. */
export function imperialKit(level: number | null | undefined): ImperialKit | null {
  const value = Math.round(Number(level ?? 0));
  return IMPERIAL.find(kit => kit.level === value) ?? null;
}

export function wearsImperial(level: number | null | undefined): boolean {
  return imperialKit(level) !== null;
}
