import { memo, useEffect, useState } from 'react';
import { AppState, Image, View } from 'react-native';
import { AvatarPhoto } from '@/components/avatar-photo';
import { RankAura } from '@/components/rank-aura';
import { rankFrame } from '@/lib/rank-frames';
import { usePowerSettings } from '@/lib/power';

type Props = {
  rank: number;
  /** Width of the whole frame, wings included. */
  width: number;
  uri?: string | null;
  name: string;
  /** The animated light storm behind the wings. */
  glow?: boolean;
  /** Plays the bundle's own flicker; a still picture is used when off. */
  animated?: boolean;
};

/**
 * The TOP frame of the daily ranking with the person's photo inside its
 * opening. The art is drawn over the photo, so the photo can never spill past
 * the plaque's own circle.
 */
export const RankFrame = memo(function RankFrame({ rank, width, uri, name, glow = true, animated = true }: Props) {
  const frame = rankFrame(rank);
  const saver = usePowerSettings().battery;
  const [tick, setTick] = useState(0);
  // Twelve frames at twelve changes a second: the wings' fire moves just like
  // the bundle the owner supplied, without the weight of an SVG player.
  useEffect(() => {
    if (!frame || !animated || saver) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (timer) return;
      // Four changes a second is enough for fire: the eye cannot tell it from
      // twelve, and the billboard stops re-rendering a hundred times a second.
      timer = setInterval(() => setTick(value => (value + 1) % frame.frames), 140);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    start();
    // Nothing moves while the phone is in another app.
    const activity = AppState.addEventListener('change', state => {
      if (state === 'active') start();
      else stop();
    });
    return () => {
      stop();
      activity.remove();
    };
  }, [frame, animated, saver]);
  if (!frame) return null;
  const height = width / frame.aspect;
  // The opening is a circle: the picture takes the smaller of its width and
  // height, so not one pixel of it slips under the metal of the plaque.
  const photo = Math.min(width * frame.opening, height * frame.openingY);
  // Whole pixels: a photo placed on a half pixel is resampled and its face
  // looks soft next to the sharp metal of the frame.
  const photoLeft = Math.round(width * frame.centerX - photo / 2);
  const photoTop = Math.round(height * frame.centerY - photo / 2);
  const stripLeft = -Math.round(width * tick);
  return (
    <View style={{ width, height }} className="items-center justify-center">
      {glow ? <RankAura rank={rank} width={width} height={height} /> : null}
      <View
        style={{
          position: 'absolute',
          left: photoLeft,
          top: photoTop,
          width: photo,
          height: photo,
          overflow: 'hidden',
          borderRadius: photo / 2,
        }}>
        <AvatarPhoto uri={uri ?? null} name={name} />
      </View>
      {/* The animated strip is drawn inside a window the size of one frame. */}
      <View style={{ width, height, overflow: 'hidden', alignItems: 'flex-start' }}>
        <Image
          source={animated ? frame.strip : frame.art}
          resizeMode={animated ? 'cover' : 'contain'}
          resizeMethod="resize"
          fadeDuration={0}
          style={animated
            ? { width: width * frame.frames, height, marginLeft: stripLeft }
            : { width, height }}
        />
      </View>
    </View>
  );
});
