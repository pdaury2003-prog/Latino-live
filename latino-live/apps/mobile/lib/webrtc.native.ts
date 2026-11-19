import type * as Webrtc from 'react-native-webrtc';

export type WebrtcModule = typeof Webrtc;

let cached: WebrtcModule | null | undefined;

/**
 * The voice and camera module, loaded only when a room needs it. An installed
 * build that does not ship it must still open the rest of the app, so a
 * missing module disables live rooms instead of crashing at launch.
 */
export function webrtc(): WebrtcModule | null {
  if (cached !== undefined) return cached;
  try {
    cached = require('react-native-webrtc') as WebrtcModule;
  } catch {
    cached = null;
  }
  return cached;
}
