import { View } from 'react-native';
import type { ReactNode } from 'react';
import { ALL_FRAMES } from '@/lib/gold';
import { AnimatedFrameArt } from '@/components/animated-frame';

type Props = {
  /** `frame:aureo` or plain `aureo`; anything else shows no frame. */
  frame: string | null | undefined;
  size: number;
  children: ReactNode;
  /** Photo width as a share of the whole frame. */
  inner?: number;
};

/**
 * An avatar wearing one of the gold frames. The art is a transparent PNG, so
 * the photo sits inside its hole and the frame reads the same on any colour.
 */
export function GoldAvatar({ frame, size, children, inner = 0.7 }: Props) {
  const item = ALL_FRAMES.find(entry => `frame:${entry.key}` === frame || entry.key === frame);
  const art = item?.art;
  if (!art) return <View style={{ width: size, height: size }}>{children}</View>;
  const side = size * inner;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: side, height: side, borderRadius: side / 2, overflow: 'hidden' }}>
        <View style={{ width: side, height: side }}>{children}</View>
      </View>
      <AnimatedFrameArt art={art} size={size} accent={item?.accent ?? '#FFC24B'} />
    </View>
  );
}
