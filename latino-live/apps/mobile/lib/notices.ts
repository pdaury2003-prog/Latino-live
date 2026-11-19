import { Platform } from 'react-native';
import { ensureNoticeChannel } from '@/lib/permissions';
import { notificationsModule } from '@/lib/notifications-module';

/** One real thing that happened while the person was away from a screen. */
export type AppNotice = {
  id: string;
  /** `room` is someone this person follows opening a room right now. */
  kind: 'gift' | 'follow' | 'chat' | 'invite' | 'room';
  title: string;
  body: string;
  at: string;
  slug: string | null;
  /** The code of a private room, when the invitation carries it. */
  code?: string | null;
};

/**
 * Shows a system notice on the phone. Only called for events the person can
 * already see inside the app, so a refused permission loses nothing.
 */
export async function showSystemNotice(title: string, body: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const Notifications = notificationsModule();
  if (!Notifications) return false;
  try {
    // Foreground notices show as a banner; the app also lists them in Avisos.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return false;
    await ensureNoticeChannel();
    await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: false },
      trigger: null,
    });
    return true;
  } catch {
    return false;
  }
}
