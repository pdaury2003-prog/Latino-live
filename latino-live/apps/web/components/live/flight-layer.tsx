"use client";

import { useEffect, useRef } from "react";
import { StickerActor } from "@/components/live/sticker-actor";
import { stickerById, type StickerSignal } from "@/lib/stickers";

export type Flight = StickerSignal & {
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/**
 * The stickers in the air: each one leaves the seat that sent it, arcs over the
 * room and lands where it was aimed, with its own sparks and word.
 */
export function FlightLayer({ flights, onDone }: { flights: Flight[]; onDone: (flight: Flight) => void }) {
  return (
    <>
      {flights.map(flight => (
        <OneFlight key={flight.id} flight={flight} onDone={onDone} />
      ))}
    </>
  );
}

function OneFlight({ flight, onDone }: { flight: Flight; onDone: (flight: Flight) => void }) {
  const sticker = stickerById(flight.stickerId);
  const done = useRef(onDone);
  done.current = onDone;
  const size = 88;
  const duration = 900;

  useEffect(() => {
    const timer = window.setTimeout(() => done.current(flight), duration + 1200);
    return () => window.clearTimeout(timer);
  }, [flight, duration]);

  if (!sticker) return null;
  const { from, to } = flight;
  const sparks = Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2 + 0.3;
    const reach = size * (1.1 + ((index * 7) % 5) / 10);
    return {
      emoji: sticker.burst[index % sticker.burst.length],
      dx: Math.cos(angle) * reach,
      dy: Math.sin(angle) * reach - 10,
      size: 14 + ((index * 5) % 8),
      delay: ((index * 3) % 5) / 20,
      rotate: index % 2 ? 120 : -120,
    };
  });

  return (
    <>
      {[0, 1].map(index => (
        <span
          key={`ring-${index}`}
          className="burst-ring"
          style={{
            left: to.x,
            top: to.y,
            width: size * 0.9,
            height: size * 0.9,
            marginLeft: -size * 0.45,
            marginTop: -size * 0.45,
            animationDelay: `${0.82 + index * 0.16}s`,
            ["--ring-color" as string]: sticker.tint[0],
          } as React.CSSProperties}
        />
      ))}
      {sparks.map((spark, index) => (
        <span
          key={`spark-${index}`}
          className="burst-spark"
          style={{
            left: to.x,
            top: to.y,
            animationDelay: `${0.8 + spark.delay}s`,
            ["--bx" as string]: `${spark.dx}px`,
            ["--by" as string]: `${spark.dy}px`,
            ["--br" as string]: `${spark.rotate}deg`,
            ["--e" as string]: `${spark.size}px`,
          } as React.CSSProperties}
        >
          {spark.emoji}
        </span>
      ))}
      {sticker.shout ? (
        <span className="shout" style={{ left: to.x, top: to.y - 30, fontSize: 16, animationDelay: "0.8s" }}>
          {sticker.shout}
        </span>
      ) : null}
      <div
        className="flight flight-outer"
        style={{
          ["--fx" as string]: `${from.x - size / 2}px`,
          ["--fy" as string]: `${from.y - size / 2}px`,
          ["--tx" as string]: `${to.x - size / 2}px`,
          ["--ty" as string]: `${to.y - size / 2}px`,
          ["--dur" as string]: `${duration}ms`,
        } as React.CSSProperties}
      >
        <div className="flight-inner" style={{ ["--arc" as string]: `${size * 0.9}px`, ["--dur" as string]: `${duration}ms` } as React.CSSProperties}>
          <StickerActor sticker={sticker} size={size} />
        </div>
      </div>
    </>
  );
}
