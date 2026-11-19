import assert from 'node:assert/strict';
import test from 'node:test';
import { markLive, playingFromReport, seekSecondsAt, type YoutubeVideo } from '../lib/youtube-live.ts';

const video = (duration: string, extra: Partial<YoutubeVideo> = {}): YoutubeVideo => ({
  id: 'abcdefghijk',
  title: 'Un video',
  channel: 'Un canal',
  duration,
  thumbnail: '',
  ...extra,
});

test('a stream is recognised by the duration the server sends', () => {
  const list = markLive([video('EN VIVO'), video('3:56:39'), video('EN VIVO')]);
  assert.deepEqual(list.map(item => item.isLive), [true, false, true]);
});

test('a reply that already carries the flag keeps it', () => {
  const list = markLive([video('', { isLive: true }), video('1:20', { isLive: false })]);
  assert.deepEqual(list.map(item => item.isLive), [true, false]);
});

test('a live search never comes back empty when the server sent streams', () => {
  // This is the bug the room showed: the filter read a flag the server had
  // stopped sending, so every live search looked like "no videos".
  const live = markLive([video('EN VIVO'), video('2:10')]).filter(item => item.isLive);
  assert.equal(live.length, 1);
});

test('buffering keeps the pause button where the person left it', () => {
  // Playing, then the phone buffers: not a pause.
  assert.equal(playingFromReport(false, 3), true);
  assert.equal(playingFromReport(true, 1), true);
  // A real pause, the end of the video and a video that never started.
  assert.equal(playingFromReport(true, 2), false);
  assert.equal(playingFromReport(true, 0), false);
  assert.equal(playingFromReport(true, -1), false);
  // A cued video is one the room is about to play.
  assert.equal(playingFromReport(false, 5), true);
  // An older page sends only the boolean.
  assert.equal(playingFromReport(true, undefined), true);
  assert.equal(playingFromReport(false, undefined), false);
});

test('the progress bar reaches both ends of the video', () => {
  // El dedo en el extremo izquierdo empieza el video y en el derecho lo lleva
  // al final; el tirador no se queda corto en ninguno de los dos lados.
  assert.equal(seekSecondsAt(0, 300, 240), 0);
  assert.equal(seekSecondsAt(300, 300, 240), 240);
  assert.equal(seekSecondsAt(150, 300, 240), 120);
  // Un video sin duración (una transmisión en vivo) no salta a ningún lado.
  assert.equal(seekSecondsAt(150, 300, 0), 0);
  // Antes de medirse la barra no hay dónde tocar.
  assert.equal(seekSecondsAt(10, 0, 240), 0);
});
