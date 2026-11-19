import assert from 'node:assert/strict';
import test from 'node:test';
import { imageType, pickPhotoFromLibrary } from '../lib/pick-photo.ts';

type Options = { allowsEditing?: boolean };

/**
 * The installed app asks the system picker for one photo. It must never ask
 * for a library permission first: current Android grants the chosen photo
 * itself, and older versions deny the blocked permission, which left the
 * gallery button doing nothing at all.
 */
test('the gallery opens without asking for a media library permission', async () => {
  let asked = 0;
  const picker = {
    requestMediaLibraryPermissionsAsync: async () => {
      asked += 1;
      return { granted: true };
    },
    launchImageLibraryAsync: async () => ({
      canceled: false,
      assets: [{ uri: 'file:///foto.jpg', mimeType: 'image/jpeg', fileName: 'foto.jpg' }],
    }),
  };

  const picked = await pickPhotoFromLibrary({ aspect: [1, 1] }, picker as never);

  assert.deepEqual(picked, {
    status: 'picked',
    photo: { uri: 'file:///foto.jpg', mimeType: 'image/jpeg', fileName: 'foto.jpg' },
  });
  assert.equal(asked, 0, 'no permission prompt before the system picker');
});

test('a phone without the crop screen still attaches its photo', async () => {
  const calls: boolean[] = [];
  const picker = {
    launchImageLibraryAsync: async (options: Options) => {
      calls.push(Boolean(options.allowsEditing));
      if (options.allowsEditing) throw new Error('No activity found to handle Intent');
      return { canceled: false, assets: [{ uri: 'file:///foto.jpg', mimeType: 'image/jpeg' }] };
    },
  };

  const picked = await pickPhotoFromLibrary({ aspect: [4, 3] }, picker as never);

  assert.equal(picked.status, 'picked');
  assert.deepEqual(calls, [true, false], 'the plain picker is tried once more');
});

test('closing the gallery changes nothing', async () => {
  let calls = 0;
  const picker = {
    launchImageLibraryAsync: async () => {
      calls += 1;
      return { canceled: true, assets: null };
    },
  };

  const picked = await pickPhotoFromLibrary({}, picker as never);

  assert.equal(picked.status, 'canceled');
  assert.equal(calls, 1);
});

test('the upload keeps the real picture type', () => {
  assert.deepEqual(imageType({ mimeType: 'image/png' }), { contentType: 'image/png', extension: 'png' });
  assert.deepEqual(imageType({ fileName: 'IMG_0042.PNG' }), { contentType: 'image/png', extension: 'png' });
  assert.deepEqual(imageType({ uri: 'file:///cache/foto.webp' }), { contentType: 'image/webp', extension: 'webp' });
  assert.deepEqual(imageType({}), { contentType: 'image/jpeg', extension: 'jpg' });
});

