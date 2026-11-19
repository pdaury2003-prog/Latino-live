import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';

/**
 * The room's own stage: a dark hall, two beams of light over the host and a
 * gold emblem on a plinth at the back, the way a live room is dressed.
 *
 * It is drawn here and not shipped as a picture, so it fits any phone and any
 * height without a single byte of art.
 */
export const RoomStage = memo(function RoomStage({ width, height }: { width: number; height: number }) {
  const wide = Math.max(width, 320);
  const tall = Math.max(height, 480);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The hall itself: almost black at the top, deep blue under the lights. */}
      <LinearGradient
        colors={['#070A1A', '#0E1436', '#131B45', '#080B1E']}
        locations={[0, 0.42, 0.72, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Two beams that fall on the host's place. */}
      <LinearGradient
        colors={['rgba(190,208,255,0.30)', 'rgba(130,160,255,0.12)', 'rgba(0,0,0,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: -tall * 0.05,
          left: wide * 0.5 - wide * 0.13,
          width: wide * 0.26,
          height: tall * 0.46,
          borderBottomLeftRadius: wide * 0.2,
          borderBottomRightRadius: wide * 0.2,
        }}
      />
      <LinearGradient
        colors={['rgba(160,180,255,0.20)', 'rgba(100,130,255,0.07)', 'rgba(0,0,0,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: -tall * 0.04,
          left: wide * 0.2,
          width: wide * 0.16,
          height: tall * 0.4,
          borderBottomLeftRadius: wide * 0.14,
          borderBottomRightRadius: wide * 0.14,
          opacity: 0.7,
        }}
      />
      <LinearGradient
        colors={['rgba(160,180,255,0.20)', 'rgba(100,130,255,0.07)', 'rgba(0,0,0,0)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: 'absolute',
          top: -tall * 0.04,
          right: wide * 0.2,
          width: wide * 0.16,
          height: tall * 0.4,
          borderBottomLeftRadius: wide * 0.14,
          borderBottomRightRadius: wide * 0.14,
          opacity: 0.7,
        }}
      />

      {/* The emblem of the house: a gold V over its plinth. */}
      <Svg
        width={wide}
        height={tall}
        viewBox={`0 0 ${wide} ${tall}`}
        style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="stageV" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#FFE7AE" stopOpacity={1} />
            <Stop offset="0.4" stopColor="#D9A94A" stopOpacity={0.95} />
            <Stop offset="1" stopColor="#7A5718" stopOpacity={0.5} />
          </SvgGradient>
          <SvgGradient id="stageFloor" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#8FA8FF" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#8FA8FF" stopOpacity={0} />
          </SvgGradient>
        </Defs>

        {/* The floor under the emblem. */}
        <Ellipse cx={wide / 2} cy={tall * 0.66} rx={wide * 0.46} ry={tall * 0.085} fill="url(#stageFloor)" />

        {/* A wide V, the shape the hall is built around. */}
        <Path
          d={`M ${wide * 0.22} ${tall * 0.42}
              L ${wide * 0.5} ${tall * 0.66}
              L ${wide * 0.78} ${tall * 0.42}
              L ${wide * 0.68} ${tall * 0.42}
              L ${wide * 0.5} ${tall * 0.57}
              L ${wide * 0.32} ${tall * 0.42} Z`}
          fill="url(#stageV)"
          opacity={0.5}
        />
        <Path
          d={`M ${wide * 0.36} ${tall * 0.42}
              L ${wide * 0.5} ${tall * 0.535}
              L ${wide * 0.64} ${tall * 0.42}
              L ${wide * 0.58} ${tall * 0.42}
              L ${wide * 0.5} ${tall * 0.49}
              L ${wide * 0.42} ${tall * 0.42} Z`}
          fill="url(#stageV)"
          opacity={0.45}
        />

        {/* Its plinth, lit from the front. */}
        <Path
          d={`M ${wide * 0.34} ${tall * 0.672} L ${wide * 0.66} ${tall * 0.672} L ${wide * 0.72} ${tall * 0.717} L ${wide * 0.28} ${tall * 0.717} Z`}
          fill="#121834"
          opacity={0.9}
        />
        <Path
          d={`M ${wide * 0.28} ${tall * 0.717} L ${wide * 0.72} ${tall * 0.717}`}
          stroke="rgba(216,177,92,0.75)"
          strokeWidth={1.5}
        />
      </Svg>

      {/* The dark that keeps the room's words readable over the stage. */}
      <LinearGradient
        colors={['rgba(2,4,10,0.55)', 'rgba(2,4,10,0.05)', 'rgba(2,4,10,0.72)']}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

