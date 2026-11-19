import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { BootScreen } from '@/components/boot-screen';
import { markFailure, markStep, reachedSteps, readTrace, stepLabel } from '@/lib/boot-trace';

type ErrorUtilsLike = {
  getGlobalHandler: () => (error: Error, isFatal: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal: boolean) => void) => void;
};

// A fatal JavaScript error normally leaves the phone on an empty window. This
// records it so the next launch can name it instead of showing black again.
const globalErrors = (global as unknown as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
if (globalErrors) {
  const previous = globalErrors.getGlobalHandler();
  globalErrors.setGlobalHandler((error, isFatal) => {
    if (isFatal) markFailure('fatal', error);
    previous(error, isFatal);
  });
}

markStep('brand');

/**
 * The app opens in two steps: this file draws the brand with React Native
 * alone, then loads the rest of Latino Live. If any part of the product cannot start
 * on this phone, the person sees a readable message instead of a black window.
 */
export default function Layout() {
  const [Root, setRoot] = useState<ComponentType<{ onReady?: () => void }> | null>(null);
  const [painted, setPainted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [stalled, setStalled] = useState<string | null>(null);
  const previousError = useRef<string | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showBrand = useCallback(() => {
    if (hideTimer.current) return;
    hideTimer.current = setTimeout(() => setPainted(true), 200);
  }, []);

  const start = useCallback(() => {
    setFailure(null);
    try {
      const module = require('../features/app-root') as typeof import('../features/app-root');
      setRoot(() => module.AppRoot);
      markStep('root-loaded');
    } catch (error) {
      setRoot(null);
      markFailure('root-loaded', error);
      setFailure(error instanceof Error ? error.message : 'No pudimos iniciar Latino Live.');
    }
  }, []);

  // A previous launch that never finished is reported on the next one.
  useEffect(() => {
    let live = true;
    void readTrace().then(trace => {
      // Only a recorded failure is worth showing; a normal launch always
      // leaves an unfinished step behind until it has drawn its screen.
      if (live && trace?.error) previousError.current = trace.error;
    });
    return () => { live = false; };
  }, []);

  useEffect(() => {
    // The phone's own launch screen must never hold the app: without keeping
    // it on screen it goes away as soon as this first frame is drawn. Keeping
    // it would leave a dark window on phones where it never gets dismissed.
    try {
      const splash = require('expo-splash-screen') as typeof import('expo-splash-screen');
      void splash.hideAsync().catch(() => undefined);
    } catch {
      // Nothing to hide when the module is not part of this build.
    }
    // The brand is drawn first so an open app never looks like a black window;
    // one frame is enough for that, and every extra moment is a slower launch.
    const ready = setTimeout(start, 40);
    return () => {
      clearTimeout(ready);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [start]);

  useEffect(() => {
    if (!Root) return;
    try {
      const splash = require('expo-splash-screen') as typeof import('expo-splash-screen');
      void splash.hideAsync().catch(() => undefined);
    } catch {
      // Nothing to hide when the module is not part of this build.
    }
  }, [Root]);

  // The product has drawn its first screen: the next launch is not interrupted.
  useEffect(() => {
    if (painted) markStep('ready');
  }, [painted]);

  // If the product never draws, say where it stopped instead of staying black.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (painted) return;
      const steps = reachedSteps().map(stepLabel);
      setStalled(steps.length ? steps.join(' → ') : 'inicio');
    }, 6000);
    return () => clearTimeout(timer);
  }, [painted]);

  if (failure) return <StartupFailure message={failure} onRetry={start} />;
  if (stalled && !painted) {
    return (
      <StartupFailure
        message={`La app se detuvo en: ${stalled}.` + (previousError.current ? `\n\n${previousError.current}` : '')}
        onRetry={() => { setStalled(null); markStep('brand'); start(); }}
      />
    );
  }
  if (!Root) return <BootScreen note="v1" />;
  // The brand is an overlay on top of the product, so it only leaves once the
  // first real screen has laid out: there is no empty frame in between.
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        <AppErrorBoundary><Root onReady={showBrand} /></AppErrorBoundary>
      </View>
      {painted ? null : (
        <View style={StyleSheet.absoluteFill}>
          <BootScreen note="v1" />
        </View>
      )}
    </View>
  );
}

function StartupFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0908', paddingHorizontal: 24, justifyContent: 'center' }}>
      <ScrollView contentContainerStyle={{ alignItems: 'center', gap: 12, paddingVertical: 32 }} showsVerticalScrollIndicator={false}>
        <Text style={{ fontSize: 20, letterSpacing: 3, color: '#F5EFE6', fontWeight: '700' }}>LATINO LIVE</Text>
        <Text style={{ color: '#F6F0E4', textAlign: 'center', fontSize: 16, fontWeight: '600', marginTop: 8 }}>
          Latino Live no pudo abrir en este teléfono
        </Text>
        <Text style={{ color: '#B3A897', textAlign: 'center', fontSize: 13, lineHeight: 20 }}>
          Cierra la app y vuelve a abrirla. Si sigue igual, envía este texto al creador de la app.
        </Text>
        <Text style={{ color: '#8A8073', textAlign: 'center', fontSize: 11, lineHeight: 17 }}>{message}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          onPress={onRetry}
          style={{ marginTop: 8, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 999, paddingHorizontal: 24, backgroundColor: '#FFC24B' }}>
          <Text style={{ color: '#1A1409', fontSize: 14, fontWeight: '600' }}>Reintentar</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
