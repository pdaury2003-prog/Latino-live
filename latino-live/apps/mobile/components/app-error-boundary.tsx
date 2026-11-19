import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { config } from '@/lib/config';

type Props = { children: ReactNode };
type State = { message: string | null };

/**
 * A failure while drawing a screen shows a readable message instead of a
 * black window, so the person can retry or tell what happened.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { message: null };

  static getDerivedStateFromError(error: unknown): State {
    return { message: error instanceof Error ? error.message : 'Error inesperado' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (__DEV__) console.warn('APP_CRASH', error.message, info.componentStack);
  }

  render() {
    if (!this.state.message) return this.props.children;
    // Plain colours, not theme classes: this screen must stay readable even
    // when the failure is the styling itself.
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0908', paddingHorizontal: 24, justifyContent: 'center' }}>
        <ScrollView contentContainerStyle={{ alignItems: 'center', gap: 12, paddingVertical: 32 }} showsVerticalScrollIndicator={false}>
          <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,194,75,0.16)' }}>
            <Text style={{ color: '#FFC24B', fontSize: 20, fontWeight: '600' }}>!</Text>
          </View>
          <Text style={{ color: '#F6F0E4', textAlign: 'center', fontSize: 17, fontWeight: '600' }}>Latino Live no pudo abrir esta pantalla</Text>
          <Text style={{ color: '#B3A897', textAlign: 'center', fontSize: 13, lineHeight: 20 }}>
            Cierra la app y vuelve a abrirla. Si sigue igual, instala la versión más reciente desde el mismo enlace.
          </Text>
          <Text style={{ color: '#8A8073', textAlign: 'center', fontSize: 11, lineHeight: 18 }}>{this.state.message}</Text>
          <Text style={{ color: '#8A8073', textAlign: 'center', fontSize: 11 }}>Versión {config.versionCode || 1}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reintentar"
            onPress={() => this.setState({ message: null })}
            style={{ marginTop: 8, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 24, backgroundColor: '#FFC24B' }}>
            <Text style={{ color: '#1A1409', fontSize: 14, fontWeight: '600' }}>Reintentar</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }
}
