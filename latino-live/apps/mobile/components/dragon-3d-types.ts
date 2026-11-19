import type { SeatBox } from "@/lib/dragon-stage";

/** What the room asks the dragon's layer to do, whichever host draws it. */
export type Dragon3DHandle = {
  play: (box: SeatBox, clip: string) => void;
  pair: (left: SeatBox, right: SeatBox) => void;
};
