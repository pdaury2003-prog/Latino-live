import type { CSSProperties } from "react";

type Props = {
  rank: number;
  width: number;
  uri?: string | null;
  name: string;
};

/**
 * The TOP 1, 2 and 3 frames of the daily ranking. Each is a strip of twelve
 * pictures from the owner's animated bundle, played as a film so the wings'
 * fire moves; the room's photo sits inside the plaque's own opening.
 */
const FRAMES: Record<number, {
  strip: string;
  aspect: number;
  centerX: number;
  centerY: number;
  opening: number;
  openingY: number;
}> = {
  1: { strip: "/rank/top1-strip.webp", aspect: 358 / 191, centerX: 0.4986, centerY: 0.5052, opening: 0.1508, openingY: 0.2513 },
  2: { strip: "/rank/top2-strip.webp", aspect: 358 / 318, centerX: 0.4972, centerY: 0.5079, opening: 0.2486, openingY: 0.2579 },
  3: { strip: "/rank/top3-strip.webp", aspect: 358 / 318, centerX: 0.4958, centerY: 0.4969, opening: 0.2793, openingY: 0.2799 },
};

export function RankFrame({ rank, width, uri, name }: Props) {
  const frame = FRAMES[rank] ?? FRAMES[1];
  const height = width / frame.aspect;
  const photo = Math.min(width * frame.opening, height * frame.openingY);
  const style = { width, height } as CSSProperties;

  return (
    <div className="rank-frame" style={style}>
      <div
        className="absolute rounded-full bg-muted"
        style={{
          left: width * frame.centerX - photo / 2,
          top: height * frame.centerY - photo / 2,
          width: photo,
          height: photo,
          overflow: "hidden",
        }}>
        {uri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={uri} alt={name} className="h-full w-full object-cover" />
        ) : (
          <span className="grid h-full w-full place-items-center text-[11px] font-semibold text-foreground">
            {(name || "?").trim().slice(0, 1).toUpperCase()}
          </span>
        )}
      </div>
      {/* Twelve pictures in one strip; the background steps through them. */}
      <div
        aria-hidden
        className="rank-strip"
        style={{ backgroundImage: `url(${frame.strip})` }}
      />
    </div>
  );
}
