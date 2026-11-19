import { useEffect, useRef } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { AvatarPhoto } from '@/components/avatar-photo';
import { SvipEntryArt } from '@/components/svip-pieces';
import type { RoomEntry } from '@/components/room-entry-banner';

/**
 * La entrada de una persona con su propio video: el clip ocupa la pantalla en
 * silencio, con su nombre en una tarjeta de oro. Se va al terminar el video,
 * cuando alguien toca la pantalla o, como red de seguridad, a los 15 segundos.
 */
export function EntryVideoOverlay({ entry, onDone }: { entry: RoomEntry & { video: string }; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const player = useVideoPlayer(entry.video, instance => {
    instance.loop = false;
    instance.muted = true;
    instance.volume = 0;
  });

  useEffect(() => {
    try {
      player.currentTime = 0;
      player.play();
    } catch {
      // Un teléfono que no puede abrir el clip cierra la entrada igual.
    }
    const ended = player.addListener('playToEnd', () => done.current());
    // La entrada nunca deja la sala esperando, aunque el video no cargue.
    const timer = setTimeout(() => done.current(), 15_500);
    return () => {
      clearTimeout(timer);
      ended.remove();
    };
  }, [player]);

  const level = Math.min(10, Math.max(0, Math.round(entry.svip) || 0));

  return (
    <Animated.View
      entering={FadeIn.duration(280)}
      exiting={FadeOut.duration(280)}
      style={StyleSheet.absoluteFill}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Cerrar la entrada de ${entry.name}`}
        onPress={() => done.current()}
        style={StyleSheet.absoluteFill}>
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
          pointerEvents="none"
        />

        {/* El clip se derrite en la sala por los bordes, sin cortes duros. */}
        <LinearGradient colors={['rgba(6,5,4,0.94)', 'rgba(6,5,4,0)']} style={styles.topFade} />
        <LinearGradient colors={['rgba(5,4,3,0)', 'rgba(5,4,3,0.86)', 'rgba(5,4,3,0.98)']} locations={[0, 0.55, 1]} style={styles.bottomFade} />
        <LinearGradient colors={['rgba(6,5,4,0.8)', 'rgba(6,5,4,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.leftFade} />
        <LinearGradient colors={['rgba(6,5,4,0)', 'rgba(6,5,4,0.8)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.rightFade} />

        {/* Esquinas de oro: el marco de una entrada de gala. */}
        <View style={[styles.corner, { top: 54, left: 18, borderTopWidth: 1.5, borderLeftWidth: 1.5 }]} />
        <View style={[styles.corner, { top: 54, right: 18, borderTopWidth: 1.5, borderRightWidth: 1.5 }]} />
        <View style={[styles.corner, { bottom: 148, left: 18, borderBottomWidth: 1.5, borderLeftWidth: 1.5 }]} />
        <View style={[styles.corner, { bottom: 148, right: 18, borderBottomWidth: 1.5, borderRightWidth: 1.5 }]} />

        <View style={styles.card}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarClip}>
              <AvatarPhoto uri={entry.avatar} name={entry.name} />
            </View>
          </View>
          <View style={{ flexShrink: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={styles.tag}>
                <Text style={styles.tagText}>ENTRADA</Text>
              </View>
              {level > 0 ? <SvipEntryArt level={level} size={20} /> : null}
            </View>
            <Text numberOfLines={1} style={styles.name}>{entry.name}</Text>
            <Text style={styles.caption}>entró a la sala</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Image source={require('@/assets/gold/gift/gift-corona.png')} style={styles.crest} resizeMode="contain" />
        </View>

        <Text style={styles.hint}>Toca para continuar</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topFade: { position: 'absolute', top: 0, left: 0, right: 0, height: 150 },
  bottomFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 240 },
  leftFade: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 64 },
  rightFade: { position: 'absolute', top: 0, bottom: 0, right: 0, width: 64 },
  corner: { position: 'absolute', width: 26, height: 26, borderColor: 'rgba(255,194,75,0.7)', borderRadius: 6 },
  card: {
    position: 'absolute', left: 24, right: 24, bottom: 82,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingLeft: 10, paddingRight: 14, paddingVertical: 10, borderRadius: 22,
    backgroundColor: 'rgba(16,12,9,0.9)',
    borderWidth: 1, borderColor: 'rgba(255,194,75,0.5)',
    shadowColor: '#FFC24B', shadowOpacity: 0.24, shadowRadius: 22, shadowOffset: { width: 0, height: 8 },
  },
  avatarRing: {
    width: 56, height: 56, borderRadius: 28, padding: 2.5,
    borderWidth: 1.5, borderColor: 'rgba(255,194,75,0.9)',
    backgroundColor: 'rgba(255,194,75,0.12)',
  },
  avatarClip: { flex: 1, borderRadius: 24, overflow: 'hidden', backgroundColor: '#2A2118' },
  tag: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2, backgroundColor: 'rgba(255,194,75,0.16)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.4)' },
  tagText: { color: '#FFC24B', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  name: { color: '#FFF7E8', fontSize: 19, fontWeight: '800', marginTop: 3 },
  caption: { color: 'rgba(255,240,220,0.6)', fontSize: 11.5, marginTop: 1 },
  crest: { width: 34, height: 34, opacity: 0.9 },
  hint: {
    position: 'absolute', left: 0, right: 0, bottom: 56, textAlign: 'center',
    color: 'rgba(255,244,226,0.5)', fontSize: 11.5, letterSpacing: 0.6,
  },
});
