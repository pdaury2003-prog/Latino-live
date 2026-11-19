"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createDragonStage, type DragonStage } from "@/lib/dragon-stage";

export type DragonHandle = {
  play: (seat: number | null, clip: string) => void;
  pair: (left: number, right: number) => void;
};

type Props = {
  /** The seat's box on the page, for the seat number it belongs to. */
  getSeatEl: (seat: number) => HTMLElement | null;
  onError?: (message: string) => void;
};

/**
 * The dragon's own layer: a transparent canvas above the room where the model
 * stands on a seat and acts one of its animations, never covering a tap.
 */
export const DragonEmotes = forwardRef<DragonHandle, Props>(function DragonEmotes(
  { getSeatEl, onError },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stage = useRef<DragonStage | null>(null);
  const mounted = useRef(true);
  const seatRef = useRef(getSeatEl);
  seatRef.current = getSeatEl;
  const errorRef = useRef(onError);
  errorRef.current = onError;

  // The model weighs a few megabytes and the canvas needs a graphics context, so
  // both wait for the first emote instead of loading with every room visit.
  const ensureStage = () => {
    if (stage.current) return stage.current;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const created = createDragonStage({
      canvas,
      getSeatEl: seat => seatRef.current(seat),
      onError: message => errorRef.current?.(message),
    });
    if (mounted.current) stage.current = created;
    else created.dispose();
    return created;
  };

  useImperativeHandle(ref, () => ({
    play: (seat, clip) => ensureStage()?.play(seat, clip),
    pair: (left, right) => ensureStage()?.pair(left, right),
  }), []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stage.current?.dispose();
      stage.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-40 h-full w-full"
    />
  );
});
