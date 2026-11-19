import '@/lib/quiet-web';
import '../global.css';
import { useEffect, useRef, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PortalHost } from '@rn-primitives/portal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Geist_400Regular } from '@expo-google-fonts/geist/400Regular';
import { Geist_500Medium } from '@expo-google-fonts/geist/500Medium';
import { Geist_600SemiBold } from '@expo-google-fonts/geist/600SemiBold';
import { Geist_700Bold } from '@expo-google-fonts/geist/700Bold';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useCSSVariable } from 'uniwind';
import { Platform, View } from 'react-native';
import { useDesignTheme } from '@/features/design-theme';
import { applyWindowBackground } from '@/lib/window-background';
import { DesignThemeProvider } from '@/features/design-theme';
import { BootScreen } from '@/components/boot-screen';
import { markStep } from '@/lib/boot-trace';
import { AuthProvider } from '@/features/auth';
import { AppUpdateGate } from '@/features/app-update';
import { PreviewProvider } from '@/features/preview';
import { AccountGateScreen } from '@/features/account-gate-screen';
import { AccountSuspensionGate } from '@/features/account-suspension';
import { RoomSessionProvider } from '@/features/room-session';
import { DirectAlertsProvider } from '@/features/direct-alerts';
import { PushBridge } from '@/features/push-bridge';
import { prefetchRelay } from '@/lib/ice';
import { readRelay } from '@/lib/relay';
import { getSupabase } from '@/lib/supabase';
import { config, resolveRuntimeConfig } from '@/lib/config';
import { hydratePower } from '@/lib/power';
import { hydrateProfiles } from '@/lib/profile-cache';
import { warmGiftMediaWhenIdle } from '@/lib/media-warmup';

/**
 * One client for the whole app. These defaults keep a screen from refetching
 * what it just showed, so moving between tabs is instant and the phone does
 * less work in the background.
 */
const query = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * The whole product. It loads after the phone has already drawn the brand
 * screen, so a module that cannot start leaves a readable message instead of
 * an empty black window.
 */
export function AppRoot({ onReady }: { onReady?: () => void }) {
  const [fontsLoaded, fontError] = useFonts({ Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold });
  const [waited, setWaited] = useState(false);
  /**
   * A build made by the app's owner carries no server variables, so the phone
   * reads the project's public runtime config before the first screen. The
   * wait has a ceiling: a phone without a connection still opens the app and
   * says honestly that it cannot reach the rooms.
   */
  const [serverReady, setServerReady] = useState(Boolean(config.backend && config.anonKey));
  const background = useCSSVariable('--color-background');
  const { colorScheme } = useDesignTheme();
  const windowColor = colorScheme === 'light' ? '#F1EFEA' : '#080607';

  // The area behind the screens (and the phone's own window) stays in the
  // theme's colour, so scrolling or opening a screen never shows white.
  useEffect(() => {
    applyWindowBackground(windowColor);
  }, [windowColor]);

  // A font that never arrives must not hold the app on the brand screen.
  useEffect(() => {
    // The fonts ship inside the app, so this ceiling is only for a phone that
    // cannot read them: two and a half seconds is enough to tell.
    const timer = setTimeout(() => setWaited(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (serverReady) return;
    let live = true;
    const ceiling = setTimeout(() => { if (live) setServerReady(true); }, 4_000);
    void resolveRuntimeConfig().finally(() => {
      if (!live) return;
      clearTimeout(ceiling);
      setServerReady(true);
    });
    return () => { live = false; clearTimeout(ceiling); };
    // The address is read once per launch: a build either has it or asks for it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The voice relay is looked up while the person is still choosing a room, so
  // the first call already carries it. The public relays work either way.
  useEffect(() => {
    // Nothing on the welcome screen needs the relay. Waiting until the first
    // screens are drawn keeps the lookup from competing with the launch.
    // The relay is only needed once a room is entered; looking it up later
    // keeps it from competing with the first screens.
    const timer = setTimeout(() => {
      const client = getSupabase();
      if (!client) return;
      prefetchRelay(async () => {
        const reply = await readRelay();
        return reply?.iceServers ?? null;
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  // The saving modes live on the phone; reading them early means the first
  // frame already respects them instead of animating and then stopping.
  useEffect(() => {
    void hydratePower();
  }, []);

  /**
   * Las fichas guardadas se leen al arrancar, sin esperar a la red: cuando la
   * persona abre un perfil ya está en memoria y aparece en el mismo cuadro.
   * Después de la primera pantalla, los medios de los regalos se guardan en el
   * teléfono para que salgan al instante dentro de una sala.
   */
  useEffect(() => {
    void hydrateProfiles();
    warmGiftMediaWhenIdle();
  }, []);
  const ready = (fontsLoaded || Boolean(fontError) || waited) && serverReady;
  useEffect(() => {
    if (ready) markStep('fonts-ready');
  }, [ready]);
  useEffect(() => {
    if (background) markStep('theme-ready');
  }, [background]);
  // The brand only leaves once the first real screen exists.
  const announced = useRef(false);
  // The welcome screen needs no theme, so fonts are enough to show it.
  const canShowScreen = ready;
  useEffect(() => {
    if (!canShowScreen || announced.current) return;
    announced.current = true;
    markStep('welcome-ready');
    // The screens are already laid out: the brand leaves on the next frame.
    const timer = setTimeout(() => onReady?.(), 40);
    // The timer is not cancelled here: the screen is ready, and dropping the
    // callback would leave the brand covering the app forever.
    void timer;
  }, [canShowScreen, onReady]);
  // Never an empty frame: the brand stays until the screens can draw.
  if (!ready) return <BootScreen note="Preparando tu sala…" />;
  // The welcome screen is drawn without style classes, so a phone where the
  // styling layer cannot start still has a readable app to use.
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: windowColor }}>
      <QueryClientProvider client={query}>
        <DesignThemeProvider>
          <PreviewProvider>
            <AuthProvider>
              <AccountSuspensionGate>
                <AppUpdateGate>
                  <PushBridge />
                  <AccountGateScreen>
                    <DirectAlertsProvider>
                      <RoomSessionProvider>
                        <Stack
                          screenOptions={{
                            headerShown: false,
                            contentStyle: { backgroundColor: windowColor },
                          }}
                        />
                      </RoomSessionProvider>
                    </DirectAlertsProvider>
                  </AccountGateScreen>
                  <StatusBar style="auto" />
                  <PortalHost />
                </AppUpdateGate>
              </AccountSuspensionGate>
            </AuthProvider>
          </PreviewProvider>
        </DesignThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
