import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { levelBand } from '@/lib/levels';

type PlaqueProps = {
  level: number;
  /** Height of the plaque; the heart follows it. */
  height?: number;
};

/**
 * The level plaque: a gem heart on the left and the number on a rounded bar,
 * tinted by the band the person has reached.
 */
export function LevelPlaque({ level, height = 22 }: PlaqueProps) {
  const band = levelBand(level);
  const width = Math.round(height * 2.55);
  const heart = height * 1.18;
  return (
    <View
      accessibilityLabel={`Nivel ${level}, ${band.name}`}
      style={{ width, height: heart, justifyContent: 'center' }}>
      <Svg width={width} height={heart} viewBox={`0 0 ${width} ${heart}`}>
        <Defs>
          <LinearGradient id={`lvlBar${band.from}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={band.colors[0]} />
            <Stop offset="1" stopColor={band.colors[1]} />
          </LinearGradient>
        </Defs>
        {/* The bar behind the number, tucked under the heart. */}
        <Path
          d={`M ${height * 0.62} ${heart * 0.2}
              H ${width - height * 0.28}
              a ${height * 0.3} ${height * 0.3} 0 0 1 0 ${height * 0.6}
              H ${height * 0.62} Z`}
          fill={`url(#lvlBar${band.from})`}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={0.8}
        />
      </Svg>
      <View style={{ position: 'absolute', left: height * 0.55, top: 0, width: width - height * 0.55, height: heart, alignItems: 'center', justifyContent: 'center' }}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={{
            color: band.ink,
            fontSize: Math.round(height * 0.66),
            fontWeight: '800',
            textShadowColor: 'rgba(0,0,0,0.35)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 1,
          }}>
          {Math.max(0, Math.round(level))}
        </Text>
      </View>
      <View style={{ position: 'absolute', left: 0, top: 0, width: heart, height: heart }}>
        <Svg width={heart} height={heart} viewBox="0 0 24 24">
          <Defs>
            <LinearGradient id={`lvlHeart${band.from}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.95} />
              <Stop offset="0.5" stopColor={band.colors[1]} />
              <Stop offset="1" stopColor={band.colors[0]} />
            </LinearGradient>
          </Defs>
          <Path
            d="M12 21.2 3.9 13.4a5.4 5.4 0 0 1 0-7.6 5.2 5.2 0 0 1 7.4 0l.7.7.7-.7a5.2 5.2 0 0 1 7.4 0 5.4 5.4 0 0 1 0 7.6Z"
            fill={`url(#lvlHeart${band.from})`}
            stroke="rgba(255,255,255,0.75)"
            strokeWidth={1.1}
          />
          <Path d="M8.6 7.4a3 3 0 0 1 2.6-.6" stroke="#FFFFFF" strokeOpacity={0.8} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        </Svg>
      </View>
    </View>
  );
}

/** A tiny level chip for lines where the plaque would not fit. */
export function LevelChip({ level, size = 16 }: { level: number; size?: number }) {
  const band = levelBand(level);
  return (
    <View
      accessibilityLabel={`Nivel ${level}, ${band.name}`}
      style={{
        minWidth: size,
        height: size,
        paddingHorizontal: Math.max(3, size * 0.3),
        borderRadius: size / 2,
        backgroundColor: band.colors[0],
        borderWidth: 1,
        borderColor: band.colors[1],
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text allowFontScaling={false} style={{ color: band.ink, fontSize: Math.round(size * 0.6), fontWeight: '800' }}>
        {Math.max(0, Math.round(level))}
      </Text>
    </View>
  );
}
