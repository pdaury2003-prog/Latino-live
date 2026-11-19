import type { ReactNode } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * The ring every seat wears: the portrait fills the whole circle and a thin,
 * bright band of gold is drawn just inside its edge, the way the hall's
 * portraits are framed. A closed seat keeps the same silhouette in cold grey,
 * so the hall still reads as a hall when the host locks it.
 */
export function SeatRing({
  size,
  children,
  locked = false,
  speaking = false,
  bare = false,
  goldPlace = false,
  square = false,
}: {
  size: number;
  children: ReactNode;
  locked?: boolean;
  speaking?: boolean;
  /** The child brings its own ring, so none is drawn over it. */
  bare?: boolean;
  /** A design's host place: a brighter gold rim around an empty seat. */
  goldPlace?: boolean;
  /**
   * A camera place: the frame becomes a rounded square, the shape a live
   * picture is shown in, instead of the portrait's circle.
   */
  square?: boolean;
}) {
  // A narrow metallic band, the width of the one on the hall's portraits: the
  // gold runs from a dark edge through a bright face and out again, so it reads
  // as metal and not as a painted circle.
  const band = bare ? 0 : Math.max(2, Math.round(size * 0.035));
  const inner = size - band * 2;
  const radius = square ? Math.round(size * 0.22) : size / 2;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: locked ? '#000000' : '#F2CE86',
        shadowOpacity: speaking ? 0.55 : 0.22,
        shadowRadius: speaking ? 14 : 8,
        shadowOffset: { width: 0, height: 0 },
        elevation: speaking ? 9 : 4,
      }}>
      {bare ? null : (
        <LinearGradient
          colors={locked
            ? ['#8A909C', '#C2C7D0', '#7B818D', '#A9AFBA']
            : ['#B78E33', '#EFD189', '#E2BA63', '#C69B3E', '#9C7526']}
          locations={locked ? [0, 0.35, 0.7, 1] : [0, 0.28, 0.6, 0.84, 1]}
          start={{ x: 0.05, y: 0 }}
          end={{ x: 0.95, y: 1 }}
          style={{ position: 'absolute', width: size, height: size, borderRadius: radius }}
        />
      )}
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: square ? Math.max(2, Math.round(inner * 0.2)) : inner / 2,
          overflow: 'hidden',
          backgroundColor: locked ? '#1B1D22' : '#141A26',
        }}>
        {children}
      </View>
      {/* A hairline where the metal meets the picture, so the rim keeps a
          clean edge at any size. */}
      {goldPlace && !locked ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: 2,
            borderColor: 'rgba(250,199,117,0.9)',
          }}
        />
      ) : null}
      {bare ? null : (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: inner,
            height: inner,
            borderRadius: square ? Math.max(2, Math.round(inner * 0.2)) : inner / 2,
            borderWidth: 1,
            borderColor: locked ? 'rgba(0,0,0,0.35)' : 'rgba(60,40,10,0.45)',
          }}
        />
      )}
    </View>
  );
}
