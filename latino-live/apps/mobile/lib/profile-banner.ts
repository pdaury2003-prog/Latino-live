import { Image } from 'react-native';

/**
 * The wide profile-card frames: wings that run past the card's edges with a
 * round opening in the middle for the photo.
 *
 * `cx` and `cy` are the opening's centre as a share of the artwork's width and
 * height, and `holeW` / `holeH` its size as a share of those. They were measured
 * on the shipped PNGs, so the photo sits inside the metal at any drawn size.
 * The artwork is always drawn across the whole card, corner to corner.
 */
export type ProfileBannerFit = {
  art: number;
  /** The artwork's real height as a share of its width. */
  aspect: number;
  cx: number;
  cy: number;
  /** The opening's width as a share of the artwork's width. */
  holeW: number;
  /** The opening's height as a share of the artwork's height. */
  holeH: number;
};

const HIVE = require('@/assets/svip/banner/banner-hielo.png');
const ICE = require('@/assets/svip/banner/banner-esmeralda.png');
const PURPLE = require('@/assets/svip/banner/banner-violeta.png');

/**
 * The artwork's real shape, read from the file the app ships. The numbers were
 * written by hand from these same files; reading them means a frame can never
 * be stretched if its art is replaced by one of another size.
 */
function shapeOf(art: number, written: number) {
  try {
    const source = Image.resolveAssetSource(art);
    if (source?.width && source?.height) return source.height / source.width;
  } catch {
    // La vista previa del navegador no siempre conoce el archivo.
  }
  return written;
}

const BANNERS: Record<'hielo' | 'esmeralda' | 'violeta', ProfileBannerFit> = {
  hielo: { art: HIVE, aspect: shapeOf(HIVE, 293 / 1078), cx: 0.5056, cy: 0.5853, holeW: 0.1289, holeH: 0.4983 },
  esmeralda: { art: ICE, aspect: shapeOf(ICE, 265 / 1078), cx: 0.5005, cy: 0.5736, holeW: 0.1187, holeH: 0.4415 },
  violeta: { art: PURPLE, aspect: shapeOf(PURPLE, 255 / 1078), cx: 0.4995, cy: 0.5039, holeW: 0.1262, holeH: 0.5176 },
};

/** The frame a level wears on its profile card. */
export function profileBanner(level: number | null | undefined): ProfileBannerFit | null {
  const safe = Math.round(level ?? 0);
  if (safe < 1) return null;
  if (safe >= 10) return BANNERS.esmeralda;
  const order = [BANNERS.esmeralda, BANNERS.hielo, BANNERS.violeta];
  return order[(safe - 1) % order.length];
}
