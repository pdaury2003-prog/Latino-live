import { type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { ALL_FRAMES } from '@/lib/gold';
import { svipLevelOf, svipTheme } from '@/lib/svip';
import { imperialKit } from '@/lib/svip-imperial';
import { svipKit } from '@/lib/svip-kit';
import { frameFit } from '@/lib/frame-fit';
import { ImperialAvatarFrame, ImperialMedal, ImperialTag } from '@/components/imperial-svip';
import { SvipKitAvatar, SvipKitPlate } from '@/components/svip-kit';
import { SEAT_FRAME_SCALE } from '@/components/framed-avatar';
import { useMotion } from '@/lib/power';
import { UltraHalo } from '@/components/ultra-halo';

type FrameProps = {
  level: number;
  /** Total width and height of the frame, avatar included. */
  size: number;
  children: ReactNode;
  /** Shows the level medal on the lower right corner. */
  medal?: boolean;
  /** Turns the ring off where many frames share the screen, such as seats. */
  animated?: boolean;
  /** Width of the photo as a share of the whole frame. */
  inner?: number;
  /**
   * Seat size: the imperial plaque becomes a ring of the seat's own size, so the
   * photo is as large as in any other seat instead of the plaque's small centre.
   */
  seat?: boolean;
};

/**
 * The animated SVIP frame: a ring of light that travels around the avatar,
 * slower and richer with every level, with the medal on top.
 */
export function SvipAvatarFrame({ level, size, children, medal = true, animated = true, inner: innerRatio = 0.7, seat = false }: FrameProps) {
  const theme = svipTheme(level);
  const motion = useMotion() && animated;
  const safeLevel = svipLevelOf(level);
  const ringWidth = Math.max(2.5, Math.round(size * 0.045));
  const inner = size * innerRatio;
  const radius = (size - ringWidth) / 2;
  const wing = size * 0.22;

  if (!theme) return <View style={{ width: size, height: size }}>{children}</View>;

  // The levels that came with their own sheet wear that art.
  const kit = svipKit(safeLevel);
  if (kit) {
    return (
      <SvipKitAvatar level={safeLevel} size={size} animated={animated}>
        {children}
      </SvipKitAvatar>
    );
  }

  // The imperial levels wear the kit the owner supplied.
  const imperial = imperialKit(safeLevel);
  if (seat && imperial) {
    // The frame fills its box; the photo keeps the plaque's own opening, so a
    // bigger frame never makes the seat, or the face, bigger.
    const photo = size * imperial.opening;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: photo, height: photo, borderRadius: photo / 2, overflow: 'hidden' }}>{children}</View>
        <Image
          source={imperial.frame}
          resizeMode="contain"
          style={{ position: 'absolute', width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }


  if (imperial) {
    return <ImperialAvatarFrame kit={imperial} size={size} medal={medal} animated={animated}>{children}</ImperialAvatarFrame>;
  }

  const ringColors: [string, string, string] = theme.ring;
  const glowColor = theme.accent;

  const art = ALL_FRAMES.find(item => item.key === theme.frame)?.art;
  if (art) {
    if (seat) {
      // A seat gets the whole face and the frame drawn a little larger over it.
      const drawn = size * SEAT_FRAME_SCALE;
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>{children}</View>
          <Image
            source={art}
            resizeMode="contain"
            style={{ position: 'absolute', width: drawn, height: drawn }}
            accessibilityIgnoresInvertColors
          />
        </View>
      );
    }
    // Same measured opening the bought frames use, so the photo is not cropped.
    const fit = frameFit(theme.frame);
    const boxWidth = (size * 133) / 162;
    const left = (size - boxWidth) / 2;
    const side = fit ? size * fit.diameter : size * innerRatio;
    const centerX = fit ? left + boxWidth * fit.cx : size / 2;
    const centerY = fit ? size * fit.cy : size / 2;
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            position: 'absolute',
            width: side,
            height: side,
            borderRadius: side / 2,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            left: centerX - side / 2,
            top: centerY - side / 2,
          }}>
          {children}
        </View>
        <Image
          source={art}
          resizeMode="contain"
          style={{ position: 'absolute', width: size, height: size }}
          accessibilityIgnoresInvertColors
        />
        {medal ? (
          <View style={{ position: 'absolute', right: -2, bottom: -1 }}>
            <SvipMedal level={safeLevel} size={Math.max(16, Math.round(size * 0.28))} />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size + 6,
          height: size + 6,
          borderRadius: (size + 6) / 2,
          backgroundColor: glowColor,
          opacity: 0.16,
        }}
      />
      {/*
        The ring, its wings and the crown stay where they belong: only the
        light in UltraHalo travels. Rotating this whole drawing used to turn
        the wings and the crown with it, which read as a mistake.
      */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`svipRing${safeLevel}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={ringColors[0]} />
              <Stop offset="0.55" stopColor={ringColors[1]} />
              <Stop offset="1" stopColor={ringColors[2]} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#svipRing${safeLevel})`}
            strokeWidth={ringWidth}
            strokeLinecap="round"
            strokeDasharray={`${radius * 4.4} ${radius * 2.2}`}
            strokeOpacity={0.85}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColors[0]}
            strokeWidth={ringWidth * 0.6}
            strokeLinecap="round"
            strokeDasharray={`${radius * 0.9} ${radius * 5.7}`}
          />
          {safeLevel >= 2 ? (
            <>
              {/* Gilded wings on both sides, like the SVIP frames of the video. */}
              <Path
                d={`M ${size * 0.5 - radius * 0.72} ${size * 0.5} q ${-wing * 0.75} ${-wing * 0.6} ${-wing * 0.2} ${-wing * 1.35} q ${wing * 0.42} ${wing * 0.5} ${wing * 0.95} ${wing * 0.62} Z`}
                fill={`url(#svipRing${safeLevel})`}
                fillOpacity={0.85}
              />
              <Path
                d={`M ${size * 0.5 + radius * 0.72} ${size * 0.5} q ${wing * 0.75} ${-wing * 0.6} ${wing * 0.2} ${-wing * 1.35} q ${-wing * 0.42} ${wing * 0.5} ${-wing * 0.95} ${wing * 0.62} Z`}
                fill={`url(#svipRing${safeLevel})`}
                fillOpacity={0.85}
              />
            </>
          ) : null}
          {safeLevel >= 3 ? (
            <Circle cx={size / 2} cy={ringWidth} r={Math.max(1.6, size * 0.028)} fill="#FFF7E2" />
          ) : null}
          {safeLevel >= 4 ? (
            <Path
              d={`M ${size / 2 - wing * 0.5} ${wing * 0.6} L ${size / 2} ${-wing * 0.28} L ${size / 2 + wing * 0.5} ${wing * 0.6} L ${size / 2} ${wing * 0.34} Z`}
              fill={`url(#svipRing${safeLevel})`}
              stroke="#FFF3D6"
              strokeWidth={0.8}
            />
          ) : null}
        </Svg>
      </View>
      <UltraHalo
        size={size}
        colors={[theme.ring[2], theme.ring[1], theme.ring[0]]}
        running={motion}
        level={safeLevel}
        duration={safeLevel >= 4 ? 5200 : safeLevel >= 2 ? 6400 : 7600}
      />
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          overflow: 'hidden',
          borderWidth: 1.5,
          borderColor: 'rgba(10,9,8,0.9)',
        }}>
        {children}
      </View>
      {medal ? (
        <View style={{ position: 'absolute', right: -2, bottom: -1 }}>
          <SvipMedal level={safeLevel} size={Math.max(16, Math.round(size * 0.28))} />
        </View>
      ) : null}
    </View>
  );
}

