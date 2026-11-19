import { useEffect, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ImperialBubble, ImperialMicWave } from '@/components/imperial-svip';
import { imperialKit } from '@/lib/svip-imperial';
import { svipTheme } from '@/lib/svip';
import { useMotion } from '@/lib/power';

/**
 * The pieces every SVIP level wears. Levels with their own supplied kit use that
 * art; the rest are drawn in the level's own colours, so all ten levels show a
 * chat bubble, mic waves and a badge instead of falling back to a plain look.
 */

/** The chat bubble of a level: the kit's plaque, or the level's colours. */
export function SvipBubble({ level, children }: { level: number; children: ReactNode }) {
  const kit = imperialKit(level);
  if (kit) return <ImperialBubble kit={kit}>{children}</ImperialBubble>;

  const theme = svipTheme(level);
  if (!theme) return <>{children}</>;
  return <DrawnBubble ring={theme.ring} accent={theme.accent} background={theme.background}>{children}</DrawnBubble>;
}

function DrawnBubble({
  ring,
  accent,
  background,
  children,
}: {
  ring: [string, string, string];
  accent: string;
  background: [string, string, string];
  children: ReactNode;
}) {
  const motion = useMotion();
  const shimmer = useSharedValue(0);
  useEffect(() => {
    if (!motion) {
      shimmer.value = 0;
      return;
    }
    shimmer.value = withRepeat(withTiming(1, { duration: 2900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [shimmer, motion]);
  const glow = useAnimatedStyle(() => ({ opacity: 0.2 + shimmer.value * 0.3 }));

  return (
    <View style={{ minWidth: 150 }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', top: -3, left: -3, right: -3, bottom: -3, borderRadius: 18,
            backgroundColor: withAlpha(ring[0], 0.25), shadowColor: accent, shadowOpacity: 0.7, shadowRadius: 11,
          },
          motion ? glow : { opacity: 0.28 },
        ]}
      />
      <View
        style={{
          borderRadius: 15, borderWidth: 1.5, borderColor: withAlpha(ring[2], 0.85),
          overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 9,
        }}>
        <LinearGradient
          pointerEvents="none"
          colors={[withAlpha(background[0], 0.97), withAlpha(background[1], 0.97)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.2)']}
          locations={[0, 0.45, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.2, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: accent }}
        />
        {children}
      </View>
    </View>
  );
}

/** The waves a seat shows while its person speaks. */
export function SvipMicWave({ level, speaking, children }: { level: number; speaking: boolean; children: ReactNode }) {
  if (imperialKit(level)) {
    return <ImperialMicWave level={level} speaking={speaking}>{children}</ImperialMicWave>;
  }
  const theme = svipTheme(level);
  if (!theme) return <>{children}</>;
  return <DrawnMicWave color={theme.ring[0]} speaking={speaking}>{children}</DrawnMicWave>;
}

function DrawnMicWave({ color, speaking, children }: { color: string; speaking: boolean; children: ReactNode }) {
  const motion = useMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!speaking || !motion) return;
    pulse.value = 0;
    pulse.value = withRepeat(withTiming(1, { duration: 1250, easing: Easing.out(Easing.quad) }), -1, false);
  }, [speaking, pulse, motion]);
  const ring = useAnimatedStyle(() => ({
    opacity: speaking ? (motion ? 0.85 - pulse.value * 0.6 : 0.38) : 0,
    transform: [{ scale: motion ? 0.88 + pulse.value * 0.3 : 0.94 }],
  }));
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', width: 76, height: 76, borderRadius: 38,
            borderWidth: 2.5, borderColor: color,
          },
          ring,
        ]}
      />
      {children}
    </View>
  );
}

/** The medal shown in the entrance banner for levels without their own art. */
export function SvipEntryArt({ level, size = 26 }: { level: number; size?: number }) {
  const kit = imperialKit(level);
  if (kit) {
    return <Image source={kit.medal} resizeMode="contain" style={{ width: size, height: size }} accessibilityIgnoresInvertColors />;
  }
  const theme = svipTheme(level);
  if (!theme) return null;
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 3, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: theme.ring[2], backgroundColor: withAlpha(theme.ring[1], 0.55),
      }}>
      <View style={{ width: size * 0.45, height: size * 0.45, borderRadius: size * 0.22, backgroundColor: theme.ring[0] }} />
    </View>
  );
}

/** `#RRGGBB` to rgba, for tints. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
