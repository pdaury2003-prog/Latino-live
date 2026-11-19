import { View } from 'react-native';
import type { VideoSource } from '@/lib/live-audio.types';
import { webrtc } from '@/lib/webrtc';

type Props = { source: VideoSource; muted?: boolean; className?: string; mirror?: boolean };

/** A live camera picture on Android, drawn from the WebRTC stream address. */
export function LiveVideo({ source, mirror = false }: Props) {
  if (!('url' in source)) return null;
  const RTCView = webrtc()?.RTCView;
  if (!RTCView) {
    return <View style={{ width: '100%', height: '100%', backgroundColor: '#1F1B16' }} />;
  }
  return (
    <RTCView
      streamURL={source.url}
      objectFit="cover"
      mirror={mirror}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
