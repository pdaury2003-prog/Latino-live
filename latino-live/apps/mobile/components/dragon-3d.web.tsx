"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { Dragon3DHandle } from "@/components/dragon-3d-types";
import { createDragonStage, type DragonStage } from "@/lib/dragon-stage";

type Props = { onError?: (message: string) => void };

/**
 * The room's dragon in the browser: the same stage the phone draws, straight on
 * a canvas over the seats. It used to live inside a frame of its own, but a
 * frame that covers the whole room hides it when the browser paints the frame
 * white; on a canvas the room stays visible.
 */
export const Dragon3D = forwardRef<Dragon3DHandle, Props>(function Dragon3D({ onError }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<DragonStage | null>(null);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = createDragonStage({
      canvas,
      loadModel: async (name) => {
        const response = await fetch(`/dragon/dragon_${name}.glb`);
        if (!response.ok) throw new Error("El dragón no se pudo cargar.");
        return response.arrayBuffer();
      },
      onError: (message) => errorRef.current?.(message),
    });
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  useImperativeHandle(ref, () => ({
    play: (box, clip) => stageRef.current?.play(box, clip),
    pair: (left, right) => stageRef.current?.pair(left, right),
  }), []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 44,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background: "transparent",
      }}
    />
  );
});
