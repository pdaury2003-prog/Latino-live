import { useEffect, useRef } from 'react';
import type { VideoSource } from '@/lib/live-audio.types';

type Props = { source: VideoSource; muted?: boolean; className?: string; mirror?: boolean };

/** A live camera picture in the browser: the WebRTC stream drawn in a small video. */
export function LiveVideo({ source, muted = true, mirror = false }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const stream = 'stream' in source ? source.stream : null;

  useEffect(() => {
    const element = ref.current;
    if (!element || !stream) return;
    element.srcObject = stream as MediaStream;
    void element.play().catch(() => undefined);
    return () => { element.srcObject = null; };
  }, [stream]);

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        transform: mirror ? 'scaleX(-1)' : undefined,
      }}
    />
  );
}
