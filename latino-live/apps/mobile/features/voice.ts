import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import { setSpeaking } from '@/lib/rooms';
import { createLiveAudio } from '@/lib/live-audio';
import { loadIceServers } from '@/lib/ice';
import { readRelay } from '@/lib/relay';
import type { LiveAudio, LiveSignal, LiveVideoEntry } from '@/lib/live-audio.types';
import { askMicrophone, microphoneState } from '@/lib/permissions';
import { audioModule } from '@/lib/device-media';

export type VoiceStatus = 'idle' | 'requesting' | 'live' | 'error';

/**
 * The phone's audio session while a room is open. The room plays through the
 * loudspeaker, keeps playing when the phone is on silent, and only lowers
 * other apps instead of being cut by a notification.
 */
async function applyAudioMode(recording: boolean) {
  if (Platform.OS === 'web') return;
  await audioModule()
    ?.setAudioModeAsync({
      allowsRecording: recording,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    })
    .catch(() => undefined);
}

/**
 * Android answers a call through the earpiece unless it is told otherwise, and
 * the voice engine puts the phone back into call mode as soon as it starts
 * listening. Reasserting the speaker afterwards is what makes the room audible
 * instead of a whisper against the ear.
 *
 * The session only stays in recording mode while the microphone is open:
 * holding it open for a listener is what made the room sound quiet on Android.
 */
function speakerNow(recording = true) {
  if (Platform.OS === 'web') return;
  void audioModule()
    ?.setAudioModeAsync({
      allowsRecording: recording,
      playsInSilentMode: true,
      shouldRouteThroughEarpiece: false,
      interruptionMode: 'duckOthers',
      shouldPlayInBackground: false,
    })
    .catch(() => undefined);
}

type Args = {
  roomId: string | null;
  userId: string | undefined;
  /** The host muted this seat: the microphone is refused and cut at once. */
  muted: boolean;
  seated: boolean;
  /** The host allows the room's cameras. When closed, no lens opens. */
  cameraAllowed: boolean;
  onError: (message: string) => void;
};

/**
 * Live room audio. Everyone in the room joins the same channel as
 * soon as they enter, so they hear the others without pressing anything; the
 * microphone is only opened when the person chooses to speak.
 */
