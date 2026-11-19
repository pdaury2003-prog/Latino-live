import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { svipKit, type SvipKit } from '@/lib/svip-kit';
import { useMotion } from '@/lib/power';
import { UltraHalo } from '@/components/ultra-halo';

/**
 * The pieces of the SVIP kit, alive.
 *
 * Each piece moves the way the level's material should: the ring of a photo
 * turns its light around, the crest breathes and throws sparks, the banner
 * and the panel carry a shine that travels across them, and the background
 * breathes very slowly so it never pulls the eye away from the room.
 */

/** A light that travels across a surface, like a shine on gold. */
function Shine({ color, duration = 3200, radius = 90 }: { color: string; duration?: number; radius?: number }) {
  const travel = useSharedValue(0);

  useEffect(() => {
    travel.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [travel, duration]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.16 + 0.5 * Math.sin(travel.value * Math.PI),
    transform: [{ translateX: -radius * 2 + travel.value * radius * 4 }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          top: -radius,
          bottom: -radius,
          width: radius * 1.5,
          backgroundColor: color,
          opacity: 0.2,
          shadowColor: color,
          shadowOpacity: 0.9,
          shadowRadius: radius * 0.5,
        },
        style,
      ]}
    />
  );
}

/** A spark that circles a crest and fades in and out. */
function Spark({ angle, radius, size, color, phase, running }: {
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
    beat.value = withRepeat(
      withTiming(1, { duration: 2200 + phase * 800, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [beat, phase, running]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.1 + 0.9 * Math.abs(Math.sin(beat.value * Math.PI)),
    transform: [{ scale: 0.35 + 0.95 * Math.abs(Math.sin(beat.value * Math.PI)) }, { rotate: '45deg' }],
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
 * The ring around a photo. The photo goes exactly in the hole of the art, the
 * frame breathes and a ring of light travels around it.
 */
export function SvipKitAvatar({
  level,
  size,
  children,
  animated = true,
}: {
  level: number;
  size: number;
  children: ReactNode;
  animated?: boolean;
}) {
  const kit = svipKit(level);
  const motion = useMotion() && animated;
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!motion) return;
    breath.value = withRepeat(withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breath, motion]);

  const halo = useAnimatedStyle(() => ({
    opacity: 0.2 + breath.value * 0.22,
    transform: [{ scale: 1.02 + breath.value * 0.05 }],
  }));

  const frame = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-1.4 + 2.8 * breath.value}deg` }, { scale: 1 + breath.value * 0.015 }],
  }));

  if (!kit) return <>{children}</>;

  const boxWidth = size * kit.opening.aspect;
  const hole = size * kit.opening.diameter;
  const holeLeft = (size - boxWidth) / 2 + boxWidth * kit.opening.cx - hole / 2;
  const holeTop = size * kit.opening.cy - hole / 2;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size * 0.98,
            height: size * 0.98,
            borderRadius: size / 2,
            backgroundColor: kit.halo,
            opacity: 0.18,
          },
          halo,
        ]}
      />

      <View
        style={{
          position: 'absolute',
          left: holeLeft,
          top: holeTop,
          width: hole,
          height: hole,
          borderRadius: hole / 2,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: hole / size }],
          }}>
          {children}
        </View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size * Math.max(1, kit.opening.aspect),
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          },
          frame,
        ]}>
        <Image
          source={kit.avatar}
          resizeMode="contain"
          style={{ width: '100%', height: '100%' }}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>

      {/* The light travels over the metal, so it is drawn after the art. */}
      <UltraHalo
        size={size}
        colors={[kit.edge, kit.accent, kit.halo]}
        running={motion}
        level={level}
        duration={level >= 4 ? 6400 : level >= 2 ? 7600 : 8800}
      />
    </View>
  );
}

/** The crest with the animal head: it breathes and throws sparks. */
export function SvipKitEmblem({
  level,
  size = 40,
  animated = true,
}: {
  level: number;
  size?: number;
  animated?: boolean;
}) {
  const kit = svipKit(level);
  const motion = useMotion() && animated;
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!motion) return;
    breath.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breath, motion]);

  const glow = useAnimatedStyle(() => ({
    opacity: 0.25 + breath.value * 0.35,
    transform: [{ scale: 0.95 + breath.value * 0.07 }],
  }));

  if (!kit) return null;

  return (
    <View style={{ width: size * 1.5, height: size * 1.5, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: size * 1.15,
            height: size * 1.15,
            borderRadius: size * 0.6,
            backgroundColor: kit.halo,
          },
          glow,
        ]}
      />
      {motion ? (
        <>
          <Spark angle={-58} radius={size * 0.72} size={size * 0.13} color={kit.halo} phase={0} running={motion} />
          <Spark angle={34} radius={size * 0.7} size={size * 0.1} color="#FFFFFF" phase={1} running={motion} />
          <Spark angle={168} radius={size * 0.73} size={size * 0.11} color={kit.edge} phase={2} running={motion} />
        </>
      ) : null}
      <Image
        source={kit.emblem}
        resizeMode="contain"
        style={{ width: size, height: size }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** The wide name banner, with a shine that travels across the gold. */
export function SvipKitBanner({
  level,
  width,
  height,
  children,
  animated = true,
}: {
  level: number;
  width: number;
  height: number;
  children?: ReactNode;
  animated?: boolean;
}) {
  const kit = svipKit(level);
  const motion = useMotion() && animated;
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!motion) return;
    breath.value = withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breath, motion]);

  const bannerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.012 }],
  }));

  if (!kit) return <>{children}</>;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width, height }, bannerStyle]}>
        <Image
          source={kit.banner}
          resizeMode="contain"
          style={{ width, height }}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
      {motion ? <Shine color={kit.halo} duration={3600} radius={width * 0.18} /> : null}
      {children ? (
        <View
          style={{
            position: 'absolute',
            left: width * 0.16,
            right: width * 0.16,
            top: height * 0.44,
            bottom: height * 0.06,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

/** The small plate that carries the level. */
export function SvipKitPlate({ level, width = 78 }: { level: number; width?: number }) {
  const kit = svipKit(level);
  if (!kit) return null;
  return (
    <Image
      source={kit.plate}
      resizeMode="contain"
      style={{ width, height: (width * 132) / 346 }}
      accessibilityIgnoresInvertColors
    />
  );
}

/** The button panel: the level's colour with a shine travelling over it. */
export function SvipKitPanel({
  level,
  width,
  height = 46,
  children,
  animated = true,
}: {
  level: number;
  width: number;
  height?: number;
  children?: ReactNode;
  animated?: boolean;
}) {
  const kit = svipKit(level);
  const motion = useMotion() && animated;
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!motion) return;
    breath.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breath, motion]);

  const glow = useAnimatedStyle(() => ({ opacity: 0.3 + breath.value * 0.3 }));

  if (!kit) return <>{children}</>;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            left: -6,
            right: -6,
            top: -4,
            bottom: -4,
            borderRadius: height,
            backgroundColor: kit.accent,
            opacity: 0.35,
            shadowColor: kit.halo,
            shadowOpacity: 0.9,
            shadowRadius: 14,
          },
          glow,
        ]}
      />
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <Image
          source={kit.panel}
          resizeMode="contain"
          style={{ width, height }}
          accessibilityIgnoresInvertColors
        />
        {animated ? <Shine color="#FFFFFF" duration={3000} radius={width * 0.16} /> : null}
        {children ? (
          <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
        ) : null}
      </View>
    </View>
  );
}

/** The background of the profile and of the room: it breathes, very slowly. */
export function SvipKitBackground({
  level,
  height,
  animated = true,
  fill = false,
}: {
  level: number;
  height: number;
  animated?: boolean;
  /** Fills the whole parent instead of stopping at a height. */
  fill?: boolean;
}) {
  const kit = svipKit(level);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    drift.value = withRepeat(withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [drift, animated]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1.08 + drift.value * 0.05 }, { translateY: -drift.value * 10 }],
  }));

  if (!kit) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        fill
          ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }
          : { position: 'absolute', top: 0, left: 0, right: 0, height },
        style,
      ]}>
      <Image
        source={kit.background}
        resizeMode="cover"
        style={{ width: '100%', height: '100%' }}
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(6,6,10,0.35)', 'rgba(6,6,10,0.55)', 'rgba(6,6,10,0.92)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/** The tall frame that greets the person when they enter a room. */
export function SvipKitEntry({
  level,
  width,
  height,
  children,
  animated = true,
}: {
  level: number;
  width: number;
  height: number;
  children?: ReactNode;
  animated?: boolean;
}) {
  const kit = svipKit(level);
  const breath = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    breath.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [breath, animated]);

  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + breath.value * 0.4 }));

  if (!kit) return <>{children}</>;

  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            width: width * 0.82,
            height: height * 0.9,
            borderRadius: width,
            backgroundColor: kit.halo,
            opacity: 0.3,
          },
          glow,
        ]}
      />
      <Image
        source={kit.entry}
        resizeMode="contain"
        style={{ width, height }}
        accessibilityIgnoresInvertColors
      />
      {children ? (
        <View style={{ position: 'absolute', alignItems: 'center', justifyContent: 'center' }}>{children}</View>
      ) : null}
    </View>
  );
}

/** The card that introduces a room. */
export function SvipKitCard({ level, width = 120 }: { level: number; width?: number }) {
  const kit = svipKit(level);
  if (!kit) return null;
  return (
    <Image
      source={kit.card}
      resizeMode="contain"
      style={{ width, height: width }}
      accessibilityIgnoresInvertColors
    />
  );
}

/** The thin ring of light, for a seat or a photo. */
export function SvipKitRing({ level, size, animated = true }: { level: number; size: number; animated?: boolean }) {
  const kit = svipKit(level);
  const turn = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    turn.value = withRepeat(withTiming(1, { duration: 12000, easing: Easing.linear }), -1, false);
  }, [turn, animated]);

  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  if (!kit) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[{ position: 'absolute', width: size * 0.94, height: size * 0.94 }, spin]}>
        <Image
          source={kit.ring}
          resizeMode="contain"
          style={{ width: size * 0.94, height: size * 0.94 }}
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </View>
  );
}

/** The colours of a level, for the parts that are drawn rather than shown. */
export function kitColors(level: number): { accent: string; face: string; edge: string; halo: string; ink: string } | null {
  const kit: SvipKit | null = svipKit(level);
  if (!kit) return null;
  return { accent: kit.accent, face: kit.face, edge: kit.edge, halo: kit.halo, ink: kit.ink };
}

const styles = StyleSheet.create({
  spark: {
    position: 'absolute',
    borderRadius: 2,
  },
});

