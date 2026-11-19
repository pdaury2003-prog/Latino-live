import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

type Props = {
  /** Width and height of the square the ring lives in. */
  size: number;
  /** Bright, deep and highlight colours of the level. */
  colors: [string, string, string];
  /** Turns the motion off, for seats, dense lists and battery saving. */
  running?: boolean;
  /** A whole turn, in milliseconds. Slower levels read as calmer. */
  duration?: number;
  /** 1 to 4: the king's ring carries more light and more sparks. */
  level?: number;
};

/**
 * The living light around a frame: one comet of the level's colour travels the
 * ring while small sparks ride with it, and a slower counter-light crosses it
 * from the other side. Everything is driven by a single animation, so a profile
 * with a frame costs the same as a still picture once it is drawn.
 */
export function UltraHalo({ size, colors, running = true, duration = 8200, level = 1 }: Props) {
  const turn = useSharedValue(0);
  const uid = `ultra${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const stroke = Math.max(1.4, Math.round(size * 0.03));
  const radius = Math.max(1, size / 2 - stroke);
  const ring = 2 * Math.PI * radius;
  const arc = ring * (level >= 4 ? 0.46 : level >= 2 ? 0.38 : 0.3);

  useEffect(() => {
    if (!running) {
      turn.value = 0;
      return;
    }
    turn.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
  }, [turn, running, duration]);

  const spin = useAnimatedStyle(() => ({
    transform: [{ rotate: `${turn.value * 360}deg` }],
    opacity: 0.78 + 0.22 * Math.sin(turn.value * Math.PI * 4),
  }));

  const counter = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-turn.value * 170}deg` }],
    opacity: 0.16 + 0.16 * Math.sin(turn.value * Math.PI * 2),
  }));

  /*
   * Nothing is drawn when the light is still: a seat grid can hold twenty
   * frames, and twenty extra vector layers with a gradient each is exactly the
   * cost that makes a room answer late. A still frame keeps its own art.
   */
  if (size < 18 || !running) return null;

  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, spin]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`${uid}a`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors[2]} stopOpacity="0.95" />
              <Stop offset="0.45" stopColor={colors[0]} />
              <Stop offset="1" stopColor={colors[1]} stopOpacity="0.15" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${uid}a)`}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${arc} ${ring}`}
          />
          {/* The head of the comet: a small star where the light is strongest. */}
          <Circle cx={size / 2} cy={stroke} r={Math.max(1.6, stroke * 0.9)} fill={colors[2]} />
          <Circle cx={size / 2} cy={stroke} r={Math.max(2.6, stroke * 1.9)} fill={colors[0]} fillOpacity={0.32} />
          {level >= 2 ? (
            <>
              <Circle
                cx={size / 2 + radius * Math.cos(-0.5)}
                cy={size / 2 + radius * Math.sin(-0.5)}
                r={Math.max(1, stroke * 0.5)}
                fill="#FFFFFF"
                fillOpacity={0.85}
              />
              <Circle
                cx={size / 2 + radius * Math.cos(2.2)}
                cy={size / 2 + radius * Math.sin(2.2)}
                r={Math.max(0.9, stroke * 0.42)}
                fill={colors[0]}
                fillOpacity={0.7}
              />
            </>
          ) : null}
          {level >= 3 ? (
            <>
              <Circle
                cx={size / 2 + radius * Math.cos(1.1)}
                cy={size / 2 + radius * Math.sin(1.1)}
                r={Math.max(1, stroke * 0.55)}
                fill={colors[2]}
                fillOpacity={0.9}
              />
              <Circle
                cx={size / 2 + radius * Math.cos(3.9)}
                cy={size / 2 + radius * Math.sin(3.9)}
                r={Math.max(0.8, stroke * 0.4)}
                fill="#FFFFFF"
                fillOpacity={0.6}
              />
            </>
          ) : null}
        </Svg>
      </Animated.View>

      {/* The light that crosses from the other side, like a second reflection. */}
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, counter]}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`${uid}b`} x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors[1]} stopOpacity="0.0" />
              <Stop offset="1" stopColor={colors[2]} stopOpacity="0.9" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius - stroke * 1.2}
            fill="none"
            stroke={`url(#${uid}b)`}
            strokeWidth={Math.max(0.8, stroke * 0.45)}
            strokeLinecap="round"
            strokeDasharray={`${ring * 0.22} ${ring}`}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}
