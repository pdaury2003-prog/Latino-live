import type { MediaStream, RTCPeerConnection, RTCIceCandidate } from 'react-native-webrtc';
import type { LiveAudio, LiveAudioOptions, LiveSignal, LiveVideoEntry } from './live-audio.types';
import { webrtc } from './webrtc';
import { ICE_FALLBACK } from './ice.ts';

type Peer = RTCPeerConnection;

type AudioSender = { replaceTrack?: (track: unknown) => Promise<void> } | null;
type IcePart = { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null };

/**
 * Live voice on Android: the microphone stream goes straight to every other
 * listener in the room, so the room hears the person while they speak.
 */
export function createLiveAudio({ selfId, iceServers, onSignal, onRemoteChange, onVideoChange, onError }: LiveAudioOptions): LiveAudio {
  const peers = new Map<string, Peer>();
  // The audio channel every connection keeps open, so a phone that is only
  // listening still negotiates sound.
  const audioSenders = new Map<string, AudioSender>();
  // Candidates can arrive before the other phone's description does; adding
  // one that early fails and is lost, so they wait here until it is ready.
  const earlyCandidates = new Map<string, IcePart[]>();
  // How many times a broken path was restarted, so a phone that keeps failing
  // ends up rebuilding the call instead of looping.
  const restarts = new Map<string, number>();
  // Calls that already failed to connect directly. They are rebuilt through
  // the relay only, which is what gets the voice through a hotel, an office or
  // a carrier that blocks the direct path between two countries.
  const relayOnly = new Set<string>();
  // One timer per call that notices a silent connection and tries again.
  const checks = new Map<string, ReturnType<typeof setTimeout>>();
  const remoteIds = new Set<string>();
  const remoteVideos = new Map<string, MediaStream>();
  const lastJoin = new Map<string, number>();
  let local: MediaStream | null = null;
  // The microphone opening in flight: two quick taps share one capture
  // instead of asking the phone for the microphone twice.
  let opening: Promise<MediaStream | null> | null = null;
  let camera: MediaStream | null = null;
  let running = false;

  /**
   * Opens the phone's microphone once and hands it to every open call. The
   * track starts silent, so nothing is sent until the person speaks; keeping
   * it silent is what makes the button answer at once afterwards.
   */
  async function openMicrophone(): Promise<MediaStream | null> {
    if (local) return local;
    if (opening) return opening;
    const sdk = webrtc();
    if (!sdk) {
      onError('Este teléfono no puede abrir salas en vivo con esta versión.');
      return null;
    }
    opening = (async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await sdk.mediaDevices.getUserMedia({
          // The Android module types omit the audio processing flags; the
          // engine accepts them, and they keep the voice clean and even.
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            channelCount: 1,
            sampleRate: 48000,
          } as unknown as boolean,
          video: false,
        });
        local = stream;
      } catch {
        onError('Necesitamos permiso de micrófono para hablar en vivo.');
      } finally {
        opening = null;
      }
      if (!stream) return null;
      // A clear, audible voice: the microphone signal is sent with gain, so
      // the room does not have to turn the phone all the way up.
      for (const track of stream.getAudioTracks()) {
        track.enabled = false;
        (track as unknown as { _setVolume?: (level: number) => void })._setVolume?.(1.8);
      }
      // Every call gets the channel now, silent: turning it on later is one
      // flag, not a new negotiation.
      const mic = stream.getAudioTracks()[0];
      for (const [peerId, peer] of peers) {
        const sender = audioSenders.get(peerId);
        if (mic && sender?.replaceTrack) {
          void sender.replaceTrack(mic).catch(() => undefined);
          continue;
        }
        for (const item of stream.getTracks()) {
          try { peer.addTrack(item, stream); } catch { /* the peer is renegotiating */ }
        }
        void renegotiate(peerId, peer);
      }
      return stream;
    })();
    return opening;
  }

  const notify = () => onRemoteChange([...remoteIds]);
  const notifyVideos = () => {
    const list: LiveVideoEntry[] = [];
    if (camera) list.push({ id: selfId, source: { url: camera.toURL() }, self: true });
    for (const [id, stream] of remoteVideos) list.push({ id, source: { url: stream.toURL() }, self: false });
    onVideoChange?.(list);
  };

  function dropPeer(peerId: string) {
    const timer = checks.get(peerId);
    if (timer) clearTimeout(timer);
    checks.delete(peerId);
    try {
      peers.get(peerId)?.close();
    } catch {
      // A peer that already closed needs no cleanup.
    }
    peers.delete(peerId);
    audioSenders.delete(peerId);
    earlyCandidates.delete(peerId);
    restarts.delete(peerId);
    remoteIds.delete(peerId);
    remoteVideos.delete(peerId);
    notify();
    notifyVideos();
  }

  async function renegotiate(peerId: string, peer: Peer, iceRestart = false) {
    if (peer.signalingState && peer.signalingState !== 'stable') return;
    try {
      const offer = await peer.createOffer(iceRestart ? ({ iceRestart: true } as never) : undefined);
      await peer.setLocalDescription(offer as never);
      onSignal({ kind: 'offer', from: selfId, to: peerId, sdp: String(offer.sdp) });
    } catch {
      dropPeer(peerId);
    }
  }

  /**
   * A phone wakes up on another network: the old path is dead but the call
   * still exists, so it is restarted with fresh addresses before anything is
   * thrown away.
   */
  function restartPeer(peerId: string, peer: Peer) {
    try {
      if (typeof peer.restartIce === 'function') peer.restartIce();
    } catch {
      // Older engines restart through the offer below.
    }
    void renegotiate(peerId, peer, true);
  }

  function connect(peerId: string): Peer | null {
    const existing = peers.get(peerId);
    if (existing) return existing;
    const sdk = webrtc();
    if (!sdk) {
      onError('Este teléfono no puede abrir salas en vivo con esta versión.');
      return null;
    }
    const peer = new sdk.RTCPeerConnection({
      // Two phones on mobile data sit behind different carriers: without a
      // relay they never find each other and the room stays silent. The list
      // comes from the project's own server.
      iceServers: iceServers?.length ? iceServers : ICE_FALLBACK,
      // A call that already failed directly goes through the relay on the
      // second try, so two people in different countries still hear each other.
      iceTransportPolicy: relayOnly.has(peerId) ? 'relay' : 'all',
      // One bundled transport and multiplexed media mean fewer ports to open,
      // which is what makes a call get through a strict network faster.
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      // Addresses are gathered while the person is still joining the room.
      iceCandidatePoolSize: 4,
    });
    peers.set(peerId, peer);
    remoteIds.add(peerId);
    notify();

    peer.addEventListener('icecandidate', event => {
      const candidate = event.candidate as RTCIceCandidate | null;
      if (!candidate?.candidate) return;
      onSignal({
        kind: 'ice',
        from: selfId,
        to: peerId,
        candidate: candidate.candidate,
        sdpMid: candidate.sdpMid ?? null,
        sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      });
    });
    peer.addEventListener('track', event => {
      const track = (event as unknown as { track?: { kind?: string } }).track;
      const stream = (event as unknown as { streams?: MediaStream[] }).streams?.[0];
      if (track?.kind === 'video') {
        if (stream) {
          remoteVideos.set(peerId, stream);
          notifyVideos();
        }
        return;
      }
      // The room is heard at a comfortable level even on phones whose media
      // volume sits low, and a quiet speaker still comes through.
      (track as unknown as { _setVolume?: (level: number) => void } | undefined)?._setVolume?.(1.8);
      remoteIds.add(peerId);
      notify();
    });
    peer.addEventListener('connectionstatechange', () => {
      const state = peer.connectionState;
      if (state === 'connected') {
        restarts.delete(peerId);
        const timer = checks.get(peerId);
        if (timer) clearTimeout(timer);
        checks.delete(peerId);
        return;
      }
      if (state === 'failed') {
        // One restart usually fixes a path that broke on a network change.
        const restarted = restarts.get(peerId) ?? 0;
        if (running && restarted < 1) {
          restarts.set(peerId, restarted + 1);
          restartPeer(peerId, peer);
          scheduleCheck(peerId, peer, 5000, 1);
          return;
        }
        // The direct path did not answer: the same call is built again through
        // the relay instead of giving up on the person.
        if (running && !relayOnly.has(peerId)) {
          relayOnly.add(peerId);
          restarts.set(peerId, 0);
          dropPeer(peerId);
          const relayed = connect(peerId);
          if (relayed) void renegotiate(peerId, relayed);
          return;
        }
        dropPeer(peerId);
        if (running) {
          setTimeout(() => {
            if (running && !peers.has(peerId)) onSignal({ kind: 'join', from: selfId });
          }, 1200);
        }
        return;
      }
      if (state === 'closed') {
        dropPeer(peerId);
        // A phone that lost its network comes back without anyone leaving the
        // room: the other side is asked to build the call again.
        if (running) {
          setTimeout(() => {
            if (running && !peers.has(peerId)) onSignal({ kind: 'join', from: selfId });
          }, 1200);
        }
        return;
      }
      // A weak network drops to "disconnected" first; one fresh offer usually
      // brings the voice back before it is lost.
      if (state === 'disconnected') {
        scheduleCheck(peerId, peer, 3500);
        return;
      }
      if (state === 'new' || state === 'connecting') scheduleCheck(peerId, peer, 15000);
    });

    // Without an audio track an offer carries no media at all, and the answer
    // carries none either: nothing is heard until a camera adds a video track.
    // Reserving the audio channel from the first offer fixes that.
    const transceiver = peer.addTransceiver('audio', { direction: 'sendrecv' }) as unknown as { sender?: { replaceTrack?: (track: unknown) => Promise<void> } };
    const sender: AudioSender = transceiver?.sender ?? null;
    audioSenders.set(peerId, sender);

    const mic = local?.getAudioTracks()[0];
    if (mic && sender?.replaceTrack) void sender.replaceTrack(mic).catch(() => undefined);
    else if (local) for (const track of local.getAudioTracks()) { try { peer.addTrack(track, local); } catch { /* renegotiating */ } }
    if (camera) for (const track of camera.getTracks()) peer.addTrack(track, camera);
    return peer;
  }

  /**
   * A call that went quiet is not always dead: the path simply changed when
   * the phone moved between Wi-Fi and mobile data. The call gets fresh
   * addresses first, and only after two failed tries is it rebuilt.
   */
  function scheduleCheck(peerId: string, peer: Peer, delay = 4000, tries = 0) {
    const existing = checks.get(peerId);
    if (existing) clearTimeout(existing);
    checks.set(peerId, setTimeout(() => {
      checks.delete(peerId);
      if (!running || !peers.has(peerId)) return;
      const current = peers.get(peerId);
      if (!current) return;
      if (current.connectionState === 'connected') {
        restarts.delete(peerId);
        return;
      }
      if (tries < 2) {
        restartPeer(peerId, current);
        scheduleCheck(peerId, current, 5000, tries + 1);
        return;
      }
      dropPeer(peerId);
      if (running) {
        setTimeout(() => {
          if (running && !peers.has(peerId)) onSignal({ kind: 'join', from: selfId });
        }, 900);
      }
    }, delay));
  }

  /** Candidates that arrived early, now that the other phone described itself. */
  function flushCandidates(peerId: string, peer: Peer) {
    const list = earlyCandidates.get(peerId);
    if (!list?.length) return;
    earlyCandidates.delete(peerId);
    const sdk = webrtc();
    if (!sdk) return;
    for (const part of list) {
      void peer.addIceCandidate(new sdk.RTCIceCandidate(part)).catch(() => undefined);
    }
  }

  return {
    async start() {
      // Listening needs no permission: the microphone opens only on request.
      running = true;
      onSignal({ kind: 'join', from: selfId });
    },

    async prepareMic() {
      // Opened here, silent: the room hears the person the instant the button
      // turns the track on.
      return Boolean(await openMicrophone());
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
          // The channel was offered from the start, so the room hears it now,
          // without waiting for a new negotiation.
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

    stop() {
      running = false;
      for (const timer of checks.values()) clearTimeout(timer);
      checks.clear();
      relayOnly.clear();
      restarts.clear();
      onSignal({ kind: 'leave', from: selfId });
      local?.getTracks().forEach(track => track.stop());
      local = null;
      camera?.getTracks().forEach(track => track.stop());
      camera = null;
      for (const peerId of [...peers.keys()]) dropPeer(peerId);
      notifyVideos();
    },

    async startCamera() {
      if (camera) return true;
      if (!running) return false;
      const sdk = webrtc();
      if (!sdk) {
        onError('Este teléfono no puede usar la cámara con esta versión.');
        return false;
      }
      try {
        camera = await sdk.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: 640, height: 480 } });
      } catch (cause) {
        // A phone without a lens and a refused permission need different words.
        const message = cause instanceof Error ? cause.message : '';
        const denied = /permission|denied|not allowed|security/i.test(message);
        onError(denied
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
      if (!camera) return false;
      const stream = camera;
      const track = stream.getVideoTracks()[0] as unknown as {
        _switchCamera?: () => void;
        getSettings?: () => { facingMode?: string };
      } | undefined;
      // Most phones flip the track in place; it is the cheapest way and keeps
      // the picture connected while it turns.
      if (track?._switchCamera) {
        try {
          track._switchCamera();
          return true;
        } catch {
          // Fall through to opening the other lens below.
        }
      }
      // A phone whose track cannot flip gets a fresh stream from the other
      // side, and every peer is handed the new track instead of reconnecting.
      const sdk = webrtc();
      if (!sdk) return false;
      const facing = track?.getSettings?.()?.facingMode;
      const next = facing === 'environment' ? 'user' : 'environment';
      try {
        const replacement = await sdk.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: next, width: 640, height: 480 },
        });
        const nextTrack = replacement.getVideoTracks()[0];
        if (!nextTrack) {
          replacement.getTracks().forEach(item => item.stop());
          return false;
        }
        for (const peer of peers.values()) {
          for (const sender of peer.getSenders?.() ?? []) {
            if (sender.track?.kind === 'video' && sender.replaceTrack) {
              void sender.replaceTrack(nextTrack).catch(() => undefined);
            }
          }
        }
        stream.getTracks().forEach(item => item.stop());
        camera = replacement;
        notifyVideos();
        return true;
      } catch {
        onError('Este teléfono no tiene otra cámara para girar.');
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
      if (camera) list.push({ id: selfId, source: { url: camera.toURL() }, self: true });
      for (const [id, stream] of remoteVideos) list.push({ id, source: { url: stream.toURL() }, self: false });
      return list;
    },

    receive(signal: LiveSignal) {
      if (!running || signal.from === selfId) return;
      const to = 'to' in signal ? signal.to : undefined;
      if (to && to !== selfId) return;
      const peerId = signal.from;

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
        // Only the lower id starts the call. When both phones offered at once
        // neither answered, and the room stayed silent for everyone.
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
        const sdk = webrtc();
        if (!sdk) return;
        // A phone that already had an offer of its own gives it up here: two
        // offers in flight is what froze the call before.
        const rollback = peer.signalingState === 'have-local-offer'
          ? peer.setRemoteDescription({ type: 'rollback' } as never).catch(() => undefined)
          : Promise.resolve();
        void rollback
          .then(() => peer.setRemoteDescription(new sdk.RTCSessionDescription({ type: 'offer', sdp: signal.sdp })))
          .then(() => flushCandidates(peerId, peer))
          .then(() => peer.createAnswer())
          .then(answer => peer.setLocalDescription(answer as never).then(() => answer))
          .then(answer => onSignal({ kind: 'answer', from: selfId, to: peerId, sdp: String(answer.sdp) }))
          .catch(() => dropPeer(peerId));
        return;
      }
      if (signal.kind === 'answer') {
        const peer = peers.get(peerId);
        const sdk = webrtc();
        if (peer) {
          if (!sdk) return;
          void peer.setRemoteDescription(new sdk.RTCSessionDescription({ type: 'answer', sdp: signal.sdp }))
            .then(() => flushCandidates(peerId, peer))
            .catch(() => dropPeer(peerId));
        }
        return;
      }
      const peer = peers.get(peerId);
      const sdk = webrtc();
      if (peer) {
        if (!sdk) return;
        const part: IcePart = { candidate: signal.candidate, sdpMid: signal.sdpMid, sdpMLineIndex: signal.sdpMLineIndex };
        // Before the description is set the phone refuses the candidate, and
        // that refusal used to lose the only path between the two people.
        if (!peer.remoteDescription) {
          const list = earlyCandidates.get(peerId) ?? [];
          list.push(part);
          earlyCandidates.set(peerId, list);
          return;
        }
        void peer
          .addIceCandidate(new sdk.RTCIceCandidate(part))
          .catch(() => undefined);
      }
    },

    remotes() {
      return [...remoteIds];
    },

    /**
     * The phone was asleep, on a call or changed network: every connection is
     * checked, broken ones restart with fresh addresses, and the room is told
     * this person is still here.
     */
    resume() {
      if (!running) return;
      for (const [peerId, peer] of peers) {
        const state = peer.connectionState;
        if (state === 'failed' || state === 'disconnected') {
          restarts.set(peerId, 0);
          restartPeer(peerId, peer);
        } else if (state === 'new' || state === 'connecting') {
          if (peer.signalingState === 'stable') void renegotiate(peerId, peer);
        }
      }
      onSignal({ kind: 'join', from: selfId });
    },
  };
}