/**
 * The medal of a level: a shield in the level colour with its number inside.
 */
export function SvipMedal({ level, size = 20 }: { level: number; size?: number }) {
  const theme = svipTheme(level);
  if (!theme) return null;
  const kit = imperialKit(theme.level);
  if (kit) return <ImperialMedal kit={kit} size={size} />;
  return (
    <View
      accessibilityLabel={`Insignia ${theme.name}`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          <LinearGradient id={`svipMedal${theme.level}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.ring[0]} />
            <Stop offset="0.5" stopColor={theme.ring[1]} />
            <Stop offset="1" stopColor={theme.ring[2]} />
          </LinearGradient>
        </Defs>
        <Path
          d="M12 1.6 21 5v7.2c0 4.6-3.8 8.5-9 10.2-5.2-1.7-9-5.6-9-10.2V5l9-3.4Z"
          fill={`url(#svipMedal${theme.level})`}
          stroke="rgba(10,9,8,0.55)"
          strokeWidth="1.2"
        />
      </Svg>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            allowFontScaling={false}
            style={{ color: theme.onAccent, fontSize: Math.max(8, size * 0.5), fontWeight: '800', lineHeight: Math.max(9, size * 0.58) }}>
            {theme.level}
          </Text>
        </View>
      </View>
    </View>
  );
}

/** A compact chip with the level, for names and lists. */
export function SvipChip({ level, small = false }: { level: number; small?: boolean }) {
  const theme = svipTheme(level);
  if (!theme) return null;
  const kit = svipKit(theme.level);
  if (kit) return <SvipKitPlate level={theme.level} width={small ? 52 : 68} />;
  const imperial = imperialKit(theme.level);
  if (imperial) return <ImperialTag kit={imperial} width={small ? 46 : 58} />;
  return (
    <View
      accessibilityLabel={theme.name}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: small ? 5 : 7,
        height: small ? 15 : 18,
        borderRadius: 999,
        backgroundColor: theme.accent,
      }}>
      <Text
        allowFontScaling={false}
        style={{ color: theme.onAccent, fontSize: small ? 9 : 10, fontWeight: '800', letterSpacing: 0.2 }}>
        SVIP {theme.level}
      </Text>
    </View>
  );
}

