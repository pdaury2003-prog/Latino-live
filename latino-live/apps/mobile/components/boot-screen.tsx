import { ActivityIndicator, Image, Text, View } from 'react-native';

/**
 * The brand, drawn with React Native alone: fixed colours and the phone's own
 * font, so it appears even when the app's fonts or colour tokens are missing.
 */
export function BootScreen({ note }: { note?: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, backgroundColor: '#141210' }}>
      {/* Plain RN image: the emblem shows even before the styling layer loads. */}
      <Image
        source={require('@/assets/brand-logo-512.webp')}
        resizeMode="contain"
        style={{ width: 120, height: 120 }}
        accessibilityIgnoresInvertColors
      />
      <Text style={{ fontSize: 20, letterSpacing: 3, color: '#F5EFE6', fontWeight: '700' }}>LATINO LIVE</Text>
      <Text style={{ fontSize: 12, letterSpacing: 4, color: '#A79E8F' }}>SALAS DE VOZ</Text>
      <ActivityIndicator color="#FFC24B" />
      {note ? (
        <Text style={{ position: 'absolute', bottom: 28, fontSize: 11, color: '#6B6156', textAlign: 'center', paddingHorizontal: 24 }}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}
