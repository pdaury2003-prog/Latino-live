/**
 * Where the photo goes inside each gold frame.
 *
 * The frames are not square and their openings are not centred, so guessing
 * with a single ratio left faces cropped or floating over the metal. These
 * numbers were measured on the shipped PNGs: the empty circle's diameter as a
 * share of the frame's height, and its centre as a share of the frame's width
 * and height. `FramedAvatar` turns them into positions at any size.
 */
export type FrameFit = {
  /** Opening diameter, as a share of the frame height. */
  diameter: number;
  /** Opening centre, as a share of the frame width. */
  cx: number;
  /** Opening centre, as a share of the frame height. */
  cy: number;
  /** The art's own width as a share of its height. */
  aspect?: number;
};

export const FRAME_FIT: Record<string, FrameFit> = {
  // The frames of the shop: measured on the shipped art, hole by hole.
  corona: { diameter: 0.6917, cx: 0.499, cy: 0.5083, aspect: 1 },
  rubi: { diameter: 0.4542, cx: 0.501, cy: 0.4844, aspect: 1 },
  celest: { diameter: 0.5, cx: 0.5031, cy: 0.4927, aspect: 1 },
  'fenix-oro': { diameter: 0.5208, cx: 0.4969, cy: 0.5354, aspect: 1 },
  jade: { diameter: 0.6167, cx: 0.499, cy: 0.5146, aspect: 1 },
  'leon-real': { diameter: 0.575, cx: 0.5052, cy: 0.5125, aspect: 1 },
  neon: { diameter: 0.625, cx: 0.499, cy: 0.4615, aspect: 1 },
  roses: { diameter: 0.6188, cx: 0.4958, cy: 0.5104, aspect: 1 },
  // The frames the shop had before.
  aureo: { diameter: 0.5068, cx: 0.453, cy: 0.5089 },
  violeta: { diameter: 0.4913, cx: 0.4059, cy: 0.5182 },
  leon: { diameter: 0.4733, cx: 0.3735, cy: 0.5331 },
  esmeralda: { diameter: 0.5135, cx: 0.3898, cy: 0.5122 },
  fenix: { diameter: 0.4525, cx: 0.438, cy: 0.5497 },
};

/** The key a stored frame name uses (`frame:leon` or `leon`). */
export function frameKey(frame: string | null | undefined): string | null {
  if (!frame) return null;
  return frame.startsWith('frame:') ? frame.slice('frame:'.length) : frame;
}

export function frameFit(frame: string | null | undefined): FrameFit | null {
  const key = frameKey(frame);
  return key ? FRAME_FIT[key] ?? null : null;
}

/** The gold frames of the shop are drawn on a taller canvas than they are wide. */
export const FRAME_ART_ASPECT = 133 / 162;

export type FrameOpening = {
  /** Side of the circle the photo fills, in box units. */
  diameter: number;
  /** Centre of that circle inside the box, in box units. */
  cx: number;
  cy: number;
};

/**
 * The circle a photo occupies inside an avatar box. Frames with measurements
 * use their own opening, so the metal sits exactly on the photo's edge; a plain
 * avatar uses the whole box.
 */
export function frameOpening(size: number, frame?: string | null): FrameOpening {
  const fit = frameFit(frame);
  if (!fit) return { diameter: size, cx: size / 2, cy: size / 2 };
  const boxWidth = size * (fit.aspect ?? FRAME_ART_ASPECT);
  return {
    diameter: size * fit.diameter,
    cx: (size - boxWidth) / 2 + boxWidth * fit.cx,
    cy: size * fit.cy,
  };
}
