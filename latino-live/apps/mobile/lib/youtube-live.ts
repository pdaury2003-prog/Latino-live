export type YoutubeVideo = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  isLive?: boolean;
};

/**
 * The server names a stream by its duration ("EN VIVO"), and older replies
 * carried a flag instead. Reading both keeps the live filter from emptying
 * the whole list.
 */
export function markLive<T extends YoutubeVideo>(videos: T[]): T[] {
  return videos.map(video => ({
    ...video,
    isLive: video.isLive ?? /^en vivo$/i.test(video.duration ?? ''),
  }));
}

/**
 * Whether the shared video counts as playing. YouTube reports -1 unstarted,
 * 0 ended, 1 playing, 2 paused, 3 buffering and 5 cued. Only 0, 2 and -1 are
 * a pause: buffering arrives constantly on a phone and must keep the pause
 * button where it was, or it flickers away and back.
 */
export function playingFromReport(playing: boolean | undefined, state: number | undefined): boolean {
  if (state === 1 || state === 3) return true;
  if (state === 2 || state === 0 || state === -1) return false;
  if (state === 5) return true;
  return Boolean(playing);
}

/**
 * El minuto del video que cae bajo el dedo en la barra de progreso. El tirador
 * mide [thumb] y se mueve entre sus dos mitades, así que sus extremos coinciden
 * con el principio y el final del video en vez de quedarse cortos.
 */
export function seekSecondsAt(x: number, width: number, duration: number, thumb = 12): number {
  const travel = Math.max(0, width - thumb);
  if (travel <= 0 || !(duration > 0)) return 0;
  const ratio = Math.min(1, Math.max(0, (x - thumb / 2) / travel));
  return ratio * duration;
}
