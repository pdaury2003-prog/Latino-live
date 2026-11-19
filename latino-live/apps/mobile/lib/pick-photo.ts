import type * as Picker from 'expo-image-picker';

export type PickedPhoto = { uri: string; mimeType?: string | null; fileName?: string | null };

export type PickOutcome =
  | { status: 'picked'; photo: PickedPhoto }
  | { status: 'canceled' }
  | { status: 'unavailable' }
  | { status: 'failed' };

/**
 * The real type of the chosen picture. A gallery can hand back a photo with no
 * MIME type at all, and saving a PNG as JPEG (or with no extension) leaves a
 * file the room cannot show.
 */
export function imageType(photo: { mimeType?: string | null; fileName?: string | null; uri?: string | null }): { contentType: string; extension: string } {
  const hint = `${photo.mimeType ?? ''} ${photo.fileName ?? ''} ${photo.uri ?? ''}`.toLowerCase();
  if (hint.includes('png')) return { contentType: 'image/png', extension: 'png' };
  if (hint.includes('webp')) return { contentType: 'image/webp', extension: 'webp' };
  return { contentType: 'image/jpeg', extension: 'jpg' };
}

type PickOptions = {
  aspect?: [number, number];
  quality?: number;
  /** Cropping the photo before uploading it. */
  editing?: boolean;
};

type PickerModule = typeof Picker;

let cached: PickerModule | null | undefined;

/**
 * The gallery module, loaded the first time a photo is chosen: an installed
 * build that does not carry it keeps the rest of the app working.
 */
function imagePicker(): PickerModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('expo-image-picker') as PickerModule;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * Opens the phone gallery for one photo.
 *
 * The installed app must not ask for a media library permission first: current
 * Android opens the system photo picker and hands back just the chosen photo,
 * and on older versions the app manifest leaves that permission out, so asking
 * for it there answered "no" and the gallery never opened. Cropping is optional
 * too: a phone without the crop screen still sends its photo.
 */
export async function pickPhotoFromLibrary(options: PickOptions = {}, picker?: PickerModule | null): Promise<PickOutcome> {
  const Picker = picker === undefined ? imagePicker() : picker;
  if (!Picker) return { status: 'unavailable' };

  const launch = async (crop: boolean) => Picker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: crop,
    ...(crop && options.aspect ? { aspect: options.aspect } : {}),
    quality: options.quality ?? 0.8,
  });

  const read = (result: Picker.ImagePickerResult): PickOutcome => {
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.uri) return { status: 'canceled' };
    return { status: 'picked', photo: { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName } };
  };

  try {
    return read(await launch(options.editing !== false));
  } catch {
    // The crop screen is the only part that can be missing on a phone; the
    // photo itself still opens in the plain system picker.
    if (options.editing === false) return { status: 'failed' };
    try {
      return read(await launch(false));
    } catch {
      return { status: 'failed' };
    }
  }
}
