/**
 * Development-only noise from react-native-web: when two fingers touch at
 * once its responder system loses track of one and logs this error. Touches
 * keep working, so the message is filtered before the error overlay shows it.
 */
const NOISE = 'Cannot find single active touch';

if (__DEV__ && typeof document !== 'undefined') {
  try {
    // The overlay in the browser is Expo's own log box, which keeps its own
    // ignore list; React Native's LogBox on web is only a stub.
    const LogBox = require('@expo/log-box/src/LogBox').default as { ignoreLogs?: (patterns: string[]) => void };
    LogBox.ignoreLogs?.([NOISE]);
  } catch {
    // If the module shape changes, the console filter below still applies.
  }

  const originalError = console.error.bind(console);
  console.error = ((...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].includes(NOISE)) return;
    originalError(...args);
  }) as typeof console.error;
}

export {};
