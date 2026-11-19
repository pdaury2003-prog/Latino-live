/**
 * The room's stage on the web: the same dark hall, beams and gold emblem the
 * phone app draws, so a room looks the same whichever device opens it.
 */
export function RoomStage() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#070A1A_0%,#0E1436_42%,#131B45_72%,#080B1E_100%)]" />

      {/* The beams that fall on the host's place. */}
      <div className="absolute left-1/2 top-0 h-[46%] w-[34%] -translate-x-1/2 bg-[linear-gradient(180deg,rgba(190,208,255,0.30)_0%,rgba(130,160,255,0.10)_55%,transparent_100%)] [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
      <div className="absolute left-[12%] top-0 h-[40%] w-[20%] bg-[linear-gradient(180deg,rgba(160,180,255,0.20)_0%,rgba(100,130,255,0.06)_55%,transparent_100%)] [clip-path:polygon(38%_0,62%_0,100%_100%,0_100%)]" />
      <div className="absolute right-[12%] top-0 h-[40%] w-[20%] bg-[linear-gradient(180deg,rgba(160,180,255,0.20)_0%,rgba(100,130,255,0.06)_55%,transparent_100%)] [clip-path:polygon(38%_0,62%_0,100%_100%,0_100%)]" />

      {/* The emblem of the house and its plinth. */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 390 780" preserveAspectRatio="none">
        <defs>
          <linearGradient id="stage-v" x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" stopColor="#FFE7AE" stopOpacity="1" />
            <stop offset="0.42" stopColor="#D9A94A" stopOpacity="0.95" />
            <stop offset="1" stopColor="#7A5718" stopOpacity="0.5" />
          </linearGradient>
          <linearGradient id="stage-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8FA8FF" stopOpacity="0.22" />
            <stop offset="1" stopColor="#8FA8FF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <ellipse cx="195" cy="455" rx="180" ry="62" fill="url(#stage-floor)" />
        <path d="M 88 250 L 195 452 L 302 250 L 263 250 L 195 388 L 127 250 Z" fill="url(#stage-v)" opacity="0.5" />
        <path d="M 141 250 L 195 348 L 249 250 L 226 250 L 195 305 L 164 250 Z" fill="url(#stage-v)" opacity="0.45" />
        <path d="M 133 462 L 257 462 L 281 497 L 109 497 Z" fill="#121834" opacity="0.9" />
        <path d="M 109 497 L 281 497" stroke="rgba(216,177,92,0.75)" strokeWidth="1.5" />
      </svg>

      {/* The layer that keeps the room's words readable. */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,6,14,0.55)_0%,rgba(3,6,14,0.05)_45%,rgba(3,6,14,0.72)_100%)]" />
    </div>
  );
}
