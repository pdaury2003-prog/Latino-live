import type * as Documents from 'expo-document-picker';

export type PickedAudio = { uri: string; fileName?: string | null; mimeType?: string | null; size?: number | null };

export type AudioPick =
  | { status: 'picked'; audio: PickedAudio }
  | { status: 'canceled' }
  | { status: 'unavailable' };

let cached: typeof Documents | null | undefined;

function documents(): typeof Documents | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('expo-document-picker') as typeof Documents;
  } catch {
    cached = null;
  }
  return cached;
}

/** The phone's file browser, limited to the music it can play. */
export async function pickAudioFromDevice(picker?: typeof Documents | null): Promise<AudioPick> {
  const Documents = picker === undefined ? documents() : picker;
  if (!Documents) return { status: 'unavailable' };
  try {
    const result = await Documents.getDocumentAsync({
      type: ['audio/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled) return { status: 'canceled' };
    const asset = result.assets?.[0];
    if (!asset?.uri) return { status: 'canceled' };
    return {
      status: 'picked',
      audio: { uri: asset.uri, fileName: asset.name ?? null, mimeType: asset.mimeType ?? null, size: asset.size ?? null },
    };
  } catch {
    return { status: 'canceled' };
  }
}
