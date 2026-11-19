import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { imperialKit, type ImperialKit } from '@/lib/svip-imperial';
import { useMotion } from '@/lib/power';
import { UltraHalo } from '@/components/ultra-halo';

/**
 * The imperial frame breathes: a soft halo behind the gold ring, the motion the
 * supplied animation plays, drawn with the extracted layers.
 */
export function ImperialAvatarFrame({ kit, size, children, medal = true, animated = true }: { kit: ImperialKit; size: number; children: ReactNode; medal?: boolean; animated?: boolean }) {
  const motion = useMotion() && animated;
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!motion) {
      pulse.value = 0;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: kit.level === 2 ? 2400 : 1900, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, kit.level, motion]);
  const glow = useAnimatedStyle(() => ({
    opacity: 0.32 + pulse.value * 0.42,
    transform: [{ scale: 0.96 + pulse.value * 0.07 }],
  }));

  const inner = Math.round(size * kit.opening);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Image
        source={kit.frameGlow}
        resizeMode="contain"
        style={[{ position: 'absolute', width: size * 1.06, height: size * 1.06, opacity: motion ? 1 : 0.55 }, motion ? glow : null]}
        accessibilityIgnoresInvertColors
      />
      <View
        style={{
          position: 'absolute', top: size * kit.openingTop, width: inner, height: inner,
          borderRadius: inner / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center',
        }}>
        {/* The photo is built at full frame size; scaling it keeps the face whole. */}
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', transform: [{ scale: inner / size }] }}>
          {children}
        </View>
      </View>
      <Image
        source={kit.frame}
        resizeMode="contain"
        style={{ position: 'absolute', width: size, height: size }}
        accessibilityIgnoresInvertColors
      />
      <UltraHalo
        size={size}
        colors={[kit.faceEdge, kit.face, kit.halo]}
        running={motion}
        level={kit.level}
        duration={kit.level === 10 ? 6000 : 7600}
      />
      {medal ? (
        <Image
          source={kit.medal}
          resizeMode="contain"
          style={{ position: 'absolute', right: -size * 0.02, bottom: -size * 0.02, width: size * 0.4, height: size * 0.4 }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/** The imperial badge alone, for names and lists. */
export function ImperialMedal({ kit, size = 22 }: { kit: ImperialKit; size?: number }) {
  return (
    <Image
      source={kit.medal}
      resizeMode="contain"
      style={{ width: size, height: size }}
      accessibilityIgnoresInvertColors
    />
  );
}

/** The wide plaque with the level, in place of the compact chip. */
export function ImperialTag({ kit, width = 70 }: { kit: ImperialKit; width?: number }) {
  return (
    <Image
      source={kit.tag}
      resizeMode="contain"
      style={{ width, height: (width * 268) / 752 }}
      accessibilityIgnoresInvertColors
    />
  );
}

/**
 * A chat bubble in the imperial style: a panel in the kit's colour with a gold
 * edge that grows with the message, and the supplied gold rose at the corner.
 * Built from layers rather than stretched, so text never distorts the art.
 */
export function ImperialBubble({ kit, children, animated = true }: { kit: ImperialKit; children: ReactNode; animated?: boolean }) {
  const motion = useMotion() && animated;
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (!motion) {
      shimmer.value = 0;
      return;
    }
    shimmer.value = withRepeat(
      withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [shimmer, motion]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.22 + shimmer.value * 0.32 }));

  return (
    <View style={{ minWidth: 150 }}>
      <Animated.View
        pointerEvents="none"
        style={[{
          position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 18,
          backgroundColor: kit.halo, shadowColor: kit.halo, shadowOpacity: 0.8, shadowRadius: 12,
        }, motion ? glowStyle : { opacity: 0.3 }]}
      />
      <View
        style={{
          borderRadius: 15, borderWidth: 2, borderColor: kit.faceEdge,
          backgroundColor: kit.face, paddingHorizontal: 14, paddingVertical: 9,
          overflow: 'hidden',
        }}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.28)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.18)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {children}
        <Image
          source={kit.rose}
          resizeMode="contain"
          style={{ position: 'absolute', right: -4, bottom: -14, width: 62, height: 50, opacity: 0.95 }}
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );
}

/**
 * The imperial microphone wave: while the person speaks, a bright ring with a
 * soft halo pulses around their seat. Silent seats keep just the frame.
 */
export function ImperialMicWave({ level, speaking, children }: { level: number; speaking: boolean; children: ReactNode }) {
  const kit = imperialKit(level);
  const motion = useMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!kit || !speaking || !motion) return;
    pulse.value = 0;
    pulse.value = withRepeat(
      withTiming(1, { duration: 1200, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [kit, speaking, pulse, motion]);
  const ring = useAnimatedStyle(() => ({
    opacity: speaking ? (motion ? 0.9 - pulse.value * 0.65 : 0.42) : 0,
    transform: [{ scale: motion ? 0.86 + pulse.value * 0.32 : 0.94 }],
  }));
  if (!kit) return <>{children}</>;
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.Image
        source={kit.micWave}
        resizeMode="contain"
        style={[{ position: 'absolute', width: 82, height: 82 }, ring]}
        accessibilityIgnoresInvertColors
      />
      {children}
    </View>
  );
}
