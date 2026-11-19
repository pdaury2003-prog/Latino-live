import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { cn } from '@/lib/utils';

type Props = {
  uri?: string | null;
  name: string;
  /**
   * The picture a person without a photo of their own shows. The rooms hand
   * over the house's portrait, so a seat is never an empty letter.
   */
  fallback?: ImageSourcePropType | null;
  /** Extra classes for the circle itself. */
  className?: string;
  textClassName?: string;
  /** Dims the photo, for quiet seats. */
  dimmed?: boolean;
  /**
   * A camera seat is a rounded square, so its picture is clipped to that
   * corner instead of the circle a portrait uses.
   */
  radius?: number;
};

/**
 * A profile photo filling a circle edge to edge, so the face is as large as the
 * seat allows. The frame components draw their metal over the very same circle.
 */
export function AvatarPhoto({ uri, name, fallback, className, textClassName, dimmed = false, radius }: Props) {
  const initial = (name || '?').trim().slice(0, 1).toUpperCase();
  const source = uri ? { uri } : fallback ?? null;

  return (
    <View
      className={cn('bg-muted size-full items-center justify-center overflow-hidden', radius === undefined && 'rounded-full', className)}
      style={{ opacity: dimmed ? 0.55 : 1, ...(radius === undefined ? null : { borderRadius: radius }) }}>
      {source ? (
        <Image
          source={source}
          resizeMode="cover"
          // A list of faces decodes a little sharper and never fades in from
          // grey: the fade is what made a room blink while seats changed.
          resizeMethod="resize"
          fadeDuration={0}
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Text className={cn('text-foreground text-[15px] font-semibold', textClassName)}>{initial}</Text>
      )}
    </View>
  );
}
