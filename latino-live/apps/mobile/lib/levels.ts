/**
 * Level colours of the app: eight bands, from the first nights to the elders
 * of the rooms. Every band carries two colours so the plaque keeps a gradient.
 */
export type LevelBand = {
  /** First level of the band, inclusive. */
  from: number;
  name: string;
  colors: [string, string];
  /** Text drawn on top of the plaque. */
  ink: string;
};

export const LEVEL_BANDS: LevelBand[] = [
  { from: 0, name: 'Azul', colors: ['#3E7FC4', '#79B4F0'], ink: '#F2F8FF' },
  { from: 4, name: 'Turquesa', colors: ['#1F8AA8', '#4FC9DA'], ink: '#F0FEFF' },
  { from: 12, name: 'Violeta', colors: ['#6D45C9', '#A98CF5'], ink: '#F7F2FF' },
  { from: 24, name: 'Magenta', colors: ['#A8399F', '#DD77D6'], ink: '#FFF2FD' },
  { from: 36, name: 'Rosa', colors: ['#C03A62', '#F0889F'], ink: '#FFF3F6' },
  { from: 48, name: 'Lila', colors: ['#7E6BD8', '#C2B4FF'], ink: '#F8F6FF' },
  { from: 60, name: 'Menta', colors: ['#2F9E8C', '#7FE3CB'], ink: '#F2FFFB' },
  { from: 70, name: 'Oro', colors: ['#B9822F', '#F5D79A'], ink: '#2A1B05' },
];

export function levelBand(level: number | null | undefined): LevelBand {
  const value = Math.max(0, Math.round(Number(level ?? 0)));
  let band = LEVEL_BANDS[0];
  for (const candidate of LEVEL_BANDS) {
    if (value >= candidate.from) band = candidate;
  }
  return band;
}

/** How far the person is inside their band, for the small progress ring. */
export function bandProgress(level: number | null | undefined): number {
  const value = Math.max(0, Math.round(Number(level ?? 0)));
  const index = LEVEL_BANDS.reduce((found, band, at) => (value >= band.from ? at : found), 0);
  const next = LEVEL_BANDS[index + 1];
  if (!next) return 1;
  const start = LEVEL_BANDS[index].from;
  return Math.min(1, Math.max(0, (value - start) / (next.from - start)));
}

/** Experience the account needs for a level, the same curve the server uses. */
export function xpForLevel(level: number): number {
  const safe = Math.max(1, Math.min(99, Math.round(level)));
  return Math.pow(safe - 1, 2) * 50;
}

/** Where the person stands between their level and the next one. */
export function xpProgress(xp: number | null | undefined, level: number | null | undefined) {
  const safeXp = Math.max(0, Math.round(Number(xp ?? 0)));
  const safeLevel = Math.max(1, Math.min(99, Math.round(Number(level ?? 1))));
  if (safeLevel >= 99) return { current: safeXp, target: safeXp, done: safeXp, share: 1, left: 0, top: true };
  const from = xpForLevel(safeLevel);
  const to = xpForLevel(safeLevel + 1);
  const target = to - from;
  const done = Math.min(target, Math.max(0, safeXp - from));
  return {
    current: safeXp,
    target,
    done,
    share: target > 0 ? done / target : 1,
    left: Math.max(0, to - safeXp),
    top: false,
  };
}
