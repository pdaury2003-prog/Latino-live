import { useEffect, useId, type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { ROLE_FRAME_ART } from '@/lib/role-frames';
import { useRolePulse } from '@/lib/role-motion';
import { useMotion } from '@/lib/power';
import type { BadgeKind } from '@/lib/badges';

type Props = {
  kind: BadgeKind;
  /** Lado del cuadro del marco; la foto ocupa su abertura central. */
  size: number;
  children: ReactNode;
  /** Apaga el movimiento donde hay muchas piezas en pantalla. */
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * El marco de rol que vive: entra con un resorte, respira con el latido común
 * de las insignias, enciende un halo de su propio color y deja dos destellos
 * dando la vuelta al metal. La foto se dibuja primero y el arte encima, así
 * que la cara siempre queda entera dentro de la ventana del marco.
 */
export function RoleFrame({ kind, size, children, animated = true, style }: Props) {
  const art = ROLE_FRAME_ART[kind];
  const motion = useMotion() && animated;
  const pulse = useRolePulse(animated);
  const enter = useSharedValue(0);
  const turn = useSharedValue(0);
  const uid = `role${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  // La foto es redonda y mide el ancho del hueco: así lo llena de lado a lado,
  // y el metal del marco cubre lo que sobresale arriba y abajo.
  const opening = size * art.fit.openingWidth;

  useEffect(() => {
    enter.value = withSpring(1, { damping: 13, stiffness: 120, mass: 0.9 });
  }, [enter]);

  useEffect(() => {
    if (!motion) {
      turn.value = withTiming(0, { duration: 300 });
      return;
    }
    turn.value = withRepeat(withTiming(1, { duration: 15000, easing: Easing.linear }), -1, false);
    return () => { turn.value = 0; };
  }, [motion, turn]);

  const box = useAnimatedStyle(() => ({ transform: [{ scale: 0.86 + 0.14 * enter.value }], opacity: enter.value }));
  const frame = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.014 * pulse.value }] }));
  const halo = useAnimatedStyle(() => ({
    opacity: 0.32 + 0.26 * pulse.value,
    transform: [{ scale: 1.02 + 0.06 * pulse.value }],
  }));
  const orbit = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));

  const photo = (
    <View
      style={{
        position: 'absolute',
        width: opening,
        height: opening,
        borderRadius: opening / 2,
        overflow: 'hidden',
        // En el marco de CS la foto va sobre el arte y tapa su «S»; un aro
        // fino del color del rol la asienta como un medallón, en vez de
        // dejarla pegada encima del metal.
        ...(art.photoOnTop
          ? { borderWidth: Math.max(1.5, size * 0.018), borderColor: art.colors[1] }
          : null),
        left: size * art.fit.cx - opening / 2,
        top: size * art.fit.cy - opening / 2,
      }}>
      {children}
    </View>
  );

  const metal = (
    <Animated.Image
      source={art.source}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
      style={[{ position: 'absolute', width: size, height: size }, frame]}
    />
  );

  return (
    <Animated.View
      accessible
      accessibilityLabel={art.label}
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, box, style]}>
      {motion ? (
        <Animated.View
          pointerEvents="none"
          style={[{ position: 'absolute', width: size * 1.3, height: size * 1.3, left: -size * 0.15, top: -size * 0.15 }, halo]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id={`${uid}g`} cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
                <Stop offset="0.5" stopColor={art.colors[1]} stopOpacity="0" />
                <Stop offset="0.76" stopColor={art.colors[0]} stopOpacity="0.55" />
                <Stop offset="1" stopColor={art.colors[2]} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="50" fill={`url(#${uid}g)`} />
          </Svg>
        </Animated.View>
      ) : null}

      {art.photoOnTop ? metal : photo}
      {art.photoOnTop ? photo : metal}

      {motion ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, orbit]}>
          <View
            style={{
              position: 'absolute',
              top: size * 0.03,
              left: size * 0.47,
              width: Math.max(2, size * 0.035),
              height: Math.max(2, size * 0.035),
              borderRadius: 999,
              backgroundColor: art.colors[2],
            }}
          />
          <View
            style={{
              position: 'absolute',
              bottom: size * 0.03,
              right: size * 0.47,
              width: Math.max(2, size * 0.028),
              height: Math.max(2, size * 0.028),
              borderRadius: 999,
              backgroundColor: '#FFFFFF',
            }}
          />
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}
