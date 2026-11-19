import { useEffect } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { usePowerSettings } from '@/lib/power';

type Props = {
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Colour of the halo; the ring breathes with it. */
  color: string;
  /** Turns the halo on: only the active control glows. */
  active?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
};

/**
 * A round control that answers the finger and, while it is doing something
 * (microphone live, camera sending), breathes with a soft coloured halo.
 */
export function PulseButton({ onPress, accessibilityLabel, disabled, color, active = false, style, children }: Props) {
  const saver = usePowerSettings().battery;
  const scale = useSharedValue(1);
  const halo = useSharedValue(0);

  useEffect(() => {
    if (!active || disabled || saver) {
      halo.value = withTiming(0, { duration: 220 });
      return;
    }
    halo.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
        withTiming(0.28, { duration: 1150, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [active, disabled, halo, saver]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.16 + halo.value * 0.34,
    transform: [{ scale: 1 + halo.value * 0.45 }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: active ? (saver ? 0.62 : 0.35 + halo.value * 0.45) : 0 }));

  return (
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center' }, buttonStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[
          { position: 'absolute', width: 52, height: 52, borderRadius: 26, backgroundColor: color },
          haloStyle,
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', width: 46, height: 46, borderRadius: 23,
            borderWidth: 1.5, borderColor: color,
          },
          ringStyle,
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: Boolean(disabled) }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => { scale.value = withSpring(0.9, { damping: 14, stiffness: 260 }); }}
        onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 220 }); }}
        style={style}>
        {children}
      </Pressable>
    </Animated.View>
  );
}
