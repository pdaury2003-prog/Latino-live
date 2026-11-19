import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Polygon, RadialGradient, Stop } from 'react-native-svg';
import { usePowerSettings } from '@/lib/power';

const FLAME_LEFT =
  'M60 170 C22 150 24 116 44 92 C54 78 62 62 57 40 C80 56 96 82 90 108 C102 96 104 80 101 68 C124 95 128 132 102 156 C91 167 76 174 60 170 Z';
const FLAME_MID =
  'M55 170 C25 152 28 124 45 104 C52 95 57 86 55 74 C69 84 78 100 74 116 C82 109 84 100 83 92 C96 108 99 132 82 152 C74 162 65 168 55 170 Z';
const BOLT = '40,0 18,58 34,58 14,120 52,50 35,50 54,0';

/** One flame tongue that sways and stretches, always from the bottom of the screen. */
function Flame({
  left,
  size,
  colors,
  delay,
  core = '#FFE7B0',
}: {
  left: `${number}%`;
  size: number;
  colors: [string, string];
  delay: number;
  core?: string;
}) {
  const sway = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(sway, { toValue: 1, duration: 2600 + delay * 120, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(sway, { toValue: 0, duration: 2600 + delay * 120, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(breathe, { toValue: 1, duration: 1400 + delay * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(breathe, { toValue: 0, duration: 1400 + delay * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sway, breathe, delay]);

  const style = {
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
    transform: [
      { translateY: breathe.interpolate({ inputRange: [0, 1], outputRange: [6, -4] }) },
      { scaleY: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }) },
      { translateX: sway.interpolate({ inputRange: [0, 1], outputRange: [-8, 8] }) },
      { rotate: sway.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] }) },
    ],
  } as const;

  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', bottom: -size * 0.32, left, width: size, height: size }, style]}>
      <Svg width={(size * 0.88) | 0} height={size} viewBox="0 0 140 180">
        <Defs>
          <LinearGradient id={`flame-${left}-${size}`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor={colors[0]} stopOpacity="0.95" />
            <Stop offset="0.55" stopColor={colors[1]} stopOpacity="0.75" />
            <Stop offset="1" stopColor={colors[1]} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={FLAME_LEFT} fill={`url(#flame-${left}-${size})`} />
        {/* A bright core: without it the tongues read as grey smoke. */}
        <Path d={FLAME_MID} fill={colors[1]} fillOpacity={0.55} transform="translate(34 24) scale(0.68)" />
        <Path d={FLAME_MID} fill={core} fillOpacity={0.28} transform="translate(52 60) scale(0.44)" />
      </Svg>
    </Animated.View>
  );
}

/** A lightning strike that flashes every few seconds, over the fire. */
function Bolt({
  left,
  top,
  size,
  delay,
  tones = ['#FFF6DA', '#FFD36B', '#FF7A3C'],
  rim = '#FFF2C9',
}: {
  left: number;
  top: number;
  size: number;
  delay: number;
  tones?: [string, string, string];
  rim?: string;
}) {
  const flash = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const strike = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0.25, duration: 90, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 620, useNativeDriver: true }),
      Animated.delay(4200),
    ]);
    const loop = Animated.loop(strike);
    loop.start();
    return () => loop.stop();
  }, [flash, delay]);

  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', left, top, width: size, height: size * 2, opacity: flash }}>
      <Svg width={size} height={size * 2} viewBox="0 0 60 120">
        <Defs>
          <LinearGradient id={`bolt-${left}-${top}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={tones[0]} />
            <Stop offset="0.5" stopColor={tones[1]} />
            <Stop offset="1" stopColor={tones[2]} stopOpacity="0.2" />
          </LinearGradient>
        </Defs>
        <Polygon points={BOLT} fill={`url(#bolt-${left}-${top})`} />
        <Polygon points={BOLT} fill="none" stroke={rim} strokeWidth="1.2" strokeOpacity="0.7" />
      </Svg>
    </Animated.View>
  );
}

