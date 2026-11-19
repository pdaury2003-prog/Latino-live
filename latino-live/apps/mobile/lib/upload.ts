import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import { getSupabase } from '@/lib/supabase';

type UploadArgs = {
  bucket: 'profile-media' | 'room-photos' | 'room-voice' | 'room-music' | 'moments' | 'direct-photos' | 'entry-videos' | 'agency-media';
  path: string;
  uri: string;
  contentType: string;
  upsert?: boolean;
  /** Shown when the server refuses the file, in the person's words. */
  failure: string;
};

/**
 * Sends a file the person picked on the phone.
 *
 * A phone gallery hands back a `file://` address, and the browser-style
 * `fetch(uri).blob()` path that works on the web cannot read it on Android.
 * A form with a `{ uri }` part does not work either: the request layer of this
 * Expo version only knows real bytes and answers "Unsupported FormDataPart
 * implementation". So the file is read with the phone's own filesystem and the
 * bytes are uploaded, which every version understands and keeps the type.
 */
export async function uploadPickedFile({ bucket, path, uri, contentType, upsert = false, failure }: UploadArgs): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');

  if (Platform.OS === 'web' || /^https?:/i.test(uri) || /^data:/i.test(uri)) {
    let body: Blob;
    try {
      const response = await fetch(uri);
      body = await response.blob();
    } catch {
      throw new Error(failure);
    }
    const { error } = await client.storage.from(bucket).upload(path, body, { contentType, upsert });
    if (error) throw new Error(`${failure} (${error.message})`);
    return;
  }

  const bytes = await readBytes(uri, failure);
  const { error } = await client.storage.from(bucket).upload(path, bytes, { contentType, upsert });
  if (error) throw new Error(`${failure} (${error.message})`);
}

/** The chosen file's bytes: from disk first, then through the network reader. */
async function readBytes(uri: string, failure: string): Promise<ArrayBuffer> {
  try {
    return await new File(uri).arrayBuffer();
  } catch {
    // A provider can hand back an address the filesystem cannot open directly.
  }
  try {
    const response = await fetch(uri);
    return await response.arrayBuffer();
  } catch {
    throw new Error(failure);
  }
}
