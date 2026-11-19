import type { CSSProperties } from "react";
import type { Sticker } from "@/lib/stickers";
import { cn } from "@/lib/utils";

type Props = {
  sticker: Sticker;
  size: number;
  className?: string;
};

/**
 * The dragon acting one sticker animation: its body moves and the props of
 * that animation appear — the flames, the tears, the coins, the thrown hat,
 * the sign it holds with both hands. The same drawing fills the tray and the
 * sticker that flies across the room.
 */
export function StickerActor({ sticker, size, className }: Props) {
  const style = {
    "--s": `${size}px`,
    "--stk-light": sticker.tint[0],
    "--stk-deep": sticker.tint[1],
  } as CSSProperties;

  return (
    <div className={cn("stk", `sa-${sticker.id}`, className)} style={style}>
      <div className="stk-body">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/dragon.png" alt="" aria-hidden />
      </div>
      <div className="stk-props" aria-hidden>
        <Acting sticker={sticker} />
      </div>
    </div>
  );
}

function Acting({ sticker }: { sticker: Sticker }) {
  const id = sticker.id;

  if (id === "fuego") {
    return (
      <>
        <span className="stk-emoji p-flame" style={{ left: "58%", top: "42%", "--fx": "38%", "--fy": "-6%" } as CSSProperties}>🔥</span>
        <span className="stk-emoji p-flame" style={{ left: "60%", top: "47%", "--fx": "52%", "--fy": "-14%" } as CSSProperties}>🔥</span>
        <span className="stk-emoji p-flame" style={{ left: "62%", top: "53%", "--fx": "66%", "--fy": "2%" } as CSSProperties}>🔥</span>
      </>
    );
  }

  if (id === "llorar" || id === "triste") {
    return (
      <>
        <span className="stk-emoji p-tear" style={{ left: "37%", top: "44%", "--e": "calc(var(--s) * 0.15)" } as CSSProperties}>💧</span>
        <span className="stk-emoji p-tear" style={{ left: "50%", top: "46%", "--e": "calc(var(--s) * 0.13)" } as CSSProperties}>💧</span>
        {id === "llorar" ? (
          <span className="stk-emoji p-tear" style={{ left: "61%", top: "45%", "--e": "calc(var(--s) * 0.14)" } as CSSProperties}>💧</span>
        ) : null}
      </>
    );
  }

  if (id === "burla") return <Bubble text="JA JA JA" />;
  if (id === "pensando") return <Bubble text="Hmm...?" />;

  if (id === "monedas") {
    return (
      <>
        <span className="stk-emoji p-bag" style={{ left: "34%", top: "8%", "--e": "calc(var(--s) * 0.24)" } as CSSProperties}>💰</span>
        {[22, 36, 50, 64, 76].map((left, index) => (
          <span
            key={left}
            className="stk-emoji p-coin"
            style={{ left: `${left}%`, top: "34%", "--e": "calc(var(--s) * 0.13)", animationDelay: `${index * 0.15}s` } as CSSProperties}>
            🪙
          </span>
        ))}
      </>
    );
  }

  if (id === "bailar") {
    return (
      <>
        <span className="stk-emoji p-note" style={{ left: "12%", top: "30%", "--nx": "14%", "--e": "calc(var(--s) * 0.18)" } as CSSProperties}>🎵</span>
        <span className="stk-emoji p-note" style={{ left: "44%", top: "22%", "--nx": "-10%", "--e": "calc(var(--s) * 0.18)" } as CSSProperties}>🎶</span>
        <span className="stk-emoji p-note" style={{ left: "74%", top: "30%", "--nx": "8%", "--e": "calc(var(--s) * 0.18)" } as CSSProperties}>🎵</span>
      </>
    );
  }

  if (id === "sombrero-enojado") {
    return (
      <>
        <span className="stk-emoji p-hat" style={{ left: "30%", top: "-2%", "--e": "calc(var(--s) * 0.26)" } as CSSProperties}>🎩</span>
        <span className="stk-emoji p-anger" style={{ left: "72%", top: "12%", "--e": "calc(var(--s) * 0.2)" } as CSSProperties}>💢</span>
      </>
    );
  }

  if (id === "aplaudir") {
    return (
      <>
        <span className="stk-emoji p-hand-left" style={{ left: "2%", top: "58%", "--e": "calc(var(--s) * 0.26)" } as CSSProperties}>👏</span>
        <span className="stk-emoji p-hand-right" style={{ right: "2%", top: "58%", "--e": "calc(var(--s) * 0.26)" } as CSSProperties}>👏</span>
      </>
    );
  }

  if (id === "beso-izquierda" || id === "beso-derecha") {
    const left = id === "beso-izquierda";
    return (
      <>
        <span
          className="stk-emoji p-kiss"
          style={{ left: left ? "2%" : "62%", top: "32%", "--e": "calc(var(--s) * 0.3)" } as CSSProperties}>
          💋
        </span>
        <span
          className="stk-emoji p-heart"
          style={{ left: left ? "18%" : "64%", top: "44%", "--e": "calc(var(--s) * 0.16)" } as CSSProperties}>
          💗
        </span>
        <span
          className="stk-emoji p-heart"
          style={{ left: left ? "30%" : "52%", top: "38%", "--e": "calc(var(--s) * 0.14)" } as CSSProperties}>
          💖
        </span>
      </>
    );
  }

  if (sticker.sign) {
    return (
      <>
        <div className="stk-sign">{sticker.sign}</div>
        <span className="stk-emoji" style={{ left: "-2%", top: "54%", "--e": "calc(var(--s) * 0.15)" } as CSSProperties}>✊</span>
        <span className="stk-emoji" style={{ right: "-2%", top: "54%", "--e": "calc(var(--s) * 0.15)" } as CSSProperties}>✊</span>
      </>
    );
  }

  if (id === "idle") {
    return <span className="stk-emoji" style={{ right: "10%", top: "14%", "--e": "calc(var(--s) * 0.17)" } as CSSProperties}>✨</span>;
  }

  return null;
}

function Bubble({ text }: { text: string }) {
  return (
    <div
      className="p-bubble absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-[rgba(70,40,10,0.4)] bg-[#fff8ea] px-2 py-[2px] text-center font-extrabold text-[#3a2410]"
      style={{ fontSize: "calc(var(--s) * 0.1)", lineHeight: 1.2, width: "88%" }}>
      {text}
    </div>
  );
}
