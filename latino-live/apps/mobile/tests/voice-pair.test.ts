import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveAudio } from '../lib/live-audio.ts';
import type { LiveSignal } from '../lib/live-audio.types.ts';

/**
 * Two phones in one room, wired through a fake radio: every signal one side
 * sends reaches the other, exactly like the room channel does. The peer
 * connection models what a browser really does with an audio channel that was
 * reserved before anyone spoke, which is where the room went silent.
 */

type FakeTrack = { kind: string; enabled: boolean; stop: () => void };

/** Whatever a player can hold: a capture track or a received one. */
type PlayableTrack = { kind: string; muted?: boolean };

class FakeStream {
  tracks: PlayableTrack[];
  constructor(tracks: PlayableTrack[]) {
    this.tracks = tracks;
  }
  getTracks() { return this.tracks; }
  // A player can hold a capture track or a received one; both are audio.
  getAudioTracks() { return this.tracks.filter(track => track.kind === 'audio') as FakeTrack[]; }
  getVideoTracks() { return this.tracks.filter(track => track.kind === 'video'); }
}

type Transceiver = {
  kind: string;
  upstream: Transceiver | null;
  downstream: Transceiver | null;
  sender: { track: FakeTrack | null; replaceTrack: (track: FakeTrack | null) => Promise<void> };
  receiver: { kind: string; muted: boolean; stop: () => void };
};

const phones = new Map<string, FakePeer>();
let counter = 0;

