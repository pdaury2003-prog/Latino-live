import { Platform } from 'react-native';
import type * as Picker from 'expo-image-picker';

/**
 * The entry video: a short clip of the person that plays when they walk into a
 * room. It is picked from the phone's gallery and lasts fifteen days.
 */
export type PickedVideo = { uri: string; mimeType?: string | null; fileName?: string | null; duration?: number | null };

export type VideoOutcome =
  | { status: 'picked'; video: PickedVideo; tooLong: boolean }
  | { status: 'canceled' }
  | { status: 'unavailable' }
  | { status: 'failed' };

/** Fifteen seconds is enough for an entrance and small enough for a room. */
export const MAX_ENTRY_VIDEO_SECONDS = 15;

type PickerModule = typeof Picker;
let cached: PickerModule | null | undefined;

function imagePicker(): PickerModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('expo-image-picker') as PickerModule;
  } catch {
    cached = null;
  }
  return cached;
}

/** Opens the gallery for one video. Never asks for the whole library. */
export async function pickVideoFromLibrary(picker?: PickerModule | null): Promise<VideoOutcome> {
  const Picker = picker === undefined ? imagePicker() : picker;
  if (!Picker) return { status: 'unavailable' };
  try {
    const result = await Picker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      // The picker trims to this window, so a long clip still fits the entrance.
      videoMaxDuration: MAX_ENTRY_VIDEO_SECONDS,
      quality: 0.7,
      allowsEditing: Platform.OS === 'android',
    });
    const asset = result.canceled ? null : result.assets?.[0];
    if (!asset?.uri) return { status: 'canceled' };
    const seconds = typeof asset.duration === 'number' ? asset.duration / 1000 : null;
    return {
      status: 'picked',
      video: { uri: asset.uri, mimeType: asset.mimeType, fileName: asset.fileName, duration: seconds },
      tooLong: seconds !== null && seconds > MAX_ENTRY_VIDEO_SECONDS + 1,
    };
  } catch {
    return { status: 'failed' };
  }
}

/** The file type the phone hands back, as the storage bucket needs it. */
export function videoType(video: { mimeType?: string | null; fileName?: string | null; uri?: string | null }): { contentType: string; extension: string } {
  const hint = `${video.mimeType ?? ''} ${video.fileName ?? ''} ${video.uri ?? ''}`.toLowerCase();
  if (hint.includes('quicktime') || hint.includes('.mov')) return { contentType: 'video/quicktime', extension: 'mov' };
  if (hint.includes('webm')) return { contentType: 'video/webm', extension: 'webm' };
  return { contentType: 'video/mp4', extension: 'mp4' };
}
