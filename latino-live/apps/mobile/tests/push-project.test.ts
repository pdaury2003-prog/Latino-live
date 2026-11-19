import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type ExpoConfig = {
  extra?: { eas?: { projectId?: string } };
  android?: { package?: string; googleServicesFile?: string };
};

function resolveConfig(): ExpoConfig {
  const factory = require('../app.config.js') as () => ExpoConfig;
  return factory();
}

test('the notification project reaches the built app', () => {
  const projectId = resolveConfig().extra?.eas?.projectId ?? '';
  assert.match(
    projectId,
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'sin un projectId válido el teléfono no puede pedir su dirección de avisos',
  );
});

test('the notification project matches the file the owner filled in', () => {
  const stored = require('../push.config.json') as { easProjectId?: string };
  assert.equal(resolveConfig().extra?.eas?.projectId, stored.easProjectId?.trim());
});

test('the app keeps its own package next to the push setup', () => {
  assert.equal(resolveConfig().android?.package, 'com.latinolivechat.app');
});
