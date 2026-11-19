import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { usePowerSettings } from '@/lib/power';

type Props = {
  /** Width of the eye in pixels; the height follows the almond shape. */
  size?: number;
  /** Lid colour, iris colour and pupil colour. */
  colors?: [string, string, string];
};

/**
 * An open eye that looks from side to side and blinks. The whole eye squashes
 * to close, and the iris travels inside it, so it reads as alive without any
 * image asset.
 */
export function AnimatedEye({ size = 40, colors = ['#FF2D8A', '#C77BFF', '#1A0B24'] }: Props) {
  const look = useSharedValue(0);
  const lid = useSharedValue(1);
  const saver = usePowerSettings().battery;
  const height = size * 0.62;
  const iris = size * 0.34;

  useEffect(() => {
    if (saver) {
      look.value = 0;
      lid.value = 1;
      return;
    }
    look.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(-1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    // A quick blink every few seconds, then the lid opens again.
    lid.value = withRepeat(
      withSequence(
        withDelay(2400, withTiming(0.08, { duration: 110, easing: Easing.in(Easing.quad) })),
        withTiming(1, { duration: 160, easing: Easing.out(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [look, lid, saver]);

  const eyeStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: lid.value }] }));
  const gazeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: look.value * (size * 0.12) }],
  }));

  return (
    <View style={{ width: size, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ width: size, height }, eyeStyle]}>
        <Svg width={size} height={height} viewBox="0 0 32 23">
          <Defs>
            <LinearGradient id="eyeWhite" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#FFFFFF" />
            </LinearGradient>
          </Defs>

          {/* The white of the eye. */}
          <Path
            d="M2.2 11.5C7.4 4.6 12.8 2 16 2s8.6 2.6 13.8 9.5C24.6 18.4 19.2 21 16 21S7.4 18.4 2.2 11.5Z"
            fill="url(#eyeWhite)"
          />

          {/* Lid line, drawn last so it sits over the iris. */}
          <Path
            d="M2.2 11.5C7.4 4.6 12.8 2 16 2s8.6 2.6 13.8 9.5"
            fill="none"
            stroke={colors[0]}
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <Path
            d="M2.6 13.4C7.6 18.6 12.8 20.6 16 20.6s8.4-2 13.4-7.2"
            fill="none"
            stroke={colors[0]}
            strokeOpacity="0.35"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </Svg>

        {/* The moving part: iris, pupil and shine travel together. */}
        <Animated.View
          pointerEvents="none"
          style={[{
            position: 'absolute', width: size, height,
            alignItems: 'center', justifyContent: 'center',
          }, gazeStyle]}>
          <Svg width={iris} height={iris} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id="irisMove" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors[1]} />
                <Stop offset="1" stopColor={colors[0]} />
              </LinearGradient>
            </Defs>
            <Circle cx="12" cy="12" r="11" fill="url(#irisMove)" />
            <Circle cx="12" cy="12" r="5.4" fill={colors[2]} />
            <Circle cx="8.6" cy="8.4" r="2.7" fill="#FFFFFF" fillOpacity="0.92" />
            <Circle cx="15.8" cy="15.4" r="1.2" fill="#FFFFFF" fillOpacity="0.5" />
          </Svg>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