class FakePeer {
  id = `phone-${++counter}`;
  signalingState = 'stable';
  connectionState = 'new';
  localDescription: unknown = null;
  remoteDescription: { type?: string } | null = null;
  transceivers: Transceiver[] = [];
  ontrack: ((event: { track?: { kind?: string }; streams: FakeStream[] }) => void) | null = null;
  onicecandidate: ((event: { candidate: { candidate: string; sdpMid: string; sdpMLineIndex: number } | null }) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  config: unknown;
  constructor(config: unknown) {
    this.config = config;
    phones.set(this.id, this);
  }

  addTransceiver(kind: string) {
    const tr: Transceiver = {
      kind,
      upstream: null,
      downstream: null,
      sender: { track: null, replaceTrack: async track => { tr.sender.track = track; } },
      receiver: {
        kind,
        get muted() {
          const source = tr.upstream?.sender.track ?? tr.downstream?.sender.track;
          return !source || !source.enabled;
        },
        stop() {},
      } as unknown as Transceiver['receiver'],
    };
    this.transceivers.push(tr);
    return { sender: tr.sender };
  }

  addTrack(track: FakeTrack) {
    const tr = this.transceivers.find(item => !item.sender.track) ?? this.transceivers[0];
    if (tr) tr.sender.track = track;
  }

  getReceivers() { return this.transceivers.map(tr => ({ track: tr.receiver })); }

  async createOffer() {
    return { type: 'offer', sdp: `v=0\r\na=phone:${this.id}\r\n` };
  }
  async createAnswer() {
    return { type: 'answer', sdp: `v=0\r\na=phone:${this.id}\r\n` };
  }

  async setLocalDescription(description: { type: string; sdp?: string }) {
    this.localDescription = { ...description };
    this.signalingState = description.type === 'offer' ? 'have-local-offer' : 'stable';
    if (description.type === 'answer') {
      // The answer completes the exchange on the side that accepted the call.
      this.connectionState = 'connected';
      this.onconnectionstatechange?.();
    }
    this.onicecandidate?.({ candidate: { candidate: 'candidate:1 1 udp 1 10.0.0.1 5000 typ host', sdpMid: '0', sdpMLineIndex: 0 } });
  }

  async setRemoteDescription(description: { type: string; sdp?: string }) {
    if (description.type === 'rollback') {
      if (this.signalingState !== 'have-local-offer') throw new Error('InvalidStateError: cannot roll back');
      this.signalingState = 'stable';
      this.localDescription = null;
      return;
    }
    if (description.type === 'answer') {
      if (this.signalingState !== 'have-local-offer') throw new Error('InvalidStateError: answer without an offer');
      this.signalingState = 'stable';
      this.remoteDescription = { ...description };
      this.connectionState = 'connected';
      this.onconnectionstatechange?.();
      return;
    }
    if (this.signalingState !== 'stable') throw new Error('InvalidStateError: offer in the wrong state');
    const remote = phones.get(/a=phone:(\S+)/.exec(description.sdp ?? '')?.[1] ?? '');
    if (!remote) throw new Error('the other phone is unknown');
    this.signalingState = 'have-remote-offer';
    this.remoteDescription = { ...description };
    remote.transceivers.forEach((remoteTr, index) => {
      if (!this.transceivers[index]) this.addTransceiver(remoteTr.kind);
      this.transceivers[index].upstream = remoteTr;
      remoteTr.downstream = this.transceivers[index];
    });
    // The browser announces the channel once, with no stream name at all when
    // the other person had not opened the microphone yet.
    for (const tr of this.transceivers) {
      const live = Boolean(tr.upstream?.sender.track);
      this.ontrack?.({ track: tr.receiver, streams: live ? [new FakeStream([tr.receiver])] : [] });
    }
  }

  async addIceCandidate() {}

  close() {
    this.connectionState = 'closed';
    phones.delete(this.id);
  }
}

/**
 * One shared room channel: whatever a phone broadcasts reaches the others.
 * A negotiation is several messages long (join, offer, answer, candidates), so
 * every step is delivered until both inboxes stay empty.
 */
function radio(signals: LiveSignal[][], sides: { receive: (signal: LiveSignal) => void }[]) {
  const deliver = async () => {
    for (let round = 0; round < 12; round += 1) {
      const batch = signals.flatMap(list => list.splice(0, list.length));
      if (!batch.length) return;
      for (const signal of batch) for (const side of sides) side.receive(signal);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  };
  return { deliver };
}

function phone(sideId: string, out: LiveSignal[]) {
  const track: FakeTrack = { kind: 'audio', enabled: true, stop() {} };
  const stream = new FakeStream([track]);
  let asked = 0;
  // Each phone has its own capture device. The test gives the global browser
  // to the phone that is about to open its microphone, the way the real device
  // hands the microphone to the app that asks for it.
  const mount = () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      writable: true,
      value: { mediaDevices: { getUserMedia: async () => { asked += 1; return stream; } } },
    });
  };
  mount();
  const audio = createLiveAudio({
    selfId: sideId,
    onSignal: signal => out.push(signal),
    onRemoteChange: () => undefined,
    onError: message => { throw new Error(message); },
  });
  return { audio, track, asked: () => asked, mount };
}

type Player = { id: string; srcObject: FakeStream | null };

function installBrowser() {
  const elements: Player[] = [];
  const document = {
    body: { appendChild: (element: Player) => { elements.push(element); } },
    createElement: () => {
      const element = {
        id: '',
        style: {} as Record<string, string>,
        srcObject: null as FakeStream | null,
        play: async () => undefined,
        remove: () => {
          const index = elements.indexOf(element);
          if (index >= 0) elements.splice(index, 1);
        },
      };
      return element;
    },
    getElementById: (id: string) => elements.find(element => element.id === id) ?? null,
  };
  Object.assign(globalThis as unknown as Record<string, unknown>, { document, MediaStream: FakeStream, RTCPeerConnection: FakePeer });
  return elements;
}

const playerOf = (elements: Player[], id: string) => elements.find(element => element.id === `sahar-audio-${id}`);

/** A player is audible when it carries a live audio track, the way a browser reports it. */
function audible(stream: FakeStream | null | undefined) {
  const track = stream?.getAudioTracks()[0] as unknown as { muted?: boolean } | undefined;
  return Boolean(track) && track?.muted === false;
}

