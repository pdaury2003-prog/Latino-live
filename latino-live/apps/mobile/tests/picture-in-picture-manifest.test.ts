import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

type XmlNode = { $: Record<string, string> };
type ActivityNode = XmlNode & { 'intent-filter'?: { action?: XmlNode[] }[] };
type ManifestNode = {
  manifest: {
    application?: { activity?: ActivityNode[] }[];
    'uses-feature'?: XmlNode[];
  };
};

type Mod = (input: Record<string, unknown>) => Promise<{ modResults: ManifestNode }>;

const withPictureInPicture = require('../plugins/with-picture-in-picture.js') as (
  config: Record<string, unknown>,
) => { mods: { android: { manifest: Mod } } };

/** The manifest Expo writes before the plugin touches it. */
function freshManifest(): ManifestNode {
  return {
    manifest: {
      application: [
        {
          activity: [
            {
              $: {
                'android:name': '.MainActivity',
                'android:configChanges':
                  'keyboard|keyboardHidden|orientation|screenSize|screenLayout|uiMode',
              },
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

function run(manifest: ManifestNode): Promise<ManifestNode> {
  const config = withPictureInPicture({ name: 'Latino Live', slug: 'sahar' });
  return config.mods.android.manifest({
    ...config,
    modRequest: { projectRoot: '.', platformProjectRoot: '/tmp' },
    modResults: manifest,
  }).then(result => result.modResults);
}

function mainActivity(manifest: ManifestNode): ActivityNode {
  const activity = manifest.manifest.application?.[0]?.activity?.[0];
  assert.ok(activity, 'the manifest has a main activity');
  return activity;
}

test('the main activity declares the floating window', async () => {
  const activity = mainActivity(await run(freshManifest()));
  assert.equal(activity.$['android:supportsPictureInPicture'], 'true');
  assert.equal(activity.$['android:resizeableActivity'], 'true');
});

test('the activity handles its own resize instead of reloading the room', async () => {
  const activity = mainActivity(await run(freshManifest()));
  const changes = new Set((activity.$['android:configChanges'] ?? '').split('|'));
  // Resizing to the small window and turning the phone never recreates it.
  for (const value of ['orientation', 'screenSize', 'smallestScreenSize', 'screenLayout']) {
    assert.ok(changes.has(value), `the activity handles ${value}`);
  }
  // What Expo already declared is kept, not replaced.
  for (const value of ['keyboard', 'keyboardHidden', 'uiMode']) {
    assert.ok(changes.has(value), `the activity still handles ${value}`);
  }
});

test('a phone without the floating window can still install the app', async () => {
  const manifest = await run(freshManifest());
  const feature = (manifest.manifest['uses-feature'] ?? []).find(
    item => item.$['android:name'] === 'android.software.picture_in_picture',
  );
  assert.ok(feature, 'the picture-in-picture feature is declared');
  assert.equal(feature.$['android:required'], 'false');
});

test('running twice never duplicates the feature', async () => {
  const once = await run(freshManifest());
  const twice = await run(once);
  const features = (twice.manifest['uses-feature'] ?? []).filter(
    item => item.$['android:name'] === 'android.software.picture_in_picture',
  );
  assert.equal(features.length, 1);
});
