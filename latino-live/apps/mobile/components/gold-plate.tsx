import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { CREATOR_PLATES, SVIP_BADGES, USER_PLATES } from '@/lib/gold';
import { imperialKit } from '@/lib/svip-imperial';
import { svipTheme } from '@/lib/svip';

/**
 * A shield drawn for levels that have no art of their own, so the number
 * printed on it is always the real one.
 */
function DrawnShield({ level, size }: { level: number; size: number }) {
  const theme = svipTheme(level);
  const ring = theme?.ring ?? ['#FFE39A', '#B8862B', '#FFF6D8'];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={`drawn${level}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ring[0]} />
            <Stop offset="0.55" stopColor={ring[1]} />
            <Stop offset="1" stopColor={ring[2]} />
          </LinearGradient>
          {/* A soft core under the number, so the metal reads as a lit badge
              and not as a flat silhouette. */}
          <RadialGradient id={`drawnCore${level}`} cx="50%" cy="42%" r="62%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.45" />
            <Stop offset="0.55" stopColor={ring[2]} stopOpacity="0.18" />
            <Stop offset="1" stopColor={ring[1]} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Path
          d="M12 1.4 21 4.8v7.4c0 4.7-3.8 8.7-9 10.4-5.2-1.7-9-5.7-9-10.4V4.8l9-3.4Z"
          fill={`url(#drawn${level})`}
          stroke="rgba(10,9,8,0.55)"
          strokeWidth="1.1"
        />
        {/* The bevel: an inner rim of the light colour, the mark of a metal
            shield at every size. */}
        <Path
          d="M12 3.1 19.3 5.9v6.3c0 3.9-3.1 7.2-7.3 8.7-4.2-1.5-7.3-4.8-7.3-8.7V5.9L12 3.1Z"
          fill={`url(#drawnCore${level})`}
          stroke={ring[2]}
          strokeOpacity="0.55"
          strokeWidth="0.5"
        />
        {/* The gem at the point of the shield. */}
        <Circle cx="12" cy="19.1" r="1.15" fill={ring[2]} fillOpacity="0.9" />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{
              color: theme?.onAccent ?? '#2A1B03',
              fontSize: Math.max(7, size * (level >= 10 ? 0.34 : 0.44)),
              fontWeight: '800',
              lineHeight: Math.max(9, size * 0.52),
            }}>
            {level}
          </Text>
        </View>
      </View>
    </View>
  );
}

/**
 * A name plate from the gold set. The art already carries its own lettering
 * ("USUARIO SVIP 3", "CREADOR TOP"), so it is used as an identity badge.
 */
export function UserPlate({ level, width = 132 }: { level: number; width?: number }) {
  if (Math.round(level) > 5) return null;
  const art = USER_PLATES[Math.min(5, Math.max(1, Math.round(level)))];
  if (!art) return null;
  const height = width * 0.4;
  return <Image source={art} resizeMode="contain" style={{ width, height }} accessibilityIgnoresInvertColors />;
}

export function CreatorPlate({ level = 'top', width = 150 }: { level?: keyof typeof CREATOR_PLATES | string; width?: number }) {
  const art = CREATOR_PLATES[String(level)] ?? CREATOR_PLATES.top;
  if (!art) return null;
  const height = width * 1.15;
  return <Image source={art} resizeMode="contain" style={{ width, height }} accessibilityIgnoresInvertColors />;
}

/** The big SVIP shield used as the badge of a level. */
export function SvipShield({ level, width = 96 }: { level: number; width?: number }) {
  // The imperial levels carry the medal from the owner's animation.
  const kit = imperialKit(level);
  if (kit) {
    return <Image source={kit.medal} resizeMode="contain" style={{ width, height: width }} accessibilityIgnoresInvertColors />;
  }
  const value = Math.round(level);
  if (value > 5) return <DrawnShield level={value} size={width} />;
  const art = SVIP_BADGES[Math.min(5, Math.max(1, value))];
  if (!art) return null;
  const height = width * 0.85;
  return <Image source={art} resizeMode="contain" style={{ width, height }} accessibilityIgnoresInvertColors />;
}

/** A small SVIP shield for a name row, with no text of its own. */
export function SvipShieldSmall({ level, size = 22 }: { level: number; size?: number }) {
  const kit = imperialKit(level);
  if (kit) {
    return (
      <View style={{ width: size, height: size }} accessibilityLabel={`Insignia SVIP ${kit.level} ${kit.name}`}>
        <Image source={kit.medal} resizeMode="contain" style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
      </View>
    );
  }
  const value = Math.round(level);
  if (value > 5) {
    return (
      <View style={{ width: size, height: size }} accessibilityLabel={`Insignia SVIP ${value}`}>
        <DrawnShield level={value} size={size} />
      </View>
    );
  }
  const art = SVIP_BADGES[Math.min(5, Math.max(1, value))];
  if (!art) return null;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`Insignia SVIP ${level}`}>
      <Image source={art} resizeMode="contain" style={{ width: size, height: size }} accessibilityIgnoresInvertColors />
    </View>
  );
}
