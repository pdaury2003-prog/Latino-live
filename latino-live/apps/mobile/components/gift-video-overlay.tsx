import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useDataSaver } from '@/lib/power';

export type GiftVideoKey = 'tigre' | 'demonio';

/** The animated gift videos shipped with the app. */
export const GIFT_VIDEOS: Record<GiftVideoKey, { name: string; source: number }> = {
  tigre: { name: 'Tigre de fuego', source: require('@/assets/gifts/tigre.mp4') },
  demonio: { name: 'Demonio de fuego', source: require('@/assets/gifts/demonio.mp4') },
};

export type GiftVideoPlaying = {
  key: GiftVideoKey;
  sender: string;
  recipient?: string | null;
};

/**
 * A gift video played over the whole room: the video is slightly translucent,
 * so the room shows through, and its edges melt into the screen instead of
 * ending in a hard rectangle.
 */
export function GiftVideoOverlay({ gift, onDone }: { gift: GiftVideoPlaying | null; onDone: () => void }) {
  const asset = gift ? GIFT_VIDEOS[gift.key] : null;
  const dataSaver = useDataSaver();
  const player = useVideoPlayer(asset && !dataSaver ? asset.source : null, instance => {
    instance.loop = false;
    instance.muted = false;
  });

  useEffect(() => {
    if (!gift) return;
    if (dataSaver) {
      // Data saving keeps the announcement and the card, without the clip.
      const still = setTimeout(onDone, 3400);
      return () => clearTimeout(still);
    }
    try {
      player.currentTime = 0;
      player.play();
    } catch {
      // A phone that cannot decode the clip still closes the overlay on time.
    }
    const timer = setTimeout(onDone, 10_500);
    return () => clearTimeout(timer);
  }, [gift, player, onDone, dataSaver]);

  useEffect(() => {
    if (!gift || dataSaver) return;
    // A clip that ends early closes the overlay; the timer is just the safety net.
    const ended = player.addListener('playToEnd', () => onDone());
    return () => ended.remove();
  }, [gift, player, onDone, dataSaver]);

  if (!gift || !asset) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      exiting={FadeOut.duration(240)}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      {/* Blurred copy behind gives the soft, out-of-focus frame. */}
      {dataSaver ? (
        <LinearGradient
          colors={['rgba(24,10,36,0.96)', 'rgba(12,7,18,0.97)', 'rgba(6,5,4,0.98)']}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <>
          <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { opacity: 0.85 }]}>
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          </View>
        </>
      )}

      {/* The edges and the four corners melt the clip into the room. */}
      <LinearGradient colors={['rgba(6,5,4,0.98)', 'rgba(6,5,4,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }} />
      <LinearGradient colors={['rgba(6,5,4,0)', 'rgba(6,5,4,0.98)']} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 150 }} />
      <LinearGradient colors={['rgba(6,5,4,0.92)', 'rgba(6,5,4,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 74 }} />
      <LinearGradient colors={['rgba(6,5,4,0)', 'rgba(6,5,4,0.92)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: 74 }} />
      {([
        { key: 'tl', style: { top: 0, left: 0 }, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
        { key: 'tr', style: { top: 0, right: 0 }, start: { x: 1, y: 0 }, end: { x: 0, y: 1 } },
        { key: 'bl', style: { bottom: 0, left: 0 }, start: { x: 0, y: 1 }, end: { x: 1, y: 0 } },
        { key: 'br', style: { bottom: 0, right: 0 }, start: { x: 1, y: 1 }, end: { x: 0, y: 0 } },
      ] as const).map(corner => (
        <LinearGradient
          key={corner.key}
          colors={['rgba(6,5,4,0.85)', 'rgba(6,5,4,0)']}
          start={corner.start}
          end={corner.end}
          style={{ position: 'absolute', width: 120, height: 120, ...corner.style }}
        />
      ))}

      {/* The gift card, over the bottom fade. */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 46, alignItems: 'center', paddingHorizontal: 20 }}>
        <View
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            paddingLeft: 8, paddingRight: 16, paddingVertical: 8, borderRadius: 999,
            backgroundColor: 'rgba(14,10,8,0.86)', borderWidth: 1, borderColor: 'rgba(240,170,70,0.55)',
          }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, overflow: 'hidden', backgroundColor: '#3A1C0C' }}>
            <Image source={require('@/assets/gold/gift/gift-corona.png')} style={{ width: 34, height: 34 }} resizeMode="contain" />
          </View>
          <View style={{ flexShrink: 1 }}>
            <Text numberOfLines={1} style={{ color: '#FFF4E2', fontSize: 14, fontWeight: '800' }}>
              {gift.sender} envió {asset.name}
            </Text>
            <Text style={{ color: 'rgba(255,244,226,0.66)', fontSize: 11, marginTop: 1 }}>
              {gift.recipient ? `para ${gift.recipient}` : 'a toda la sala'}
            </Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