export function useRoomVoice({ roomId, userId, muted, seated, cameraAllowed, onError }: Args) {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(false);
  // The camera is its own choice: it can be on while the microphone is off,
  // and turning it off never hangs up the room.
  const [cameraOn, setCameraOn] = useState(false);
  // The lens takes a moment to open and the permission may ask: the button
  // shows that wait instead of looking untouched.
  const [cameraBusy, setCameraBusy] = useState(false);
  /**
   * Which lens is sending. The front one is shown mirrored, the way a mirror
   * reads, and the back one is not; it also names the button's next step.
   */
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user');
  const [cameraSwitching, setCameraSwitching] = useState(false);
  const [videos, setVideos] = useState<LiveVideoEntry[]>([]);
  // True once the project's relay answered: calls work between countries too.
  const [relay, setRelay] = useState(false);
  const [remotes, setRemotes] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  // Read by the "no audio arrived" check without re-creating the connection.
  const remotesRef = useRef<string[]>([]);
  const membersRef = useRef<string[]>([]);
  remotesRef.current = remotes;
  membersRef.current = members;
  const warnedAboutAudio = useRef(false);
  const audioRef = useRef<LiveAudio | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const connectingRef = useRef(false);
  // The connection already travelling to the server. A second caller waits
  // for it instead of being told there is no connection.
  const connectRun = useRef<Promise<boolean> | null>(null);
  // Whether the live channel is joined right now, and how to try again when
  // the phone loses signal, sleeps or changes network.
  const joinedRef = useRef(false);
  const rejoinRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rejoinAttempt = useRef(0);
  const micOnRef = useRef(false);
  const cameraOnRef = useRef(false);
  const seatedRef = useRef(seated);
  seatedRef.current = seated;
  const cameraAllowedRef = useRef(cameraAllowed);
  cameraAllowedRef.current = cameraAllowed;
  const reconnectRef = useRef<() => void>(() => undefined);
  const startRef = useRef<() => Promise<boolean>>(async () => false);
  /** Counts microphone presses, so a tap while it opens cancels the open. */
  const startTicket = useRef(0);
  const announceTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const errorRef = useRef(onError);
  errorRef.current = onError;

  const clearAnnouncements = useCallback(() => {
    announceTimers.current.forEach(clearTimeout);
    announceTimers.current = [];
  }, []);

  const teardown = useCallback(() => {
    clearAnnouncements();
    if (rejoinRef.current) clearTimeout(rejoinRef.current);
    rejoinRef.current = null;
    joinedRef.current = false;
    micOnRef.current = false;
    cameraOnRef.current = false;
    audioRef.current?.stop();
    audioRef.current = null;
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) {
      void channel.untrack().catch(() => undefined);
      void getSupabase()?.removeChannel(channel);
    }
    connectingRef.current = false;
    setStatus('idle');
    setConnected(false);
    setMicOn(false);
    setCameraOn(false);
    setVideos([]);
    setRemotes([]);
    setMembers([]);
    if (roomId) void setSpeaking(roomId, false).catch(() => undefined);
  }, [roomId, clearAnnouncements]);

  useEffect(() => () => teardown(), [teardown]);

  /** Joins the room channel without the microphone: from here the person hears everyone. */
  const connect = useCallback(async (): Promise<boolean> => {
    if (!roomId || !userId) return false;
    if (audioRef.current) return true;
    if (connectRun.current) return connectRun.current;
    const run = (async (): Promise<boolean> => {
    connectingRef.current = true;
    const client = getSupabase();
    if (!client) {
      connectingRef.current = false;
      errorRef.current('Cuentas no disponibles');
      return false;
    }

    // Every phone must join the SAME channel; a per-user name would put each
    // person in a private room where nobody can hear or see the others.
    const room = client.channel(`live:${roomId}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: userId } },
    });
    channelRef.current = room;

    // Speaker playback, so a phone does not send the room to the earpiece.
    // The room plays through the loudspeaker. Recording is off: holding the
    // session in record mode is what makes the room sound quiet on Android.
    await applyAudioMode(false);

    // The relay arrives from the project's own server, so a call also works
    // between carriers and countries that never find each other directly.
    // The project's own relay joins the list before the first call, and the
    // app asks both its backend and its site for it, because the key may live
    // in either place.
    const pool = await loadIceServers(async () => {
      const reply = await readRelay();
      return reply?.iceServers ?? null;
    });
    const iceServers = pool.servers;
    // The badge only claims the project's own relay when one really answered.
    setRelay(pool.dedicated);
    const audio = createLiveAudio({
      selfId: userId,
      iceServers,
      onVideoChange: list => {
        setVideos(list);
        const mine = list.some(item => item.self);
        cameraOnRef.current = mine;
        setCameraOn(mine);
      },
      onRemoteChange: ids => {
        setRemotes(ids);
        // Somebody joined: make sure their voice leaves through the loudspeaker,
        // without holding the phone in recording mode while nobody speaks.
        if (ids.length) speakerNow(micOnRef.current);
      },
      onError: message => errorRef.current(message),
      onSignal: signal => {
        void channelRef.current?.send({ type: 'broadcast', event: 'signal', payload: signal });
      },
    });
    audioRef.current = audio;

    room.on('broadcast', { event: 'signal' }, message => {
      const signal = message.payload as LiveSignal;
      if (!signal?.kind) return;
      const to = 'to' in signal ? signal.to : undefined;
      if (to && to !== userId) return;
      audio.receive(signal);
    });

    // Presence lists who is live, so a missed broadcast still finds the room.
    room.on('presence', { event: 'sync' }, () => {
      const ids = Object.keys(room.presenceState());
      setMembers(ids);
      // One side starts the call: the lower id offers, the other answers.
      for (const id of ids) {
        if (id !== userId && userId < id) {
          void room.send({ type: 'broadcast', event: 'signal', payload: { kind: 'join', from: userId, to: id } });
        }
      }
    });

    // The same channel reports every later change: a phone that walks out of
    // coverage comes back here, and the call is rebuilt without leaving.
    const announceJoin = () => {
      const join = { kind: 'join' as const, from: userId };
      for (const delay of [0, 900, 2200]) {
        announceTimers.current.push(setTimeout(() => {
          if (channelRef.current) void channelRef.current.send({ type: 'broadcast', event: 'signal', payload: join });
        }, delay));
      }
    };
    const subscribed = await new Promise<boolean>(resolve => {
      let settled = false;
      let seen = false;
      const finish = (value: boolean) => { if (!settled) { settled = true; resolve(value); } };
      room.subscribe(connection => {
        if (connection === 'SUBSCRIBED') {
          const again = seen;
          seen = true;
          joinedRef.current = true;
          finish(true);
          if (!again) return;
          // The socket came back by itself: presence and the calls are renewed
          // so the room hears this person again without anyone touching it.
          rejoinAttempt.current = 0;
          setConnected(true);
          void room.track({ live: true, joinedAt: Date.now() }).catch(() => undefined);
          audioRef.current?.resume?.();
          announceJoin();
          return;
        }
        if (connection === 'CHANNEL_ERROR' || connection === 'TIMED_OUT' || connection === 'CLOSED') {
          joinedRef.current = false;
          finish(false);
          reconnectRef.current();
        }
      });
      setTimeout(() => finish(false), 12_000);
    });
    if (!subscribed) {
      teardown();
      // Without signal the room keeps trying on its own instead of giving up:
      // the person is told once and the audio comes back when the phone does.
      if (rejoinAttempt.current === 0) {
        errorRef.current('No pudimos conectar con la sala. Revisa tu conexión e inténtalo otra vez.');
      }
      reconnectRef.current();
      return false;
    }

    await audio.start();
    await room.track({ live: true, joinedAt: Date.now() });
    joinedRef.current = true;
    rejoinAttempt.current = 0;
    connectingRef.current = false;
    setConnected(true);

    // Broadcasts are not stored: announce a few times so people already live
    // in the room answer even if one message crosses the other.
    announceJoin();
    return true;
    })();
    connectRun.current = run;
    try {
      return await run;
    } finally {
      if (connectRun.current === run) connectRun.current = null;
    }
  }, [roomId, userId, teardown]);

  // Entering a room is enough to listen: no permission and no button.
  useEffect(() => {
    if (!roomId || !userId) return;
    void connect();
  }, [roomId, userId, connect]);

  /**
   * Rebuilds the live channel after the phone lost its signal, slept or
   * changed network. The person stays in the room: only the connection is
   * replaced, and the microphone comes back if it was open.
   */
  useEffect(() => {
    const rebuild = async () => {
      const wasTalking = micOnRef.current;
      teardown();
      const ok = await connect();
      if (ok && wasTalking && seatedRef.current) await startRef.current();
    };
    const schedule = () => {
      if (!roomId || !userId || rejoinRef.current) return;
      // A little longer each time: a phone without signal must not hammer
      // the server, and coverage usually comes back within seconds.
      const wait = Math.min(15_000, 800 * 2 ** rejoinAttempt.current);
      rejoinAttempt.current += 1;
      rejoinRef.current = setTimeout(() => {
        rejoinRef.current = null;
        if (joinedRef.current) return;
        void rebuild();
      }, wait);
    };
    reconnectRef.current = schedule;

    const activity = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        // A camera left open in the background keeps the lens busy and drains
        // the phone; the person can turn it on again on the way back.
        if (cameraOnRef.current) {
          audioRef.current?.stopCamera();
          cameraOnRef.current = false;
          setCameraOn(false);
          setCameraFacing('user');
          setVideos(current => current.filter(item => !item.self));
        }
        return;
      }
      // A call or a notification can reset the phone's audio session; the room
      // puts it back before trying the connections again.
      void applyAudioMode(micOnRef.current);
      const channel = channelRef.current;
      if (!channel || String(channel.state) !== 'joined') {
        // Give the socket a moment to come back by itself first.
        if (roomId && userId) schedule();
        return;
      }
      // The channel survived the screen lock: the calls may not have.
      audioRef.current?.resume?.();
    });

    // A quiet safety net: a channel that reports itself joined but stopped
    // delivering is noticed, and the phone joins again.
    const timer = setInterval(() => {
      const channel = channelRef.current;
      if (!channel) return;
      if (String(channel.state) !== 'joined') {
        joinedRef.current = false;
        schedule();
      }
    }, 20_000);

    return () => {
      activity.remove();
      clearInterval(timer);
      reconnectRef.current = () => undefined;
      if (rejoinRef.current) clearTimeout(rejoinRef.current);
      rejoinRef.current = null;
    };
  }, [roomId, userId, connect, teardown]);

  // The host's mute cuts the microphone but keeps the person listening.
  useEffect(() => {
    if (!muted || !micOn) return;
    audioRef.current?.setMicEnabled(false);
    setMicOn(false);
    setStatus('idle');
    if (roomId) void setSpeaking(roomId, false).catch(() => undefined);
    errorRef.current('El anfitrión te ha silenciado');
  }, [muted, micOn, roomId]);

  // Standing up closes the camera: a person who left their seat is not on
  // screen any more, and the lens is not kept busy for an empty place.
  useEffect(() => {
    if (seated || !cameraOnRef.current) return;
    audioRef.current?.stopCamera();
    cameraOnRef.current = false;
    setCameraOn(false);
    setCameraFacing('user');
    setVideos(current => current.filter(item => !item.self));
  }, [seated]);

  // The host closed the cameras: a lens that is already open goes dark at
  // once, so the new rule of the room is true for everyone in it.
  useEffect(() => {
    if (cameraAllowed || !cameraOnRef.current) return;
    audioRef.current?.stopCamera();
    cameraOnRef.current = false;
    setCameraOn(false);
    setCameraFacing('user');
    setVideos(current => current.filter(item => !item.self));
    errorRef.current('El anfitrión desactivó las cámaras en esta sala');
  }, [cameraAllowed]);

  // Sitting down with the permission already given opens the microphone in
  // silence, so the first press sends the voice at once instead of waiting
  // for the phone to open the capture device.
  const warmed = useRef(false);
  useEffect(() => {
    // The browser asks with its own prompt, so nothing is opened behind the
    // person's back there; on the phone the permission is already given.
    if (Platform.OS === 'web' || !seated || muted || micOn || warmed.current || !connected) return;
    let live = true;
    void (async () => {
      if ((await microphoneState()) !== 'granted') return;
      if (!live || warmed.current) return;
      warmed.current = true;
      await audioRef.current?.prepareMic?.();
    })();
    return () => { live = false; };
  }, [seated, muted, micOn, connected]);

  /**
   * Opens the microphone so the room hears this person. Returns whether the
   * microphone actually went live, so a failed first try is not repeated.
   */
  async function start(): Promise<boolean> {
    if (micOn || status === 'requesting') return false;
    if (muted) {
      errorRef.current('El anfitrión te ha silenciado');
      return false;
    }
    if (!seated) {
      errorRef.current('Siéntate en un asiento para hablar');
      return false;
    }
    // The button answers at once: the seat lights and the control turns red
    // while the microphone and the room finish opening, instead of leaving a
    // motionless button for a second.
    const ticket = ++startTicket.current;
    micOnRef.current = true;
    setMicOn(true);
    setStatus('live');
    if (roomId) void setSpeaking(roomId, true).catch(() => undefined);
    // The permission, the channel and the microphone open together: one wait,
    // not three in a row.
    const accessRun = askMicrophone();
    const connectRun = connect();
    const access = await accessRun;
    const cancelled = () => startTicket.current !== ticket;
    if (access !== 'granted') {
      if (!cancelled()) rollback();
      errorRef.current(access === 'unavailable'
        ? 'El micrófono solo funciona en la app instalada en tu teléfono'
        : 'Necesitamos permiso de micrófono para que te escuchen');
      return false;
    }
    if (!(await connectRun)) {
      if (!cancelled()) rollback();
      return false;
    }
    if (cancelled()) return false;
    // The audio session must already accept recording when the microphone
    // opens. Turning it on afterwards left a silent track: Android kept the
    // call in playback mode and the room heard nothing.
    await applyAudioMode(true);
    const ready = await audioRef.current?.enableMic();
    if (!ready || cancelled()) {
      if (!cancelled()) rollback();
      return false;
    }
    // The microphone just took the phone into call mode; put the room back on
    // the loudspeaker so everyone is heard.
    speakerNow();
    setTimeout(speakerNow, 400);
    // If somebody else is in the room and nothing arrives, say why instead of
    // leaving the person talking to a silent phone.
    if (!warnedAboutAudio.current) {
      warnedAboutAudio.current = true;
      setTimeout(() => {
        if (remotesRef.current.length > 0) return;
        if (membersRef.current.filter(id => id !== userId).length === 0) return;
        errorRef.current('No llegó el audio de la otra persona. Sal y vuelve a entrar a la sala: la conexión se rehace sola.');
      }, 9000);
    }
    // Already live in the interface since the press; the audio is now flowing.
    return true;
  }

  /** The microphone did not open: the seat and the button go back at once. */
  function rollback() {
    micOnRef.current = false;
    setMicOn(false);
    setStatus('idle');
    if (roomId) void setSpeaking(roomId, false).catch(() => undefined);
  }

  /** Closes the microphone but keeps hearing the room. */
  function stop() {
    // Cancels a microphone that is still opening, so a tap while it starts
    // does not end with the room hearing the person anyway.
    startTicket.current += 1;
    audioRef.current?.setMicEnabled(false);
    // Back to plain playback: the call keeps the speaker route and the phone
    // does not hold the microphone session while nobody is speaking.
    void applyAudioMode(false);
    setMicOn(false);
    micOnRef.current = false;
    setStatus('idle');
    if (roomId) void setSpeaking(roomId, false).catch(() => undefined);
  }

  /** Cuts or restores the microphone. */
  function toggleMic() {
    if (micOn) stop();
    else void start();
  }

  /**
   * Opens or closes this person's camera. Like the microphone, the room must
   * be connected first; the phone asks for its own permission and the picture
   * reaches everyone already in the room.
   */
  async function toggleCamera(): Promise<boolean> {
    if (cameraBusy) return false;
    if (cameraOnRef.current) {
      audioRef.current?.stopCamera();
      cameraOnRef.current = false;
      setCameraOn(false);
      setCameraFacing('user');
      setVideos(current => current.filter(item => !item.self));
      return false;
    }
    if (!seatedRef.current) {
      errorRef.current('Siéntate en un asiento para prender tu cámara');
      return false;
    }
    if (!cameraAllowedRef.current) {
      errorRef.current('El anfitrión desactivó las cámaras en esta sala');
      return false;
    }
    setCameraBusy(true);
    try {
      if (!(await connect())) return false;
      const ok = (await audioRef.current?.startCamera()) ?? false;
      if (!ok) return false;
      cameraOnRef.current = true;
      setCameraOn(true);
      return true;
    } finally {
      setCameraBusy(false);
    }
  }

  /**
   * Turns the picture around: the front lens and the back lens show very
   * different things, and only the person holding the phone knows which one
   * the room should see.
   */
  async function switchCamera(): Promise<boolean> {
    if (cameraSwitching) return false;
    if (!cameraOnRef.current) {
      errorRef.current('Prende tu cámara para girarla');
      return false;
    }
    setCameraSwitching(true);
    try {
      const ok = (await audioRef.current?.switchCamera()) ?? false;
      if (ok) setCameraFacing(current => (current === 'user' ? 'environment' : 'user'));
      return ok;
    } finally {
      setCameraSwitching(false);
    }
  }

  // The reconnect path calls the newest version of start(), never one left
  // behind by an earlier render.
  startRef.current = start;

  return {
    status, connected, micOn, relay, remotes, members,
    start, connect, toggleMic, stop, leave: teardown, live: micOn,
    cameraOn, cameraBusy, videos, toggleCamera,
    cameraFacing, cameraSwitching, switchCamera,
    /** The phone's camera goes dark when the app leaves the screen. */
    stopCamera: () => {
      audioRef.current?.stopCamera();
      cameraOnRef.current = false;
      setCameraOn(false);
      setCameraFacing('user');
      setVideos(current => current.filter(item => !item.self));
    },
  };
}
