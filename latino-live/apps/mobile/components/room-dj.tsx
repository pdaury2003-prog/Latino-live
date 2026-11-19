import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Disc3, ListMusic, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Upload, Volume2, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { audioModule } from '@/lib/device-media';
import { pickAudioFromDevice } from '@/lib/pick-audio';
import { capped } from '@/lib/responsive';
import {
  addToPlaylist,
  deleteTrack,
  formatSongTime,
  getPlayback,
  getRoomDj,
  listMyTracks,
  listPlaylist,
  pauseForRoom,
  playForRoom,
  playheadMs,
  removeFromPlaylist,
  setRoomVolume,
  uploadTrack,
  useRommDjLive,
  type DjTrack,
  type PlaybackRow,
  type SongInRoom,
} from '@/lib/dj';
import { cn } from '@/lib/utils';

type Props = {
  roomId: string;
  isHost: boolean;
  canModerate: boolean;
  onFlash: (text: string) => void;
};

const DISC = 58;

/**
 * The room DJ: one shared song for everyone, a playlist of ten, and a floating
 * record made of the app logo. The disc can be dragged anywhere in the room.
 */
export function RoomDj({ roomId, isHost, canModerate, onFlash }: Props) {
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [songs, setSongs] = useState<SongInRoom[]>([]);
  const [playback, setPlayback] = useState<PlaybackRow | null>(null);
  const [djId, setDjId] = useState<string | null>(null);
  const [library, setLibrary] = useState<DjTrack[]>([]);
  const [busy, setBusy] = useState<'upload' | 'play' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [loaded, setLoaded] = useState(false);

  const meId = session?.user.id ?? null;
  const isDj = canModerate || Boolean(djId && djId === meId);
  const current = useMemo(
    () => songs.find(song => song.track_id === playback?.track_id) ?? null,
    [songs, playback?.track_id],
  );

  const spin = useRef(new Animated.Value(0)).current;
  const spinLoop = useRef<Animated.CompositeAnimation | null>(null);
  const playing = Boolean(playback?.playing && current);

  // The logo turns like a record while the room has music.
  useEffect(() => {
    if (playing) {
      spin.setValue(0);
      spinLoop.current = Animated.loop(
        Animated.timing(spin, { toValue: 1, duration: 4200, useNativeDriver: true }),
      );
      spinLoop.current.start();
    } else {
      spinLoop.current?.stop();
      spin.setValue(0);
    }
    return () => spinLoop.current?.stop();
  }, [playing, spin]);

  const spinStyle = {
    transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
  };

  // La sala se dibuja como una columna centrada: el disco vive dentro de esa
  // columna, no pegado al borde de una pantalla grande.
  const column = capped(windowWidth);
  const columnLeft = Math.max(0, (windowWidth - column) / 2);
  // Dragging the disc: it starts on the left, above the chat, where it never
  // covers the room controls or the microphone, and stays inside the room
  // wherever it is dropped.
  const home = useRef({ x: columnLeft + 14, y: Math.max(120, windowHeight - 232) }).current;
  const pan = useRef(new Animated.ValueXY({ x: home.x, y: home.y })).current;
  const start = useRef({ x: home.x, y: home.y });
  const moved = useRef(false);
  const bounds = useRef({ width: windowWidth, height: windowHeight, left: columnLeft });
  bounds.current = { width: windowWidth, height: windowHeight, left: columnLeft };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => {
      moved.current = false;
      pan.stopAnimation(value => { start.current = value as { x: number; y: number }; });
    },
    onPanResponderMove: (_event, gesture) => {
      if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) moved.current = true;
      const maxX = bounds.current.left + capped(bounds.current.width) - DISC - 8;
      const maxY = bounds.current.height - DISC - 40;
      pan.setValue({
        x: Math.min(maxX, Math.max(bounds.current.left + 8, start.current.x + gesture.dx)),
        y: Math.min(maxY, Math.max(70, start.current.y + gesture.dy)),
      });
    },
    onPanResponderRelease: () => {
      // A tap opens the DJ; a drag only moves it.
      if (!moved.current) setOpen(true);
    },
  }), [pan]);

  const refresh = useCallback(async () => {
    const [nextSongs, nextState, nextDj] = await Promise.all([
      listPlaylist(roomId),
      getPlayback(roomId),
      getRoomDj(roomId),
    ]);
    setSongs(nextSongs);
    setPlayback(nextState);
    setDjId(nextDj);
    setLoaded(true);
  }, [roomId]);

  useRommDjLive(roomId, () => { void refresh(); });

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    if (!open || !meId) return;
    void listMyTracks(meId).then(setLibrary).catch(() => setLibrary([]));
  }, [open, meId, busy]);

  // One player per phone, following the room state.
  const playerRef = useRef<ReturnType<NonNullable<ReturnType<typeof audioModule>>['createAudioPlayer']> | null>(null);
  const loadedTrack = useRef<string | null>(null);

  useEffect(() => {
    const Audio = audioModule();
    if (!Audio) return;
    const player = Audio.createAudioPlayer(null, { updateInterval: 500 });
    playerRef.current = player;
    void Audio.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true, shouldRouteThroughEarpiece: false }).catch(() => undefined);
    return () => {
      try { player.pause(); } catch { /* already released */ }
      playerRef.current = null;
      loadedTrack.current = null;
    };
  }, []);

  // Song, pause and volume come from the room, so every phone sounds the same.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.volume = Math.min(1, Math.max(0, playback?.volume ?? 0.8));
    if (!current) {
      try { player.pause(); } catch { /* nothing loaded */ }
      loadedTrack.current = null;
      return;
    }
    const target = playback ? playheadMs(playback) / 1000 : 0;
    const sameTrack = loadedTrack.current === current.track_id;
    try {
      if (!sameTrack) {
        player.replace({ uri: current.url });
        loadedTrack.current = current.track_id;
      }
      if (!sameTrack) void player.seekTo(Math.max(0, target)).catch(() => undefined);
      if (playback?.playing) player.play();
      else player.pause();
    } catch {
      // A file that is still downloading starts on the next change.
    }
  }, [current, playback?.track_id, playback?.playing, playback?.started_at, playback?.volume, playback?.position_ms]);

  // A song that finishes moves the room to the next one.
  useEffect(() => {
    if (!playing || !isDj) return;
    const timer = setInterval(() => {
      const player = playerRef.current;
      if (!player || !current) return;
      if (player.duration > 0 && player.currentTime >= player.duration - 0.6) {
        const index = songs.findIndex(song => song.track_id === current.track_id);
        const next = songs[index + 1];
        if (next) void playForRoom(roomId, next.track_id, 0).catch(() => undefined);
        else void pauseForRoom(roomId, current.track_id, 0).catch(() => undefined);
      }
    }, 1200);
    return () => clearInterval(timer);
  }, [playing, isDj, songs, current, roomId]);

  async function play(song: SongInRoom) {
    if (!isDj) { setError('Solo el DJ pone la música'); return; }
    setError(null);
    setBusy('play');
    try {
      await playForRoom(roomId, song.track_id, 0);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos poner la música');
    } finally {
      setBusy(null);
    }
  }

  async function togglePause() {
    if (!playback || !isDj) return;
    const player = playerRef.current;
    const position = Math.round((player?.currentTime ?? playheadMs(playback) / 1000) * 1000);
    setError(null);
    try {
      if (playback.playing) await pauseForRoom(roomId, playback.track_id, position);
      else await playForRoom(roomId, playback.track_id ?? current?.track_id ?? '', position);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos pausar');
    }
  }

  async function step(direction: -1 | 1) {
    if (!isDj || !current) return;
    const index = songs.findIndex(song => song.track_id === current.track_id);
    const next = songs[(index + direction + songs.length) % songs.length];
    if (next) await play(next);
  }

  async function addMusic() {
    if (!meId) { setError('Inicia sesión para poner música'); return; }
    setError(null);
    const picked = await pickAudioFromDevice();
    if (picked.status === 'unavailable') { setError('Esta versión no puede abrir tus archivos de música'); return; }
    if (picked.status !== 'picked') return;
    if (picked.audio.size && picked.audio.size > 35 * 1024 * 1024) {
      setError('La música debe pesar 35 MB o menos');
      return;
    }
    setBusy('upload');
    try {
      const name = title.trim()
        || (picked.audio.fileName ?? 'Mi música').replace(/\.[a-z0-9]+$/i, '').slice(0, 60);
      const track = await uploadTrack(meId, picked.audio, name);
      await addToPlaylist(roomId, track.id);
      setTitle('');
      await refresh();
      onFlash('Música añadida a la playlist de la sala');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos subir la música');
    } finally {
      setBusy(null);
    }
  }

  async function shareFromLibrary(track: DjTrack) {
    setError(null);
    try {
      await addToPlaylist(roomId, track.id);
      await refresh();
      onFlash('Música compartida en la sala');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos compartirla');
    }
  }

  async function removeSong(song: SongInRoom) {
    try {
      await removeFromPlaylist(roomId, song.track_id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos quitarla');
    }
  }

  async function removeSaved(track: DjTrack) {
    try {
      await deleteTrack(track.id);
      setLibrary(await listMyTracks(track.user_id));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos borrarla');
    }
  }

  async function changeVolume(next: number) {
    if (!isDj) return;
    try { await setRoomVolume(roomId, next); } catch { /* the next move tries again */ }
  }

  return (
    <>
      <Animated.View
        {...panResponder.panHandlers}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'DJ de la sala, música sonando' : 'DJ de la sala'}
        style={[{
          position: 'absolute',
          left: 0,
          top: 0,
          width: DISC,
          height: DISC,
          zIndex: 30,
        }, pan.getLayout()]}>
        <View style={{ width: DISC, height: DISC }} className="items-center justify-center">
          <View className="border-primary/70 bg-background/85 items-center justify-center overflow-hidden rounded-full border-2" style={{ width: DISC, height: DISC }}>
            <Animated.View style={spinStyle}>
              <Image source={require('@/assets/brand-mark.webp')} resizeMode="cover" style={{ width: DISC - 6, height: DISC - 6, borderRadius: (DISC - 6) / 2 }} />
            </Animated.View>
            <View className="bg-primary absolute size-2 rounded-full" />
          </View>
          {playing ? (
            <View className="bg-success absolute -bottom-0.5 right-0 size-3 rounded-full border border-black/40" />
          ) : null}
        </View>
      </Animated.View>

      {open ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 40 }}>
          <Pressable accessibilityLabel="Cerrar el DJ" onPress={() => setOpen(false)} className="flex-1 justify-end bg-black/60">
            <Pressable onPress={() => undefined} style={{ maxHeight: '78%' }} className="border-border bg-card rounded-t-3xl border px-4 pt-3">
              <View className="mb-2 flex-row items-center gap-2">
                <Icon as={Disc3} className="text-primary size-4" />
                <Text className="text-foreground flex-1 text-sm font-semibold">DJ de la sala</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el DJ" onPress={() => setOpen(false)} className="border-border size-8 items-center justify-center rounded-full border active:opacity-70">
                  <Icon as={X} className="text-foreground size-4" />
                </Pressable>
              </View>

              <View className="border-border bg-background/60 mb-3 rounded-2xl border px-3 py-2">
                <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>
                  {current ? current.track.title : 'Sin música todavía'}
                </Text>
                <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                  {current
                    ? `${songs.findIndex(song => song.track_id === current.track_id) + 1} de ${songs.length} · ${formatSongTime(current.track.duration_ms)}`
                    : isDj ? 'Añade una música de tu teléfono' : 'El DJ todavía no ha puesto música'}
                </Text>
                {isDj ? (
                  <View className="mt-2 flex-row items-center gap-1.5">
                    <Pressable accessibilityRole="button" accessibilityLabel="Música anterior" onPress={() => void step(-1)} className="border-border size-11 items-center justify-center rounded-full border active:opacity-70">
                      <Icon as={SkipBack} className="text-foreground size-4" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={playback?.playing ? 'Pausar la música' : 'Reanudar la música'}
                      onPress={() => void togglePause()}
                      disabled={!playback?.track_id}
                      className={cn('size-11 items-center justify-center rounded-full', playback?.track_id ? 'bg-primary' : 'bg-muted')}>
                      <Icon as={playback?.playing ? Pause : Play} className="text-primary-foreground size-5" />
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityLabel="Música siguiente" onPress={() => void step(1)} className="border-border size-11 items-center justify-center rounded-full border active:opacity-70">
                      <Icon as={SkipForward} className="text-foreground size-4" />
                    </Pressable>
                    <View className="flex-1" />
                    <Icon as={Volume2} className="text-muted-foreground size-4" />
                    <VolumeBar value={playback?.volume ?? 0.8} onChange={volume => void changeVolume(volume)} />
                  </View>
                ) : null}
              </View>

              {error ? <Text className="text-destructive mb-2 text-[12px]">{error}</Text> : null}

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
                <Text className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide">PLAYLIST DE LA SALA · {songs.length}/10</Text>
                {songs.length === 0 ? (
                  <Text className="text-muted-foreground mb-3 text-[12px]">Comparte hasta 10 músicas de tu teléfono. Todos en la sala las escuchan a la vez.</Text>
                ) : (
                  songs.map(song => (
                    <View key={song.id} className={cn('mb-1.5 flex-row items-center gap-2 rounded-xl border px-2.5 py-2', song.track_id === current?.track_id ? 'border-primary/60 bg-primary/10' : 'border-border bg-background/40')}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`Poner ${song.track.title}`} onPress={() => void play(song)} className="flex-1 flex-row items-center gap-2 active:opacity-70">
                        <View className="bg-primary/15 size-8 items-center justify-center rounded-full">
                          <Icon as={song.track_id === current?.track_id && playback?.playing ? Pause : Play} className="text-primary size-3.5" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-foreground text-[12px] font-medium" numberOfLines={1}>{song.track.title}</Text>
                          <Text className="text-muted-foreground text-[11px]">{song.track_id === current?.track_id ? 'Suena ahora' : 'En la playlist'}</Text>
                        </View>
                      </Pressable>
                      {isDj || song.added_by === meId ? (
                        <Pressable accessibilityRole="button" accessibilityLabel={`Quitar ${song.track.title}`} onPress={() => void removeSong(song)} className="p-1 active:opacity-60">
                          <Icon as={Trash2} className="text-muted-foreground size-3.5" />
                        </Pressable>
                      ) : null}
                    </View>
                  ))
                )}

                <View className="border-border mt-2 flex-row items-center gap-2 rounded-xl border px-2 py-1.5">
                  <TextInput
                    value={title}
                    onChangeText={setTitle}
                    placeholder="Nombre de la música (opcional)"
                    placeholderTextColor="#8A8073"
                    maxLength={60}
                    accessibilityLabel="Nombre de la música"
                    className="text-foreground flex-1 text-[13px]"
                    style={{ paddingVertical: 6 }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Añadir música desde el teléfono"
                    onPress={() => void addMusic()}
                    disabled={busy === 'upload'}
                    className="bg-primary h-9 flex-row items-center gap-1.5 rounded-full px-3 active:opacity-85">
                    {busy === 'upload'
                      ? <ActivityIndicator size="small" color="#1A1409" />
                      : <Icon as={Upload} className="text-primary-foreground size-3.5" />}
                    <Text className="text-primary-foreground text-[12px] font-semibold">Subir</Text>
                  </Pressable>
                </View>
                <Text className="text-muted-foreground mt-1 mb-3 text-[11px]">MP3, M4A, AAC, OGG o WAV · máximo 35 MB por música · todos la escuchan igual.</Text>

                <Text className="text-muted-foreground mb-1.5 text-[11px] font-semibold tracking-wide">MI DJ · {library.length}</Text>
                {library.length === 0 ? (
                  <Text className="text-muted-foreground mb-3 text-[12px]">Lo que subas se guarda aquí para volver a ponerlo en cualquier sala.</Text>
                ) : (
                  library.map(track => {
                    const inRoom = songs.some(song => song.track_id === track.id);
                    return (
                      <View key={track.id} className="border-border bg-background/40 mb-1.5 flex-row items-center gap-2 rounded-xl border px-2.5 py-2">
                        <Icon as={ListMusic} className="text-muted-foreground size-3.5" />
                        <Text className="text-foreground flex-1 text-[12px]" numberOfLines={1}>{track.title}</Text>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={inRoom ? `${track.title} ya está en la sala` : `Compartir ${track.title} en la sala`}
                          disabled={inRoom}
                          onPress={() => void shareFromLibrary(track)}
                          className={cn('size-7 items-center justify-center rounded-full border', inRoom ? 'border-border opacity-40' : 'border-primary/60 bg-primary/10')}>
                          <Icon as={Plus} className="text-primary size-3.5" />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Borrar ${track.title} de mi DJ`} onPress={() => void removeSaved(track)} className="p-1 active:opacity-60">
                          <Icon as={Trash2} className="text-muted-foreground size-3.5" />
                        </Pressable>
                      </View>
                    );
                  })
                )}

                {isDj ? (
                  <Text className="text-muted-foreground mt-2 text-[11px]">
                    {isHost && !djId ? 'Puedes poner la música. También puedes nombrar DJ a alguien sentado desde su ficha.' : 'Eres el DJ: tu música y tu volumen llegan a toda la sala.'}
                  </Text>
                ) : (
                  <Text className="text-muted-foreground mt-2 text-[11px]">
                    Solo el DJ cambia la canción y el volumen. Puedes compartir tu música para que él la ponga.
                  </Text>
                )}
              </ScrollView>
            </Pressable>
          </Pressable>
        </View>
      ) : null}
    </>
  );
}

/** The room's single volume: a bar the DJ drags, and everyone's phones obey. */
function VolumeBar({ value, onChange }: { value: number; onChange: (next: number) => void }) {
  const [width, setWidth] = useState(110);
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);

  useEffect(() => { if (!dragging.current) setLocal(value); }, [value]);

  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: event => {
      dragging.current = true;
      const next = Math.min(1, Math.max(0, event.nativeEvent.locationX / width));
      setLocal(next);
    },
    onPanResponderMove: (event, gesture) => {
      const next = Math.min(1, Math.max(0, (event.nativeEvent.locationX + gesture.dx * 0) / width));
      setLocal(next);
    },
    onPanResponderRelease: (event, gesture) => {
      dragging.current = false;
      const next = Math.min(1, Math.max(0, (event.nativeEvent.locationX + gesture.dx * 0) / width));
      setLocal(next);
      onChange(next);
    },
  }), [width, onChange]);

  return (
    <View
      {...responder.panHandlers}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel="Volumen de la música de la sala"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(local * 100) }}
      style={{ width: 110, height: 26, justifyContent: 'center' }}>
      <View className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <View className="bg-primary h-full rounded-full" style={{ width: `${Math.round(local * 100)}%` }} />
      </View>
      <View className="bg-primary absolute size-3 rounded-full" style={{ left: Math.max(0, Math.min(110 - 12, local * 110 - 6)) }} />
    </View>
  );
}
