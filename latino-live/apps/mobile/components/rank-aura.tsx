import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { usePowerSettings } from '@/lib/power';

/**
 * The light behind a TOP frame: a warm pool of light under the plaque, two
 * soft clouds of colour turning in opposite directions, and embers rising.
 * Everything is a soft radial gradient over pure black, so the light adds to
 * the card instead of drawing a shape on it — no disc, no hard edge.
 */
const PALETTES: Record<number, { core: string; mid: string; deep: string; spark: string }> = {
  1: { core: '#FFE9AE', mid: '#FF9B2F', deep: '#5C2C00', spark: '#FFD873' },
  2: { core: '#D6EBFF', mid: '#4F9BFF', deep: '#082A4E', spark: '#9FD0FF' },
  3: { core: '#EFD8FF', mid: '#A85CFF', deep: '#2E0A57', spark: '#D9A8FF' },
};

/** Fixed seeds, so the embers sit in the same columns on every render. */
const EMBERS = [
  { x: 0.16, size: 2.6, delay: 0, duration: 3800, drift: 9 },
  { x: 0.29, size: 2, delay: 1000, duration: 4300, drift: -7 },
  { x: 0.41, size: 3, delay: 1900, duration: 3500, drift: 6 },
  { x: 0.54, size: 2, delay: 500, duration: 4700, drift: -9 },
  { x: 0.66, size: 2.8, delay: 2500, duration: 4000, drift: 8 },
  { x: 0.77, size: 2, delay: 1400, duration: 4500, drift: -6 },
  { x: 0.87, size: 2.4, delay: 3000, duration: 3700, drift: 7 },
  { x: 0.23, size: 1.8, delay: 3300, duration: 4200, drift: 5 },
  { x: 0.61, size: 1.8, delay: 2100, duration: 4900, drift: -8 },
];

type Props = {
  rank: number;
  width: number;
  height: number;
};

export function RankAura({ rank, width, height }: Props) {
  const saver = usePowerSettings().battery;
  const palette = PALETTES[rank] ?? PALETTES[1];
  const turnA = useRef(new Animated.Value(0)).current;
  const turnB = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const embers = useRef(EMBERS.map(() => new Animated.Value(0))).current;

  // A box a little wider than the frame, so the light reaches past the wings.
  const boxW = width * 1.5;
  const boxH = height * 1.42;

  useEffect(() => {
    if (saver) {
      turnA.setValue(0);
      turnB.setValue(0);
      breathe.setValue(0.6);
      return;
    }
    const slow = Animated.loop(
      Animated.timing(turnA, {
        toValue: 1,
        duration: rank === 1 ? 28000 : rank === 2 ? 34000 : 24000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const reverse = Animated.loop(
      Animated.timing(turnB, {
        toValue: 1,
        duration: rank === 1 ? 40000 : rank === 2 ? 46000 : 36000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 2800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    slow.start();
    reverse.start();
    pulse.start();
    const sparks = embers.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(EMBERS[index].delay),
          Animated.timing(value, { toValue: 1, duration: EMBERS[index].duration, easing: Easing.linear, useNativeDriver: true }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    sparks.forEach(spark => spark.start());
    return () => {
      slow.stop();
      reverse.stop();
      pulse.stop();
      sparks.forEach(spark => spark.stop());
    };
  }, [turnA, turnB, breathe, embers, rank, saver]);

  const rotateA = turnA.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotateB = turnB.interpolate({ inputRange: [0, 1], outputRange: ['360deg', '0deg'] });
  const glowScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const cloudScaleA = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const cloudScaleB = breathe.interpolate({ inputRange: [0, 1], outputRange: [1.12, 0.98] });

  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', width: boxW, height: boxH, alignItems: 'center', justifyContent: 'center' }}>
      {/* The pool of light under the plaque, with the frame's own colours. */}
      <Animated.View
        style={{ position: 'absolute', width: boxW, height: boxH, opacity: glowOpacity, transform: [{ scale: glowScale }] }}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Defs>
            <RadialGradient id={`pool-${rank}`} cx="50" cy="55" rx="48" ry="38" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={palette.mid} stopOpacity="0.34" />
              <Stop offset="0.45" stopColor={palette.mid} stopOpacity="0.16" />
              <Stop offset="0.78" stopColor={palette.deep} stopOpacity="0.1" />
              <Stop offset="1" stopColor={palette.deep} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id={`core-${rank}`} cx="50" cy="50" r="26" gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={palette.core} stopOpacity="0.35" />
              <Stop offset="0.6" stopColor={palette.core} stopOpacity="0.1" />
              <Stop offset="1" stopColor={palette.core} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Ellipse cx="50" cy="55" rx="48" ry="38" fill={`url(#pool-${rank})`} />
          <Ellipse cx="50" cy="50" rx="26" ry="26" fill={`url(#core-${rank})`} />
        </Svg>
      </Animated.View>

      {/* Two clouds of colour turning in opposite directions, offset from the
          centre so the light never settles into a circle. */}
      <Animated.View style={{ position: 'absolute', width: boxW, height: boxH, transform: [{ rotate: rotateA }, { scale: cloudScaleA }] }}>
        <Cloud rank={rank} tone={palette.mid} id="a" cx={32} cy={44} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', width: boxW, height: boxH, transform: [{ rotate: rotateB }, { scale: cloudScaleB }] }}>
        <Cloud rank={rank} tone={palette.core} id="b" cx={68} cy={54} />
      </Animated.View>

      {/* Embers rising from the plaque. */}
      {EMBERS.map((ember, index) => {
        const value = embers[index];
        const translateY = value.interpolate({ inputRange: [0, 1], outputRange: [boxH * 0.24, -boxH * 0.36] });
        const drift = value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, ember.drift, ember.drift * 0.4] });
        const opacity = value.interpolate({ inputRange: [0, 0.12, 0.7, 1], outputRange: [0, 0.9, 0.7, 0] });
        const scale = value.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.6, 1, 0.65] });
        const column = boxW * 0.92 * (ember.x - 0.5);
        return (
          <Animated.View
            key={`ember-${index}`}
            style={{
              position: 'absolute',
              width: ember.size * 2,
              height: ember.size * 2,
              borderRadius: ember.size,
              backgroundColor: palette.spark,
              opacity,
              transform: [{ translateX: Animated.add(drift, column) }, { translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * One soft cloud of colour: a wide ellipse that fades to nothing at its edges,
 * drawn over black so it only ever adds light to the card underneath.
 */
function Cloud({ rank, tone, id, cx, cy }: { rank: number; tone: string; id: string; cx: number; cy: number }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`cloud-${rank}-${id}`} cx={cx} cy={cy} r="42" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={tone} stopOpacity="0.22" />
          <Stop offset="0.45" stopColor={tone} stopOpacity="0.09" />
          <Stop offset="1" stopColor={tone} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      {/* A full box, never an oval: the gradient is the only edge. */}
      <Rect x="0" y="0" width="100" height="100" fill={`url(#cloud-${rank}-${id})`} />
    </Svg>
  );
}
