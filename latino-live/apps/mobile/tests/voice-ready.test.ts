import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveAudio } from '../lib/live-audio.ts';
import { ICE_FALLBACK, checkRelay, loadIceServers, resetRelayCache } from '../lib/ice.ts';

function stubMicrophone() {
  let asked = 0;
  const track = { kind: 'audio', enabled: true, stop() {} };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    writable: true,
    value: {
      mediaDevices: {
        getUserMedia: async () => {
          asked += 1;
          return stream;
        },
      },
    },
  });
  return { track, asked: () => asked };
}

test('a prepared microphone is silent until the button turns it on', async () => {
  const { track, asked } = stubMicrophone();
  const audio = createLiveAudio({
    selfId: 'me',
    onSignal: () => undefined,
    onRemoteChange: () => undefined,
    onError: message => { throw new Error(message); },
  });
  await audio.start();

  assert.equal(await audio.prepareMic?.(), true);
  assert.equal(track.enabled, false, 'nothing is sent while the person is quiet');
  assert.equal(asked(), 1);

  // The press only flips the flag: no second capture, no waiting.
  assert.equal(await audio.enableMic(), true);
  assert.equal(track.enabled, true);
  assert.equal(asked(), 1);

  audio.stop();
  delete (globalThis as unknown as { navigator?: unknown }).navigator;
});

test('two quick taps share one capture of the microphone', async () => {
  const { asked } = stubMicrophone();
  const audio = createLiveAudio({
    selfId: 'me',
    onSignal: () => undefined,
    onRemoteChange: () => undefined,
    onError: message => { throw new Error(message); },
  });
  await audio.start();

  await Promise.all([audio.prepareMic?.(), audio.prepareMic?.(), audio.enableMic()]);
  assert.equal(asked(), 1);

  audio.stop();
  delete (globalThis as unknown as { navigator?: unknown }).navigator;
});

test('a call never waits long for the relay server to answer', async () => {
  const started = Date.now();
  const pool = await loadIceServers(() => new Promise(() => undefined));
  assert.ok(Date.now() - started < 2000, 'the servers come back within a second of asking');
  assert.ok(pool.servers.some(server => String(server.urls).startsWith('stun:')), 'direct paths are always offered');
  assert.equal(pool.dedicated, false, 'no project relay has answered yet');
});

test('a call carries no dead public relay', () => {
  // The free relay this app used to list resolves to 192.0.2.1 and 100::1,
  // reserved discard addresses: every allocation there failed after the call
  // had already waited on it. Without project credentials the call goes
  // direct, which is honest, instead of pretending a relay exists.
  assert.equal(ICE_FALLBACK.some(server => /metered\.ca|openrelay/i.test(String(server.urls))), false);
  assert.equal(ICE_FALLBACK.every(server => String(server.urls).startsWith('stun:')), true);
});

test('the first call waits for a relay that is already on its way', async () => {
  resetRelayCache();
  const pool = await loadIceServers(async () => {
    await new Promise(resolve => setTimeout(resolve, 120));
    return [{ urls: 'turns:relay.example.test:443?transport=tcp', username: 'u', credential: 'c' }];
  });
  assert.equal(pool.dedicated, true, 'the relay reached the very first call');
  assert.ok(pool.servers.some(server => String(server.urls).startsWith('turns:')), 'the TLS relay is in the list');
  assert.ok(pool.servers.some(server => String(server.urls).startsWith('stun:')), 'direct paths stay first for speed');
});

test('the connection check says plainly whether a relay exists', async () => {
  resetRelayCache();
  assert.equal((await checkRelay(async () => ({ state: 'missing', iceServers: [] }))).state, 'missing', 'no relay means no relay');
  assert.equal(
    (await checkRelay(async () => ({ state: 'auth', detail: 'Cloudflare rechazó el API token', iceServers: [] }))).state,
    'auth',
    'a refused token is not reported as a missing key',
  );
  // The case this project actually hit: the Token ID belongs to no TURN key.
  const unknown = await checkRelay(async () => ({
    state: 'unknown-key',
    detail: 'el Token ID no existe en esa cuenta de Cloudflare',
    iceServers: [],
  }));
  assert.equal(unknown.state, 'unknown-key');
  assert.match(unknown.detail ?? '', /Token ID/);
  assert.equal(
    (await checkRelay(async () => ({ state: 'active', iceServers: [{ urls: 'turn:relay.example.test:3478', username: 'u', credential: 'c' }] }))).state,
    'active',
    'a relay the project hands out is reported as active',
  );
});
