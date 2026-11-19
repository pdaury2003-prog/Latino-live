import type { LiveAudio, LiveAudioOptions, LiveSignal, LiveVideoEntry } from './live-audio.types';
import { ICE_FALLBACK } from './ice.ts';

type RtcPeer = {
  addTrack: (track: MediaStreamTrack, stream: MediaStream) => void;
  addTransceiver?: (kind: string, init: { direction: string }) => { sender?: { replaceTrack?: (track: MediaStreamTrack) => Promise<void> } } | undefined;
  createOffer: () => Promise<{ type: string; sdp?: string }>;
  createAnswer: () => Promise<{ type: string; sdp?: string }>;
  setLocalDescription: (description: unknown) => Promise<void>;
  setRemoteDescription: (description: unknown) => Promise<void>;
  addIceCandidate: (candidate: unknown) => Promise<void>;
  getSenders?: () => { track: { kind?: string } | null; replaceTrack?: (track: MediaStreamTrack) => Promise<void> }[];
  getReceivers?: () => { track?: { kind?: string } | null }[];
  close: () => void;
  connectionState: string;
  signalingState?: string;
  ontrack: ((event: { streams: MediaStream[]; track?: { kind?: string } }) => void) | null;
  onicecandidate: ((event: { candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } | null }) => void) | null;
  onconnectionstatechange: (() => void) | null;
};

