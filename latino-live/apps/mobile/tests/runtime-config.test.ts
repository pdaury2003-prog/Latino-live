import assert from 'node:assert/strict';
import test from 'node:test';
import { parseRuntimeConfig, readServerValues } from '../lib/runtime-config.ts';

// The shape the project's site actually serves to browsers.
const SERVED =
  'globalThis.__SPK_RUNTIME_CONFIG__={"supabaseUrl":"https://example.supabase.co",' +
  '"supabaseAnonKey":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.public","platformOrigin":"https://app.example"}';

test('a build without server variables can read them from the public runtime file', () => {
  const values = readServerValues(parseRuntimeConfig(SERVED));
  assert.ok(values);
  assert.equal(values.url, 'https://example.supabase.co');
  assert.equal(values.key, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.public');
  assert.equal(values.platform, 'https://app.example');
});

test('a file without an address or key never half-configures the app', () => {
  assert.equal(readServerValues(parseRuntimeConfig('globalThis.x={}')), null);
  assert.equal(readServerValues(parseRuntimeConfig('globalThis.x={"supabaseUrl":"https://a.b"}')), null);
  assert.equal(
    readServerValues(parseRuntimeConfig('globalThis.x={"supabaseUrl":"https://a.b","supabaseAnonKey":"   "}')),
    null,
  );
});

test('a broken or empty response leaves the app unconfigured instead of crashing', () => {
  assert.equal(parseRuntimeConfig(''), null);
  assert.equal(parseRuntimeConfig('not javascript at all'), null);
  assert.equal(parseRuntimeConfig('globalThis.x={ not json'), null);
  assert.equal(readServerValues(null), null);
});

test('an address that is not a web address is refused', () => {
  assert.equal(
    readServerValues(parseRuntimeConfig('globalThis.x={"supabaseUrl":"javascript:alert(1)","supabaseAnonKey":"k"}')),
    null,
  );
});
