import assert from 'node:assert/strict';
import test from 'node:test';
import { createLiveAudio } from '../lib/live-audio.ts';

/**
 * Turning the microphone off and on again must wake the same track. The first
 * version kept the track disabled, so the room went silent for good after one
 * mute.
 */
test('muting and unmuting the microphone restores the same track', async () => {
  let asked = 0;
  const track = { kind: 'audio', enabled: true, stop() {} };
  const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
  // Node exposes `navigator` as a getter, so the stub replaces the property.
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

  const audio = createLiveAudio({
    selfId: 'me',
    onSignal: () => undefined,
    onRemoteChange: () => undefined,
    onError: message => { throw new Error(message); },
  });
  await audio.start();

  assert.equal(await audio.enableMic(), true);
  audio.setMicEnabled(false);
  assert.equal(track.enabled, false);

  assert.equal(await audio.enableMic(), true);
  assert.equal(track.enabled, true, 'the microphone is live again');
  assert.equal(asked, 1, 'the permission prompt is not asked again');

  audio.stop();
  delete (globalThis as unknown as { navigator?: unknown }).navigator;
});
