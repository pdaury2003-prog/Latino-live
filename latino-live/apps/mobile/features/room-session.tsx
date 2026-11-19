import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { ChevronUp, Mic, MicOff, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { useRoomVoice } from '@/features/voice';

export type SessionRoom = {
  id: string;
  slug: string;
  title: string;
  hostName: string;
  /** The host allows cameras in this room; a missing value means allowed. */
  allowCamera?: boolean;
};

type RoomSessionValue = {
  room: SessionRoom | null;
  minimized: boolean;
  voiceError: string | null;
  clearVoiceError: () => void;
  voice: ReturnType<typeof useRoomVoice>;
  enter: (room: SessionRoom) => void;
  attach: (state: { seated: boolean; muted: boolean }) => void;
  /** The person turned their own microphone off: do not open it again. */
  holdMic: () => void;
  minimize: () => void;
  expand: () => void;
  leave: () => void;
  inRoom: (slug: string) => boolean;
};

const Context = createContext<RoomSessionValue | null>(null);

/**
 * One room at a time, shared by every screen: the room keeps its microphone
 * state while it is minimized, so browsing the app does not hang up.
 */
export function RoomSessionProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [room, setRoom] = useState<SessionRoom | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [seated, setSeated] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // A seat is a microphone: people who sit down talk together without
  // pressing anything, until they turn their own microphone off.
  const autoMic = useRef(true);
  const wasMuted = useRef(false);

  const voice = useRoomVoice({
    roomId: room?.id ?? null,
    userId: session?.user.id,
    muted,
    seated,
    cameraAllowed: room?.allowCamera !== false,
    onError: setVoiceError,
  });

  const enter = useCallback((next: SessionRoom) => {
    setRoom(current => {
      // Re-entering the same room must not undo an intentional minimize.
      if (current?.id === next.id) {
        // The host may have changed the room while this person is inside;
        // the newest rules replace the old ones without leaving the seat.
        return { ...current, ...next };
      }
      setSeated(false);
      setMuted(false);
      setMinimized(false);
      autoMic.current = true;
      return next;
    });
  }, []);

  const attach = useCallback((state: { seated: boolean; muted: boolean }) => {
    setSeated(state.seated);
    setMuted(state.muted);
    if (state.seated) autoMic.current = true;
  }, []);

  const leave = useCallback(() => {
    voice.leave();
    setRoom(null);
    setMinimized(false);
    setSeated(false);
    setMuted(false);
    autoMic.current = true;
  }, [voice.leave]);

  const holdMic = useCallback(() => {
    autoMic.current = false;
  }, []);

  // Several seated people talk at the same time: each phone opens its own
  // microphone as soon as its owner sits down, and keeps hearing the others.
  useEffect(() => {
    if (!room || !seated || muted || !autoMic.current) return;
    // A browser asks for the microphone with its own prompt, which the room
    // preview cannot answer: there the person presses the microphone.
    if (Platform.OS === 'web') return;
    if (!voice.connected || voice.micOn || voice.status !== 'idle') return;
    let live = true;
    void voice.start().then(opened => {
      // A refused permission is not asked for again on every redraw.
      if (live && !opened) autoMic.current = false;
    });
    return () => { live = false; };
    // `voice.start` is recreated on every render and is guarded by the state
    // above, so it stays out of the dependencies.
  }, [room, seated, muted, voice.connected, voice.micOn, voice.status]);

  // When the host lifts a mute, the person speaks again without pressing.
  useEffect(() => {
    if (wasMuted.current && !muted) autoMic.current = true;
    wasMuted.current = muted;
  }, [muted]);

  const minimize = useCallback(() => {
    setMinimized(true);
    router.replace('/' as Href);
  }, []);

  const expand = useCallback(() => {
    if (!room) return;
    setMinimized(false);
    router.push(`/room/${room.slug}` as Href);
  }, [room]);

  const clearVoiceError = useCallback(() => setVoiceError(null), []);

  // A closed account or a finished session leaves the room.
  useEffect(() => {
    if (!session) leave();
  }, [session, leave]);

  const value = useMemo<RoomSessionValue>(() => ({
    room,
    minimized,
    voice,
    voiceError,
    clearVoiceError,
    enter,
    attach,
    holdMic,
    minimize,
    expand,
    leave,
    inRoom: (slug: string) => room?.slug === slug,
  }), [room, minimized, voice, voiceError, clearVoiceError, enter, attach, holdMic, minimize, expand, leave]);

  return (
    <Context.Provider value={value}>
      {children}
      {room && minimized ? <RoomMiniBar /> : null}
    </Context.Provider>
  );
}

export function useRoomSession() {
  const value = useContext(Context);
  if (!value) throw new Error('RoomSessionProvider is missing');
  return value;
}

function RoomMiniBar() {
  const { room, voice, expand, leave, holdMic } = useRoomSession();
  if (!room) return null;
  return (
    <View style={{ position: 'absolute', left: 10, right: 10, bottom: 78 }} className="border-border bg-card/95 flex-row items-center gap-2 rounded-2xl border px-2.5 py-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Volver a la sala ${room.title}`}
        onPress={expand}
        className="flex-1 flex-row items-center gap-2.5 active:opacity-85">
        <View className="bg-success size-2 rounded-full" />
        <View className="flex-1">
          <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{room.title}</Text>
          <View className="flex-row items-center gap-1">
            <Icon as={voice.live ? Mic : MicOff} className={voice.live ? 'text-primary size-3' : 'text-muted-foreground size-3'} />
            <Text className="text-muted-foreground text-[11px]">
              {voice.live ? 'En vivo · sigues en la sala' : voice.connected ? 'Escuchando la sala' : 'Minimizada · conectarás al volver'}
            </Text>
          </View>
        </View>
        <Icon as={ChevronUp} className="text-muted-foreground size-4" />
      </Pressable>
      {voice.live ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apagar el micrófono"
          onPress={() => { holdMic(); voice.stop(); }}
          className="border-border bg-background size-8 items-center justify-center rounded-full border active:opacity-70">
          <Icon as={MicOff} className="text-foreground size-3.5" />
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Salir de la sala"
        onPress={leave}
        className="border-border bg-background size-8 items-center justify-center rounded-full border active:opacity-70">
        <Icon as={X} className="text-foreground size-3.5" />
      </Pressable>
    </View>
  );
}
