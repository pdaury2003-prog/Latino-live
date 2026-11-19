import { useEffect } from 'react';
import { Image, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { usePowerSettings } from '@/lib/power';

/** La gema ilustrada de la casa, recortada con transparencia. */
const GEM = require('@/assets/diamond-gem-160.webp');

/**
 * El corte del diamante dorado en una caja de 24 × 24, para los tamaños
 * pequeños donde el dorado tiene que seguir siendo dorado y no azul.
 */
const BODY = 'M12 2.2 20.4 7.9 12 21.8 3.6 7.9Z';
const TABLE = 'M9.1 2.9h5.8l4.2 4.4H4.9Z';
const GIRDLE = 'M3.6 7.9h16.8';
const FAN = 'M5.4 7.9 12 21.8M8.9 7.9 12 21.8M15.1 7.9 12 21.8M18.6 7.9 12 21.8';
const CROWN_EDGES = 'M9.1 2.9 5.4 7.9M14.9 2.9 18.6 7.9';

type Props = {
  size?: number;
  /** El brillo se apaga en las listas largas y con el ahorro de batería. */
  animated?: boolean;
  /** Un tono de la gema: hielo por defecto, oro para el saldo cálido. */
  tone?: 'ice' | 'gold';
};

const TONES = {
  ice: {
    top: '#F2FAFF',
    middle: '#A9DCFF',
    deep: '#3C7FC4',
    edge: '#DDF2FF',
    sparkle: '#FFFFFF',
  },
  gold: {
    top: '#FFF8E0',
    middle: '#FFD87A',
    deep: '#C48A12',
    edge: '#FFEDB8',
    sparkle: '#FFFDF2',
  },
} as const;

/**
 * El diamante de la billetera: la gema ilustrada de la casa, con un pulso
 * lento y tres destellos que se encienden a distinto ritmo. El movimiento se
 * detiene con el ahorro de batería.
 */
export function SparklingDiamond({ size = 24, animated = true, tone = 'ice' }: Props) {
  const saver = usePowerSettings().battery;
  const live = animated && !saver;
  const colors = TONES[tone];
  const id = tone;

  const pulse = useSharedValue(0);
  const blinkA = useSharedValue(0);
  const blinkB = useSharedValue(0);
  const blinkC = useSharedValue(0);

  useEffect(() => {
    if (!live) {
      pulse.value = 0;
      blinkA.value = 0;
      blinkB.value = 0;
      blinkC.value = 0;
      return;
    }
    // El pulso respira despacio, para que no compita con el número del saldo.
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
    const twinkle = (value: typeof blinkA, delay: number) => {
      value.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
            withTiming(0, { duration: 620, easing: Easing.in(Easing.quad) }),
            withDelay(700, withTiming(0, { duration: 0 })),
          ),
          -1,
          false,
        ),
      );
    };
    twinkle(blinkA, 0);
    twinkle(blinkB, 700);
    twinkle(blinkC, 1300);
  }, [live, pulse, blinkA, blinkB, blinkC]);

  const gemStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.035 }],
  }));
  const starA = useAnimatedStyle(() => ({
    opacity: blinkA.value,
    transform: [{ scale: 0.55 + blinkA.value * 0.55 }],
  }));
  const starB = useAnimatedStyle(() => ({
    opacity: blinkB.value,
    transform: [{ scale: 0.5 + blinkB.value * 0.5 }],
  }));
  const starC = useAnimatedStyle(() => ({
    opacity: blinkC.value,
    transform: [{ scale: 0.45 + blinkC.value * 0.55 }],
  }));

  // El destello acompaña a la gema, no la tapa: crece con ella hasta un tope.
  const star = Math.max(5, Math.min(16, Math.round(size * 0.2)));

  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={gemStyle}>
        {tone === 'gold' ? (
          <Svg width={size} height={size} viewBox="0 0 24 24">
            <Defs>
              <LinearGradient id={`gem-${id}`} x1="0.15" y1="0" x2="0.85" y2="1">
                <Stop offset="0" stopColor={colors.top} />
                <Stop offset="0.45" stopColor={colors.middle} />
                <Stop offset="1" stopColor={colors.deep} />
              </LinearGradient>
              <LinearGradient id={`gem-top-${id}`} x1="0" y1="0" x2="0.4" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.92" />
                <Stop offset="1" stopColor={colors.top} stopOpacity="0.55" />
              </LinearGradient>
            </Defs>
            <Path d={BODY} fill={`url(#gem-${id})`} stroke={colors.edge} strokeWidth="0.55" strokeLinejoin="round" />
            <Path d={TABLE} fill={`url(#gem-top-${id})`} opacity="0.95" />
            <Path d="M3.6 7.9 12 21.8 20.4 7.9Z" fill={colors.deep} opacity="0.22" />
            <Path d={GIRDLE} stroke={colors.edge} strokeOpacity="0.95" strokeWidth="0.55" fill="none" />
            <Path d={FAN} stroke={colors.edge} strokeOpacity="0.5" strokeWidth="0.35" fill="none" />
            <Path d={CROWN_EDGES} stroke={colors.edge} strokeOpacity="0.55" strokeWidth="0.35" fill="none" />
            <Path d="M9.6 3.6h4.6" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="0.6" strokeLinecap="round" fill="none" />
          </Svg>
        ) : (
          <Image
            source={GEM}
            resizeMode="contain"
            style={{ width: size, height: size }}
            accessibilityIgnoresInvertColors
          />
        )}
      </Animated.View>

      {/* Los tres destellos viven fuera de la gema, para que se vean brillar. */}
      <Animated.View style={[{ position: 'absolute', left: size * 0.68, top: -size * 0.02 }, starA]}>
        <Star size={star} color={colors.sparkle} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: -size * 0.03, top: size * 0.34 }, starB]}>
        <Star size={star * 0.78} color={colors.sparkle} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: size * 0.46, top: size * 0.82 }, starC]}>
        <Star size={star * 0.62} color={colors.sparkle} />
      </Animated.View>
    </View>
  );
}

/**
 * Un destello de cuatro puntas con su halo: el brillo tiene que leerse como
 * luz que sale de la piedra y no como una figura pegada encima.
 */
function Star({ size, color }: { size: number; color: string }) {
  const D = 'M12 0c.9 6.4 4.7 10.2 12 12-7.3 1.8-11.1 5.6-12 12-.9-6.4-4.7-10.2-12-12C7.3 10.2 11.1 6.4 12 0Z';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={D} fill={color} opacity="0.28" transform="translate(12 12) scale(1.5) translate(-12 -12)" />
      <Path d={D} fill={color} />
    </Svg>
  );
}
