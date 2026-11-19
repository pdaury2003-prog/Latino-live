import type { ReactNode } from 'react';
import { View } from 'react-native';
import { frameArt } from '@/lib/shop';
import { ALL_FRAMES } from '@/lib/gold';
import { frameFit, frameOpening } from '@/lib/frame-fit';
import { AnimatedFrameArt } from '@/components/animated-frame';

type Props = {
  /** Shop key such as `frame:leon`, or null for no frame. */
  frame: string | null | undefined;
  /** Width and height of the frame's box. */
  size: number;
  children: ReactNode;
  /** Photo width as a share of the box, for frames without measurements. */
  inner?: number;
  /**
   * Seat size: the photo fills the whole circle and the frame is drawn a little
   * larger over it, so the face is as big as a bare seat's and the metal still
   * shows its crown and sceptre.
   */
  seat?: boolean;
};

/**
 * An avatar wearing a bought frame. The frame art is not square, so it is fitted
 * by height inside the box, and the photo is placed on the frame's own opening
 * using the measurements in `FRAME_FIT`; the face stays whole and centred at
 * every size instead of being cropped by a guessed circle.
 */
/** How much larger than the seat the frames are drawn so their ornaments show. */
export const SEAT_FRAME_SCALE = 1.22;

export function FramedAvatar({ frame, size, children, inner: innerRatio = 0.7, seat = false }: Props) {
  const item = ALL_FRAMES.find(entry => `frame:${entry.key}` === frame || entry.key === frame);
  const art = item?.art ?? frameArt(frame);
  if (!art) {
    return <View style={{ width: size, height: size }}>{children}</View>;
  }

  if (seat) {
    // A seat wears the frame exactly as a profile does: the face sits in the
    // frame's own round opening and the whole art fits inside the seat's box,
    // so the wings and jewels show at full detail and never reach a neighbour.
    const fit = frameFit(frame);
    const opening = fit ? frameOpening(size, frame) : { diameter: size * innerRatio, cx: size / 2, cy: size / 2 };
    const { diameter, cx: centerX, cy: centerY } = opening;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            overflow: 'hidden',
            left: centerX - diameter / 2,
            top: centerY - diameter / 2,
          }}>
          {children}
        </View>
        {/* A seat shows the art at full detail; its motion would only add a
            dozen loops to a grid that already has to answer every touch. */}
        <AnimatedFrameArt art={art} size={size} accent={item?.accent ?? '#FFC24B'} sparks={false} animated={false} />
      </View>
    );
  }

  const fit = frameFit(frame);
  const opening = fit ? frameOpening(size, frame) : { diameter: size * innerRatio, cx: size / 2, cy: size / 2 };
  const { diameter, cx: centerX, cy: centerY } = opening;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
          overflow: 'hidden',
          left: centerX - diameter / 2,
          top: centerY - diameter / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {children}
      </View>
      <AnimatedFrameArt art={art} size={size} accent={item?.accent ?? '#FFC24B'} />
    </View>
  );
}
