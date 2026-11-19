import { useEffect } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useMotion } from '@/lib/power';
import { cn } from '@/lib/utils';

/**
 * La forma de lo que está por llegar.
 *
 * Una rueda que gira dice «espera»; un esqueleto con la forma de la tarjeta
 * dice qué va a aparecer y hace que la espera se sienta más corta. El brillo
 * es lento y se queda quieto con el ahorro de batería.
 */
export function Skeleton({ className, style }: { className?: string; style?: StyleProp<ViewStyle> }) {
  const motion = useMotion();
  const glow = useSharedValue(0.5);

  useEffect(() => {
    if (!motion) {
      glow.value = 0.55;
      return;
    }
    glow.value = withRepeat(
      withTiming(0.95, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [glow, motion]);

  const pulse = useAnimatedStyle(() => ({ opacity: glow.value }));

  return (
    <Animated.View style={pulse}>
      <View className={cn('bg-muted rounded-xl', className)} style={style} />
    </Animated.View>
  );
}

/** Una lista de tarjetas con la forma de la sala, mientras llega la real. */
export function RoomCardSkeleton({ height = 200 }: { height?: number }) {
  return (
    <View
      className="border-border bg-card overflow-hidden rounded-[20px] border"
      style={{ height }}>
      <Skeleton className="h-full w-full rounded-[20px]" />
      <View className="absolute inset-x-3 bottom-3 gap-2">
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-2.5 w-1/3" />
      </View>
    </View>
  );
}

/** Una fila con la forma de una conversación o de un momento. */
export function RowSkeleton({ avatar = 44 }: { avatar?: number }) {
  return (
    <View className="border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3.5 py-3">
      <Skeleton className="rounded-full" style={{ width: avatar, height: avatar }} />
      <View className="flex-1 gap-2">
        <Skeleton className="h-2.5 w-1/3" />
        <Skeleton className="h-2.5 w-3/4" />
      </View>
    </View>
  );
}

/** La foto de un momento: la misma proporción 4:3 que la imagen real. */
export function SkeletonPhoto() {
  return <Skeleton className="w-full rounded-[16px]" style={{ aspectRatio: 4 / 3 }} />;
}