test('two phones in a room hear each other, in both directions', async () => {
  const elements = installBrowser();
  const signalsA: LiveSignal[] = [];
  const signalsB: LiveSignal[] = [];
  const a = phone('aaa', signalsA);
  const b = phone('bbb', signalsB);
  await a.audio.start();
  await b.audio.start();

  const sides = [{ receive: (signal: LiveSignal) => a.audio.receive(signal) }, { receive: (signal: LiveSignal) => b.audio.receive(signal) }];
  const room = radio([signalsA, signalsB], sides);
  const round = () => room.deliver();
  await round();

  for (const peer of phones.values()) {
    assert.equal(peer.connectionState, 'connected', 'the two phones connected');
  }

  // The second phone speaks: the first must have a player carrying that voice,
  // even though the channel was negotiated while both were silent.
  b.mount();
  assert.equal(await b.audio.enableMic(), true);
  assert.equal(b.track.enabled, true);
  await round();
  assert.ok(a.audio.remotes().includes('bbb'), 'the first phone knows the second is live');
  const playerB = playerOf(elements, 'bbb');
  assert.ok(playerB, 'a player for the second phone exists');
  assert.equal(playerB.srcObject?.getAudioTracks().length, 1, 'the player carries one audio track');
  assert.ok(audible(playerB.srcObject), 'the voice is live, not muted');

  // And the other way round: the phone that made the offer also listens.
  a.mount();
  assert.equal(await a.audio.enableMic(), true);
  await round();
  assert.ok(b.audio.remotes().includes('aaa'), 'the second phone hears the first one');
  const playerA = playerOf(elements, 'aaa');
  assert.ok(playerA, 'a player for the first phone exists');
  assert.ok(audible(playerA.srcObject), 'the voice is live both ways');

  // Muting is heard as silence; turning it back on is immediate and free.
  a.audio.setMicEnabled(false);
  assert.equal(a.track.enabled, false);
  a.audio.setMicEnabled(true);
  assert.equal(a.track.enabled, true);
  assert.equal(a.asked(), 1, 'the microphone was opened only once');

  a.audio.stop();
  b.audio.stop();
  assert.equal(elements.length, 0, 'closing the room removes every player');
});

test('both phones offering at the same time never leaves the room silent', async () => {
  const elements = installBrowser();
  const signalsA: LiveSignal[] = [];
  const signalsB: LiveSignal[] = [];
  const a = phone('aaa', signalsA);
  const b = phone('bbb', signalsB);
  await a.audio.start();
  await b.audio.start();

  const sides = [{ receive: (signal: LiveSignal) => a.audio.receive(signal) }, { receive: (signal: LiveSignal) => b.audio.receive(signal) }];
  // Both joins cross each other: each phone offers before seeing the other.
  const room = radio([signalsA, signalsB], sides);
  await room.deliver();
  for (const peer of phones.values()) {
    assert.equal(peer.connectionState, 'connected', 'a crossed offer is resolved, not dropped');
  }
  assert.ok(playerOf(elements, 'bbb'), 'the room still has sound after the crossed offers');

  a.audio.stop();
  b.audio.stop();
});

test('a phone that lost its network is asked back and the room sounds again', async () => {
  installBrowser();
  const signalsA: LiveSignal[] = [];
  const signalsB: LiveSignal[] = [];
  const a = phone('aaa', signalsA);
  const b = phone('bbb', signalsB);
  await a.audio.start();
  await b.audio.start();
  const sides = [{ receive: (signal: LiveSignal) => a.audio.receive(signal) }, { receive: (signal: LiveSignal) => b.audio.receive(signal) }];
  const room = radio([signalsA, signalsB], sides);
  const round = () => room.deliver();
  await round();

  // Both connections drop at once, as they do when a phone changes network.
  for (const peer of [...phones.values()]) {
    peer.close();
    peer.onconnectionstatechange?.();
  }
  await round();
  await new Promise(resolve => setTimeout(resolve, 1400));
  await round();
  await new Promise(resolve => setTimeout(resolve, 1400));
  await round();

  assert.ok([...phones.values()].every(peer => peer.connectionState === 'connected'), 'the calls were rebuilt');
  a.audio.stop();
  b.audio.stop();
});
