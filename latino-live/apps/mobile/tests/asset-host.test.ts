import assert from 'node:assert/strict';
import test from 'node:test';
import { withAssetHost } from '../lib/asset-url.ts';

const STORAGE = 'https://abc.supabase.co/storage/v1/object/public/room-photos/sala/foto.webp';

test('without a CDN the photo keeps its own address', () => {
  assert.equal(withAssetHost(STORAGE, ''), STORAGE);
  assert.equal(withAssetHost('', 'https://cdn.latino.live'), '');
});

test('with a CDN the photo keeps its path and changes house', () => {
  assert.equal(
    withAssetHost(STORAGE, 'https://cdn.latino.live'),
    'https://cdn.latino.live/storage/v1/object/public/room-photos/sala/foto.webp',
  );
});

test('a host typed without a scheme still works, and keeps its query', () => {
  assert.equal(
    withAssetHost('https://abc.supabase.co/a/foto.jpg?v=2', 'cdn.latino.live'),
    'https://cdn.latino.live/a/foto.jpg?v=2',
  );
});

test('a file on the phone is never rewritten', () => {
  assert.equal(withAssetHost('file:///data/user/foto.jpg', 'https://cdn.latino.live'), 'file:///data/user/foto.jpg');
  assert.equal(withAssetHost('content://media/1', 'https://cdn.latino.live'), 'content://media/1');
});
