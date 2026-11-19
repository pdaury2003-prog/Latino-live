import { useEffect } from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useMotion } from '@/lib/power';
import { UltraHalo } from '@/components/ultra-halo';

type Props = {
  art: ImageSourcePropType;
  /** The box the frame is drawn in. */
  size: number;
  /** The colour the light of this frame carries. */
  accent: string;
  /** Turns the motion off where many frames share the screen, such as seats. */
  animated?: boolean;
  /** The circling sparks: they are left out where many frames share the screen. */
  sparks?: boolean;
  /** The frame is drawn this much bigger than its box, for the ornaments. */
  scale?: number;
};

/**
 * Android decodes an image for the box it is drawn in, which softens the thin
 * gold edges of a frame. Asking for a little more detail keeps the metal and
 * the gems as crisp as they look on the web.
 */
const SHARP = {
  resizeMethod: 'resize' as const,
  fadeDuration: 0,
};

/** One spark that circles the frame and fades in and out. */
function Spark({
  angle,
  radius,
  size,
  color,
  phase,
  running,
}: {
  angle: number;
  radius: number;
  size: number;
  color: string;
  phase: number;
  running: boolean;
}) {
  const beat = useSharedValue(0);

  useEffect(() => {
    if (!running) return;
    beat.value = withRepeat(withTiming(1, { duration: 2400 + phase * 900, easing: Easing.inOut(Easing.quad) }), -1, false);
  }, [beat, phase, running]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.15 + 0.85 * Math.abs(Math.sin(beat.value * Math.PI)),
    transform: [
      { scale: 0.4 + 0.9 * Math.abs(Math.sin(beat.value * Math.PI)) },
      { rotate: '45deg' },
    ],
  }));

  const rad = (angle * Math.PI) / 180;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        {
          width: size,
          height: size,
          backgroundColor: color,
          left: radius * Math.cos(rad) - size / 2,
          top: radius * Math.sin(rad) - size / 2,
        },
        style,
      ]}
    />
  );
}

/**
 * A frame that lives: its own art breathes and sways, a halo of its own
 * colour glows behind it and sparks circle it. The motion is slow enough to
 * look like light and not like a slideshow.
 *
 * The halo is a real light, not a second copy of the art: a copy left the
 * metal looking doubled and soft, so the glow is a soft radial colour and the
 * frame stays as crisp as it is on the web.
 */
export function AnimatedFrameArt({ art, size, accent, animated = true, sparks = true, scale = 1 }: Props) {
  const motion = useMotion() && animated;
  const breath = useSharedValue(0);
  const sway = useSharedValue(0);

  useEffect(() => {
    if (!motion) {
      breath.value = 0;
      sway.value = 0;
      return;
    }
    breath.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
    sway.value = withRepeat(withTiming(1, { duration: 5600, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [breath, sway, motion]);

  // The light sits behind the photo: only the glow around the metal shows.
  const halo = useAnimatedStyle(() => ({
    opacity: 0.5 + 0.22 * breath.value,
    transform: [{ scale: 1.04 + 0.07 * breath.value }],
  }));

  const frame = useAnimatedStyle(() => ({
    transform: [{ scale: scale * (1 + 0.014 * breath.value) }, { rotate: `${-1.1 + 2.2 * sway.value}deg` }],
  }));

  return (
    <View pointerEvents="none" style={[styles.layer, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.layer,
          { width: size * 1.34, height: size * 1.34, left: -size * 0.17, top: -size * 0.17 },
          halo,
        ]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`frame-glow-${accent.replace('#', '')}`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <Stop offset="0.42" stopColor={accent} stopOpacity="0" />
              <Stop offset="0.66" stopColor={accent} stopOpacity="0.5" />
              <Stop offset="0.88" stopColor={accent} stopOpacity="0.16" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="50" cy="50" r="50" fill={`url(#frame-glow-${accent.replace('#', '')})`} />
        </Svg>
      </Animated.View>

      {motion && sparks ? (
        <>
          <Spark angle={-52} radius={size * 0.46} size={size * 0.09} color={accent} phase={0} running={motion} />
          <Spark angle={38} radius={size * 0.44} size={size * 0.07} color={accent} phase={1} running={motion} />
          <Spark angle={152} radius={size * 0.47} size={size * 0.08} color={accent} phase={2} running={motion} />
          <Spark angle={222} radius={size * 0.43} size={size * 0.06} color="#FFFFFF" phase={3} running={motion} />
        </>
      ) : null}

      <Animated.View style={[styles.layer, { width: size, height: size }, frame]}>
        <Image
          source={art}
          resizeMode="contain"
          style={{ width: size, height: size }}
          accessibilityIgnoresInvertColors
          {...SHARP}
        />
      </Animated.View>

      <UltraHalo
        size={size * 1.04}
        colors={[accent, '#8A5A12', '#FFF6DA']}
        running={motion}
        level={2}
        duration={7000}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  spark: {
    position: 'absolute',
    borderRadius: 2,
  },
});