/** Small sparks that drift up from the fire, then fade. */
function Embers({ tint }: { tint: string }) {
  const sparks = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    const loops = sparks.map((value, index) => {
      value.setValue(0);
      const loop = Animated.loop(
        Animated.sequence([
          Animated.delay(index * 420),
          Animated.timing(value, { toValue: 1, duration: 3400 + (index % 4) * 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      );
      loop.start();
      return loop;
    });
    return () => loops.forEach(loop => loop.stop());
  }, [sparks]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {sparks.map((value, index) => {
        const left = 6 + ((index * 37) % 88);
        const size = index % 3 === 0 ? 5 : 3;
        return (
          <Animated.View
            key={index}
            style={{
              position: 'absolute',
              left: `${left}%`,
              bottom: 40 + (index % 5) * 26,
              width: size,
              height: size,
              borderRadius: size,
              backgroundColor: tint,
              opacity: value.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.85, 0.5, 0] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -230 - (index % 4) * 60] }) },
                { translateX: value.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, index % 2 === 0 ? 18 : -18, 0] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}

/**
 * The warm fire behind the welcome screen: slow flames at the bottom, a couple
 * of lightning strikes and embers drifting up. It sits behind the form and is
 * non-interactive, so typing and buttons work exactly as before.
 */
export function FireBackdrop({ night = true }: { night?: boolean }) {
  const saver = usePowerSettings().battery;
  const glow = useRef(new Animated.Value(0)).current;
  /**
   * Las lenguas del fondo cambian con la noche: brasa naranja en el modo
   * ámbar y violeta encendido en el modo violeta, para que el fuego no
   * desentone con la paleta que lo rodea.
   */
  const tongues: { left: `${number}%`; size: number; colors: [string, string]; delay: number }[] = night
    ? [
        { left: '-10%', size: 250, colors: ['#FF4D12', '#FFB347'], delay: 0 },
        { left: '12%', size: 190, colors: ['#FF7A1F', '#FFD98A'], delay: 2 },
        { left: '34%', size: 230, colors: ['#FF5A14', '#FFC05A'], delay: 4 },
        { left: '56%', size: 260, colors: ['#FF4D12', '#FFB347'], delay: 1 },
        { left: '76%', size: 200, colors: ['#FF8A2B', '#FFE1A8'], delay: 3 },
        { left: '90%', size: 170, colors: ['#FF6A1F', '#FFD27A'], delay: 5 },
      ]
    : [
        // De día el mismo fuego se lee como oro sobre papel, no como neón.
        { left: '-10%', size: 250, colors: ['#D9A63F', '#F3D79A'], delay: 0 },
        { left: '12%', size: 190, colors: ['#E0B455', '#F8E6BB'], delay: 2 },
        { left: '34%', size: 230, colors: ['#C79A3E', '#F1D9A4'], delay: 4 },
        { left: '56%', size: 260, colors: ['#D9A63F', '#F3D79A'], delay: 1 },
        { left: '76%', size: 200, colors: ['#E5BC63', '#FBEECB'], delay: 3 },
        { left: '90%', size: 170, colors: ['#CFA24A', '#F5E0B4'], delay: 5 },
      ];
  useEffect(() => {
    if (saver) {
      glow.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, saver]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="fire-glow" cx="50%" cy="100%" r="95%">
            <Stop offset="0" stopColor={night ? '#C24308' : '#E7C079'} stopOpacity={night ? '0.92' : '0.55'} />
            <Stop offset="0.45" stopColor={night ? '#651F05' : '#F2DCB4'} stopOpacity={night ? '0.72' : '0.5'} />
            <Stop offset="1" stopColor={night ? '#0C0709' : '#F1EFEA'} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="ember-haze" cx="18%" cy="92%" r="40%">
            <Stop offset="0" stopColor={night ? '#FF8A3D' : '#C79A3E'} stopOpacity="0.35" />
            <Stop offset="1" stopColor={night ? '#FF8A3D' : '#C79A3E'} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path d="M0 844 L0 380 Q 195 250 390 400 L390 844 Z" fill="url(#fire-glow)" />
        <Circle cx="60" cy="830" r="250" fill="url(#ember-haze)" />
        <Circle cx="340" cy="840" r="230" fill="url(#ember-haze)" />
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 400,
          opacity: glow.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.9] }),
        }}>
        <Svg width="100%" height="100%" viewBox="0 0 390 400" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="floor-fire" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor={night ? '#FF6A1F' : '#D9A63F'} stopOpacity={night ? '0.55' : '0.4'} />
              <Stop offset="0.45" stopColor={night ? '#B32B06' : '#C79A3E'} stopOpacity={night ? '0.28' : '0.22'} />
              <Stop offset="1" stopColor={night ? '#B32B06' : '#C79A3E'} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Path
            d="M0 400 L0 292 C 40 262 58 306 84 278 C 112 244 128 302 156 272 C 186 238 202 306 232 274 C 262 240 282 300 310 270 C 338 240 360 296 390 266 L390 400 Z"
            fill="url(#floor-fire)"
          />
        </Svg>
      </Animated.View>

      {saver ? null : (
        <>
          {tongues.map(tongue => (
            <Flame
              key={tongue.left}
              left={tongue.left}
              size={tongue.size}
              colors={tongue.colors}
              core={night ? '#FFE7B0' : '#FFF8E6'}
              delay={tongue.delay}
            />
          ))}

          {/* Strikes stay away from the emblem and the form, near the lower corners. */}
          <Bolt
            left={292}
            top={596}
            size={56}
            delay={900}
            tones={night ? ['#FFF6DA', '#FFD36B', '#FF7A3C'] : ['#FFFDF6', '#E8C67F', '#C79A3E']}
            rim={night ? '#FFF2C9' : '#FFFDF6'}
          />
          <Bolt
            left={40}
            top={612}
            size={44}
            delay={3600}
            tones={night ? ['#FFF6DA', '#FFD36B', '#FF7A3C'] : ['#FFFDF6', '#E8C67F', '#C79A3E']}
            rim={night ? '#FFF2C9' : '#FFFDF6'}
          />

          <Embers tint={night ? '#FFC24B' : '#C79A3E'} />
        </>
      )}
    </View>
  );
}