type RtcCtor = new (config: { iceServers: { urls: string; username?: string; credential?: string }[] }) => RtcPeer;

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
  let local: MediaStream | null = null;
  // The microphone opening in flight: two quick taps share one capture.
  let opening: Promise<MediaStream | null> | null = null;
  let camera: MediaStream | null = null;
  let running = false;

  /**
   * Opens the browser's microphone once, silent, and hands it to every open
   * call. Nothing is sent until the person speaks; keeping it open is what
   * makes the button answer at once afterwards.
   */
  async function openMicrophone(): Promise<MediaStream | null> {
    if (local) return local;
    if (opening) return opening;
    const media = (globalThis as unknown as { navigator?: Navigator }).navigator?.mediaDevices;
    if (!media?.getUserMedia) {
      onError('Este teléfono no permite voz en vivo.');
      return null;
    }
    opening = (async () => {
      try {
        local = await media.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
      } catch {
        onError('Necesitamos permiso de micrófono para hablar en vivo.');
        return null;
      } finally {
        opening = null;
      }
      for (const track of local.getAudioTracks()) track.enabled = false;
      const mic = local.getAudioTracks()[0];
      for (const [peerId, peer] of peers) {
        const sender = audioSenders.get(peerId);
        if (mic && sender?.replaceTrack) {
          void sender.replaceTrack(mic).catch(() => undefined);
          continue;
        }
        for (const item of local.getTracks()) {
          try { peer.addTrack(item, local); } catch { /* the peer is renegotiating */ }
        }
        void renegotiate(peerId, peer);
      }
      return local;
    })();
    return opening;
  }

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
      element.autoplay = true;
      (element as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      element.style.display = 'none';
      doc.body.appendChild(element);
    }
    if (element.srcObject !== stream) element.srcObject = stream;
    void element.play().catch(() => undefined);
  }

  /**
   * The room's sound lives in a track, not in an SDP stream name. A call whose
   * audio channel was reserved before anyone spoke arrives with no stream at
   * all, so the track is wrapped here: the player exists from the first answer
   * and starts sounding the moment the other person turns the microphone on.
   */
  function playable(track: unknown, streams: MediaStream[] | undefined) {
    const stream = streams?.[0];
    if (stream) return stream;
    const Ctor = (globalThis as unknown as { MediaStream?: new (tracks: unknown[]) => MediaStream }).MediaStream;
    if (!track || !Ctor) return null;
    try {
      return new Ctor([track]);
    } catch {
      return null;
    }
  }

  /**
   * The phone that made the offer created its audio channel itself, so the
   * browser never announces the other person's track on that side. Reading the
   * receivers once the answer lands gives that phone its player too, and both
   * people hear each other instead of only one of them.
   */
  function attachReceivers(peerId: string, peer: RtcPeer) {
    if (remoteStreams.has(peerId)) return;
    const Ctor = (globalThis as unknown as { MediaStream?: new (tracks: unknown[]) => MediaStream }).MediaStream;
    if (!Ctor) return;
    const tracks = (peer.getReceivers?.() ?? [])
      .map(receiver => receiver.track)
      .filter((track): track is { kind?: string } => Boolean(track) && track?.kind === 'audio');
    if (!tracks.length) return;
    try {
      attachStream(peerId, new Ctor(tracks));
    } catch {
      // A browser without MediaStream construction keeps the plain track path.
    }
  }

  function dropPeer(peerId: string) {
    peers.get(peerId)?.close();
    peers.delete(peerId);
    audioSenders.delete(peerId);
    remoteStreams.delete(peerId);
    remoteVideos.delete(peerId);
    const doc = (globalThis as unknown as { document?: Document }).document;
    doc?.getElementById(`sahar-audio-${peerId}`)?.remove();
    notify();
    notifyVideos();
  }

  async function renegotiate(peerId: string, peer: RtcPeer) {
    if (peer.signalingState && peer.signalingState !== 'stable') return;
    try {
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      if (offer.sdp) onSignal({ kind: 'offer', from: selfId, to: peerId, sdp: offer.sdp });
    } catch {
      dropPeer(peerId);
    }
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

    const peer = new Ctor({ iceServers: iceServers?.length ? iceServers : ICE_FALLBACK });
    peers.set(peerId, peer);

    peer.ontrack = event => {
      const stream = playable(event.track, event.streams);
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
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === 'failed' || peer.connectionState === 'closed') dropPeer(peerId);
    };
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
      const stream = await openMicrophone();
      if (!stream) return false;
      // Already opened: turning it on is one flag, so the room hears it now.
      for (const track of stream.getAudioTracks()) track.enabled = true;
      for (const [peerId, peer] of peers) {
        const track = stream.getAudioTracks()[0];
        const sender = audioSenders.get(peerId);
        if (track && sender?.replaceTrack) {
          // The channel was offered from the start, so the room hears it now.
          await sender.replaceTrack(track).catch(() => undefined);
          continue;
        }
        for (const item of stream.getTracks()) {
          try { peer.addTrack(item, stream); } catch { /* the peer is renegotiating */ }
        }
        void renegotiate(peerId, peer);
      }
      return true;
    },

    async prepareMic() {
      // Opened here, silent, so the button answers at once afterwards.
      return Boolean(await openMicrophone());
    },

    stop() {
      running = false;
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
      } catch (cause) {
        // A phone with no camera and a refused permission need different words.
        const name = (cause as { name?: string } | null)?.name ?? '';
        onError(name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Necesitamos permiso de cámara para salir en vivo. Actívalo en los ajustes del teléfono.'
          : 'No encontramos una cámara para salir en vivo en este teléfono.');
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
        const peer = connect(peerId);
        if (!peer) return;
        // Only the lower id starts the call. When both offered at once neither
        // answered, and the room stayed silent for everyone.
        if (selfId > peerId) return;
        if (!peer.signalingState || peer.signalingState === 'stable') {
          void renegotiate(peerId, peer);
          return;
        }
        // A half-finished negotiation would block every later attempt, so it
        // is restarted once instead of waiting forever.
        if (Date.now() - (lastJoin.get(peerId) ?? 0) < 2000) return;
        lastJoin.set(peerId, Date.now());
        dropPeer(peerId);
        const fresh = connect(peerId);
        if (fresh) void renegotiate(peerId, fresh);
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
        // An offer of our own in flight has to be given up before the other
        // one can be accepted: the browser refuses it otherwise.
        const rollback = peer.signalingState === 'have-local-offer'
          ? peer.setRemoteDescription({ type: 'rollback' }).catch(() => undefined)
          : Promise.resolve();
        void rollback
          .then(() => peer.setRemoteDescription({ type: 'offer', sdp: signal.sdp }))
          .then(() => attachReceivers(peerId, peer))
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
        if (peer) void peer.setRemoteDescription({ type: 'answer', sdp: signal.sdp })
          .then(() => attachReceivers(peerId, peer))
          .catch(() => dropPeer(peerId));
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
        if (peer.connectionState === 'failed' || peer.connectionState === 'disconnected') {
          dropPeer(peerId);
        }
      }
      onSignal({ kind: 'join', from: selfId });
    },
  };
}
