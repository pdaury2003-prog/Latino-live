/**
 * The TOP 1, 2 and 3 frames of the daily ranking, cut from the animated
 * bundles the owner supplied. Each one is a wide plaque with a round opening
 * kept for the person's photo, so the opening's place and size travel with it.
 */
export type RankFrame = {
  rank: 1 | 2 | 3;
  /** Still picture, used while the animation has not started. */
  art: number;
  /** Twelve frames in a single row, cut from the animated bundle. */
  strip: number;
  /** The strip's frame count and its share of the strip's width per frame. */
  frames: number;
  frameWidth: number;
  /** Width divided by height of the picture. */
  aspect: number;
  /** Opening centre, as a share of the picture's width. */
  centerX: number;
  /** Opening centre, as a share of the picture's height. */
  centerY: number;
  /** Opening diameter as a share of the picture's width. */
  opening: number;
  /** Opening height as a share of the picture's height. */
  openingY: number;
};

export const RANK_FRAMES: RankFrame[] = [
  {
    rank: 1,
    art: require('@/assets/rank/top1.png'),
    strip: require('@/assets/rank/top1-strip.webp'),
    frames: 12,
    frameWidth: 358,
    aspect: 358 / 191,
    centerX: 0.4986,
    centerY: 0.5052,
    opening: 0.1508,
    openingY: 0.2513,
  },
  {
    rank: 2,
    art: require('@/assets/rank/top2.png'),
    strip: require('@/assets/rank/top2-strip.webp'),
    frames: 12,
    frameWidth: 358,
    aspect: 358 / 318,
    centerX: 0.4972,
    centerY: 0.5079,
    opening: 0.2486,
    openingY: 0.2579,
  },
  {
    rank: 3,
    art: require('@/assets/rank/top3.png'),
    strip: require('@/assets/rank/top3-strip.webp'),
    frames: 12,
    frameWidth: 358,
    aspect: 358 / 318,
    centerX: 0.4958,
    centerY: 0.4969,
    opening: 0.2793,
    openingY: 0.2799,
  },
];

export function rankFrame(rank: number): RankFrame | null {
  return RANK_FRAMES.find(item => item.rank === rank) ?? null;
}
