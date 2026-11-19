import { Platform } from 'react-native';

/**
 * Paints the phone window itself. Without this, the space behind the screens
 * (during a transition, an overscroll or a keyboard resize) is plain white on
 * many Android phones, even in the night theme.
 */
export function applyWindowBackground(color: string) {
  if (Platform.OS === 'web') return;
  try {
    const SystemUI = require('expo-system-ui') as typeof import('expo-system-ui');
    void SystemUI.setBackgroundColorAsync(color).catch(() => undefined);
  } catch {
    // A build without the module simply keeps the launch colour from app.json.
  }
}
