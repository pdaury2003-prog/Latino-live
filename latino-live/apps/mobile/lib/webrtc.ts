import type * as Webrtc from 'react-native-webrtc';

export type WebrtcModule = typeof Webrtc;

/** The browser version never needs the Android module. */
export function webrtc(): WebrtcModule | null {
  return null;
}
