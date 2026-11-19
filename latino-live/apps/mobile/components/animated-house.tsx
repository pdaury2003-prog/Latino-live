import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { House } from 'lucide-react-native';
import { usePowerSettings } from '@/lib/power';

type Props = {
  size?: number;
  color?: string;
};

/**
 * The little house on the floating button: it rises, settles and rocks a
 * little, so the way to your room looks alive instead of a static glyph.
 */
export function AnimatedHouse({ size = 26, color = '#1A1409' }: Props) {
  const saver = usePowerSettings().battery;
  const lift = useSharedValue(0);

  useEffect(() => {
    if (saver) {
      lift.value = 0;
      return;
    }
    lift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 820, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 820, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [lift, saver]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: -lift.value * 3 },
      { rotate: `${(lift.value - 0.5) * 4}deg` },
    ],
  }));

  return (
    <Animated.View style={style}>
      <House size={size} color={color} strokeWidth={2.2} />
    </Animated.View>
  );
}
