import type { LiveAudio, LiveAudioOptions, LiveSignal, LiveVideoEntry } from '@/lib/live-audio.types';
import { ICE_FALLBACK } from '@/lib/ice';

type RtcPeer = {
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  addTransceiver?: (kind: string, init: { direction: string }) => { sender?: { replaceTrack?: (track: MediaStreamTrack) => Promise<void> } } | undefined;
  createOffer: (options?: { iceRestart?: boolean }) => Promise<{ type: string; sdp?: string }>;
  createAnswer: () => Promise<{ type: string; sdp?: string }>;
  setLocalDescription: (description: unknown) => Promise<void>;
  setRemoteDescription: (description: unknown) => Promise<void>;
  addIceCandidate: (candidate: unknown) => Promise<void>;
  getSenders?: () => { track: { kind?: string } | null; replaceTrack?: (track: MediaStreamTrack) => Promise<void> }[];
  close: () => void;
  connectionState: string;
  iceConnectionState?: string;
  signalingState?: string;
  restartIce?: () => void;
  ontrack: ((event: { streams: MediaStream[]; track?: { kind?: string } }) => void) | null;
  onicecandidate: ((event: { candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
  oniceconnectionstatechange?: (() => void) | null;
};

type RtcPeerOptions = {
  iceServers: { urls: string; username?: string; credential?: string }[];
  /** "relay" builds the call through a relay only, never directly. */
  iceTransportPolicy?: 'all' | 'relay';
  bundlePolicy?: 'balanced' | 'max-compat' | 'max-bundle';
  rtcpMuxPolicy?: 'negotiate' | 'require';
  iceCandidatePoolSize?: number;
};

type RtcCtor = new (config: RtcPeerOptions) => RtcPeer;

/**
 * The room's own mixer. The browser caps an element's volume at 1, so quiet
 * people are lifted with a small gain and evened out by a compressor; that is
 * what makes the room audible on a phone speaker.
 */
let roomMixer: AudioContext | null = null;
let roomGain: GainNode | null = null;
const roomSources = new Map<string, MediaStreamAudioSourceNode>();

function mixerContext(): AudioContext | null {
  const base = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = base.AudioContext ?? base.webkitAudioContext;
  if (!Ctor) return null;
  if (roomMixer) return roomMixer;
  try {
    const context = new Ctor();
    const gain = context.createGain();
    gain.gain.value = 1.7;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -22;
    compressor.knee.value = 24;
    compressor.ratio.value = 3;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.22;
    gain.connect(compressor).connect(context.destination);
    roomMixer = context;
    roomGain = gain;
    return context;
  } catch {
    return null;
  }
}

/**
 * A phone that was interrupted — a call, the lock screen, another app playing
 * something — stops every sound until a touch resumes it. The room's button
 * and the first tap anywhere both call this, so the voices come straight back.
 */
export function unlockRoomAudio() {
  const context = roomMixer;
  if (context && context.state !== 'running') {
    void context.resume().then(() => {
      // The mixer is playing now: the plain elements go silent so the room is
      // never heard twice.
      const doc = (globalThis as unknown as { document?: Document }).document;
      for (const element of Array.from(doc?.querySelectorAll<HTMLAudioElement>('[data-spk-room-audio]') ?? [])) {
        if (roomSources.has(element.id)) element.volume = 0;
      }
    }).catch(() => undefined);
  }
  const doc = (globalThis as unknown as { document?: Document }).document;
  for (const element of Array.from(doc?.querySelectorAll<HTMLAudioElement>('[data-spk-room-audio]') ?? [])) {
    void element.play().catch(() => undefined);
  }
}

/**
 * Live voice on the web: one microphone stream sent directly to every other
 * listener in the room (mesh), so audio is heard while the person speaks.
 */
export function createLiveAudio({ selfId, iceServers, onSignal, onRemoteChange, onVideoChange, onError }: LiveAudioOptions): LiveAudio {
  const peers = new Map<string, RtcPeer>();
  // The audio channel every connection keeps open, so a browser that is only
  // listening still negotiates sound.
  const audioSenders = new Map<string, { replaceTrack?: (track: MediaStreamTrack) => Promise<void> } | null>();
  const remoteStreams = new Map<string, MediaStream>();
  const remoteVideos = new Map<string, MediaStream>();
  const lastJoin = new Map<string, number>();
  // One timer per call that notices a silent connection and rebuilds it.
  const recoveries = new Map<string, ReturnType<typeof setTimeout>>();
  const failures = new Map<string, number>();
  // Calls that already failed to connect directly are rebuilt through the
  // relay only, which is what gets the voice through a restrictive network.
  const relayOnly = new Set<string>();
  let local: MediaStream | null = null;
  let camera: MediaStream | null = null;
  let running = false;

  const notify = () => onRemoteChange([...remoteStreams.keys()]);
  const notifyVideos = () => {
    const list: LiveVideoEntry[] = [];
    if (camera) list.push({ id: selfId, source: { stream: camera }, self: true });
    for (const [id, stream] of remoteVideos) list.push({ id, source: { stream }, self: false });
    onVideoChange?.(list);
  };

  function attachStream(peerId: string, stream: MediaStream) {
    remoteStreams.set(peerId, stream);
    notify();
    const doc = (globalThis as unknown as { document?: Document }).document;
    if (!doc) return;
    let element = doc.getElementById(`sahar-audio-${peerId}`) as HTMLAudioElement | null;
    if (!element) {
      element = doc.createElement('audio');
      element.id = `sahar-audio-${peerId}`;
      element.dataset.spkRoomAudio = peerId;
      element.autoplay = true;
      (element as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      element.style.display = 'none';
      doc.body.appendChild(element);
    }
    if (element.srcObject !== stream) element.srcObject = stream;
    // The phone's speaker is often quiet next to the street: the room is
    // played through its own small mixer, which lifts a soft voice and keeps a
    // loud one from breaking up.
    routeThroughMixer(element, stream);
    void element.play().catch(() => undefined);
  }

  function routeThroughMixer(element: HTMLAudioElement, stream: MediaStream) {
    const context = mixerContext();
    if (!context || !roomGain) return;
    try {
      const current = roomSources.get(element.id);
      if (current) current.disconnect();
      const source = context.createMediaStreamSource(stream);
      source.connect(roomGain);
      roomSources.set(element.id, source);
      if (context.state !== 'running') void context.resume().catch(() => undefined);
      // Until the browser lets the mixer play (a phone needs one touch after an
      // interruption) the plain element carries the sound; once it does, the
      // element goes silent so nobody is heard twice.
      element.volume = context.state === 'running' ? 0 : 1;
    } catch {
      element.volume = 1;
    }
  }

  function dropPeer(peerId: string) {
    const timer = recoveries.get(peerId);
    if (timer) clearTimeout(timer);
    recoveries.delete(peerId);
    peers.get(peerId)?.close();
    peers.delete(peerId);
    audioSenders.delete(peerId);
    remoteStreams.delete(peerId);
    remoteVideos.delete(peerId);
    const doc = (globalThis as unknown as { document?: Document }).document;
    const source = roomSources.get(`sahar-audio-${peerId}`);
    if (source) {
      try { source.disconnect(); } catch { /* already gone */ }
      roomSources.delete(`sahar-audio-${peerId}`);
    }
    doc?.getElementById(`sahar-audio-${peerId}`)?.remove();
    notify();
    notifyVideos();
  }

  async function renegotiate(peerId: string, peer: RtcPeer, iceRestart = false) {
    if (peer.signalingState && peer.signalingState !== 'stable') return;
    try {
      const offer = await peer.createOffer(iceRestart ? { iceRestart: true } : undefined);
      await peer.setLocalDescription(offer);
      if (offer.sdp) onSignal({ kind: 'offer', from: selfId, to: peerId, sdp: offer.sdp });
    } catch {
      dropPeer(peerId);
    }
  }

  /**
   * A call that went quiet is not always closed: the path simply changed when
   * the phone moved between Wi-Fi and mobile data. After a short wait the
   * call gets fresh addresses, and only if that fails twice is it rebuilt.
   */
  function watchConnection(peerId: string, peer: RtcPeer) {
    const existing = recoveries.get(peerId);
    if (existing) clearTimeout(existing);
    const state = peer.connectionState;
    if (state === 'connected') {
      recoveries.delete(peerId);
      failures.delete(peerId);
      return;
    }
    // Nothing has been heard yet: give the first negotiation its own time.
    const wait = state === 'disconnected' ? 4000 : 16000;
    recoveries.set(peerId, setTimeout(() => {
      recoveries.delete(peerId);
      if (!running || !peers.has(peerId)) return;
      const current = peers.get(peerId);
      if (!current) return;
      const now = current.connectionState;
      if (now === 'connected') {
        failures.delete(peerId);
        return;
      }
      const attempts = failures.get(peerId) ?? 0;
      failures.set(peerId, attempts + 1);
      if (attempts < 3) {
        try {
          current.restartIce?.();
        } catch {
          // Older browsers only restart through the offer below.
        }
        void renegotiate(peerId, current, true);
        watchConnection(peerId, current);
        return;
      }
      dropPeer(peerId);
      onSignal({ kind: 'join', from: selfId });
    }, wait));
  }

  function connect(peerId: string): RtcPeer | null {
    const base = globalThis as unknown as {
      RTCPeerConnection?: RtcCtor;
      webkitRTCPeerConnection?: RtcCtor;
    };
    const Ctor = base.RTCPeerConnection ?? base.webkitRTCPeerConnection;
    if (!Ctor) {
      onError('Este teléfono no soporta voz en vivo. Actualiza el sistema.');
      return null;
    }
    const existing = peers.get(peerId);
    if (existing) return existing;

    const peer = new Ctor({
      iceServers: iceServers?.length ? iceServers : ICE_FALLBACK,
      ...(relayOnly.has(peerId) ? { iceTransportPolicy: 'relay' } : {}),
      // One bundled transport and multiplexed media: fewer ports to open, so a
      // strict office or hotel network lets the call through sooner.
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceCandidatePoolSize: 4,
    } as RtcPeerOptions);
    peers.set(peerId, peer);

    peer.ontrack = event => {
      const stream = event.streams[0];
      if (event.track?.kind === 'video') {
        if (stream) {
          remoteVideos.set(peerId, stream);
          notifyVideos();
        }
        return;
      }
      if (stream) attachStream(peerId, stream);
    };
    peer.onicecandidate = event => {
      const candidate = event.candidate;
      if (!candidate?.candidate) return;
      onSignal({
        kind: 'ice',
        from: selfId,
        to: peerId,
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid,
        sdpMLineIndex: candidate.sdpMLineIndex,
      });
    };
    const onState = () => {
      const state = peer.connectionState;
      if (state === 'connected') {
        failures.delete(peerId);
        const timer = recoveries.get(peerId);
        if (timer) clearTimeout(timer);
        recoveries.delete(peerId);
        return;
      }
      if (state === 'failed' || state === 'closed') {
        const attempts = failures.get(peerId) ?? 0;
        if (running && attempts < 1) {
          failures.set(peerId, attempts + 1);
          try {
            peer.restartIce?.();
          } catch {
            // The offer below carries the restart.
          }
          void renegotiate(peerId, peer, true);
          watchConnection(peerId, peer);
          return;
        }
        // The direct path did not answer: build the same call again through
        // the relay instead of leaving the two people without voice.
        if (running && !relayOnly.has(peerId)) {
          relayOnly.add(peerId);
          failures.delete(peerId);
          dropPeer(peerId);
          const relayed = connect(peerId);
          if (relayed) void renegotiate(peerId, relayed, true);
          return;
        }
        dropPeer(peerId);
        if (running) setTimeout(() => { if (running && !peers.has(peerId)) onSignal({ kind: 'join', from: selfId }); }, 900);
        return;
      }
      if (state === 'disconnected' || state === 'connecting' || state === 'new') watchConnection(peerId, peer);
    };
    peer.onconnectionstatechange = onState;
    peer.oniceconnectionstatechange = onState;
    watchConnection(peerId, peer);
    // Without an audio track an offer carries no media at all, and the answer
    // carries none either: nothing is heard until a camera adds a video track.
    // Reserving the audio channel from the first offer fixes that.
    const sender = peer.addTransceiver?.('audio', { direction: 'sendrecv' })?.sender ?? null;
    audioSenders.set(peerId, sender);
    const mic = local?.getAudioTracks()[0];
    if (mic && sender?.replaceTrack) void sender.replaceTrack(mic).catch(() => undefined);
    else if (local) for (const track of local.getAudioTracks()) { try { peer.addTrack(track, local); } catch { /* renegotiating */ } }
    if (camera) for (const track of camera.getTracks()) peer.addTrack(track, camera);
    return peer;
  }

  return {
    async start() {
      // Listening needs no permission: the microphone opens only on request.
      running = true;
      onSignal({ kind: 'join', from: selfId });
    },

    async enableMic() {
      // Reopening the microphone after muting wakes the same track instead of
      // asking for permission again.
      if (local) {
        for (const track of local.getAudioTracks()) track.enabled = true;
        return local.getAudioTracks().length > 0;
      }
      const media = (globalThis as unknown as { navigator?: Navigator }).navigator?.mediaDevices;
      if (!media?.getUserMedia) {
        onError('Este teléfono no permite voz en vivo.');
        return false;
      }
      try {
        local = await media.getUserMedia({
          // A clear voice from anywhere: the room's own echo and the street's
          // noise are filtered, a soft speaker is lifted, and the sound is
          // mono at a call's sample rate so a weak network keeps up.
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: { ideal: 48000 },
          },
          video: false,
        });
      } catch {
        onError('Necesitamos permiso de micrófono para hablar en vivo.');
        return false;
      }
      for (const track of local.getAudioTracks()) track.enabled = true;
      for (const [peerId, peer] of peers) {
        const track = local.getAudioTracks()[0];
        const sender = audioSenders.get(peerId);
        if (track && sender?.replaceTrack) {
          // The channel was offered from the start, so the room hears it now.
          await sender.replaceTrack(track).catch(() => undefined);
          continue;
        }
        for (const item of local.getTracks()) {
          try { peer.addTrack(item, local); } catch { /* the peer is renegotiating */ }
        }
        void renegotiate(peerId, peer);
      }
      return true;
    },

    stop() {
      running = false;
      for (const timer of recoveries.values()) clearTimeout(timer);
      recoveries.clear();
      failures.clear();
      relayOnly.clear();
      local?.getTracks().forEach(track => track.stop());
      local = null;
      camera?.getTracks().forEach(track => track.stop());
      camera = null;
      for (const peerId of [...peers.keys()]) dropPeer(peerId);
      notifyVideos();
      if (running === false) onSignal({ kind: 'leave', from: selfId });
    },

    async startCamera() {
      if (camera) return true;
      if (!running) return false;
      const media = (globalThis as unknown as { navigator?: Navigator }).navigator?.mediaDevices;
      if (!media?.getUserMedia) {
        onError('Este teléfono no permite cámara en vivo.');
        return false;
      }
      try {
        camera = await media.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      } catch {
        onError('Necesitamos permiso de cámara para salir en vivo.');
        return false;
      }
      for (const [peerId, peer] of peers) {
        for (const track of camera.getTracks()) {
          try { peer.addTrack(track, camera); } catch { /* the peer is renegotiating */ }
        }
        void renegotiate(peerId, peer);
      }
      notifyVideos();
      onSignal({ kind: 'camera', from: selfId, on: true });
      return true;
    },

    stopCamera() {
      if (!camera) return;
      camera.getTracks().forEach(track => track.stop());
      camera = null;
      notifyVideos();
      onSignal({ kind: 'camera', from: selfId, on: false });
    },

    async switchCamera() {
      const media = (globalThis as unknown as { navigator?: Navigator }).navigator?.mediaDevices;
      if (!camera || !media?.getUserMedia) return false;
      const current = camera.getVideoTracks()[0];
      const facing = (current?.getSettings?.() as { facingMode?: string } | undefined)?.facingMode;
      const next = facing === 'environment' ? 'user' : 'environment';
      try {
        const replacement = await media.getUserMedia({
          video: { facingMode: { ideal: next }, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        const track = replacement.getVideoTracks()[0];
        if (!track) return false;
        for (const peer of peers.values()) {
          for (const sender of peer.getSenders?.() ?? []) {
            if (sender.track?.kind === 'video') void sender.replaceTrack?.(track).catch(() => undefined);
          }
        }
        camera.getTracks().forEach(item => item.stop());
        camera = replacement;
        notifyVideos();
        return true;
      } catch {
        onError('No pudimos cambiar de cámara en este teléfono');
        return false;
      }
    },

    setMicEnabled(on: boolean) {
      for (const track of local?.getAudioTracks() ?? []) track.enabled = on;
    },

    cameraOn() {
      return Boolean(camera);
    },

    videos() {
      const list: LiveVideoEntry[] = [];
      if (camera) list.push({ id: selfId, source: { stream: camera }, self: true });
      for (const [id, stream] of remoteVideos) list.push({ id, source: { stream }, self: false });
      return list;
    },

    receive(signal: LiveSignal) {
      if (!running || signal.from === selfId) return;
      const peerId = signal.from;
      const to = 'to' in signal ? signal.to : undefined;
      if (to && to !== selfId) return;
      if (signal.kind === 'leave') {
        dropPeer(peerId);
        return;
      }
      if (signal.kind === 'camera') {
        if (!signal.on) {
          remoteVideos.delete(peerId);
          notifyVideos();
        }
        return;
      }
      if (signal.kind === 'join') {
        const existing = peers.get(peerId);
        if (existing) {
          if (!existing.signalingState || existing.signalingState === 'stable') {
            void renegotiate(peerId, existing);
            return;
          }
          // A half-finished negotiation would block every later attempt, so
          // it is restarted once instead of waiting forever.
          if (Date.now() - (lastJoin.get(peerId) ?? 0) < 1500) return;
          dropPeer(peerId);
        }
        lastJoin.set(peerId, Date.now());
        const peer = connect(peerId);
        if (peer) void renegotiate(peerId, peer);
        return;
      }
      if (signal.kind === 'offer') {
        const peer = connect(peerId);
        if (!peer) return;
        // Both sides offered at once: the lower id keeps its offer, the other
        // accepts this one instead of failing the call.
        const busy = Boolean(peer.signalingState && peer.signalingState !== 'stable'
          && peer.signalingState !== 'have-remote-offer');
        if (busy && selfId < peerId) return;
        void peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp })
          .then(() => peer.createAnswer())
          .then(answer => peer.setLocalDescription(answer).then(() => answer))
          .then(answer => {
            if (!answer.sdp) return;
            onSignal({ kind: 'answer', from: selfId, to: peerId, sdp: answer.sdp });
          })
          .catch(() => dropPeer(peerId));
        return;
      }
      if (signal.kind === 'answer') {
        const peer = peers.get(peerId);
        if (peer) void peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp }).catch(() => dropPeer(peerId));
        return;
      }
      const peer = peers.get(peerId);
      if (peer) {
        void peer.addIceCandidate({ candidate: signal.candidate, sdpMid: signal.sdpMid, sdpMLineIndex: signal.sdpMLineIndex }).catch(() => undefined);
      }
    },

    remotes() {
      return [...remoteStreams.keys()];
    },

    /** Back from sleep or another network: dead calls are rebuilt. */
    resume() {
      if (!running) return;
      for (const [peerId, peer] of peers) {
        if (peer.connectionState === 'connected') continue;
        failures.set(peerId, 0);
        try {
          peer.restartIce?.();
        } catch {
          // The offer below carries the restart.
        }
        void renegotiate(peerId, peer, true);
        watchConnection(peerId, peer);
      }
      unlockRoomAudio();
      onSignal({ kind: 'join', from: selfId });
    },
  };
}
