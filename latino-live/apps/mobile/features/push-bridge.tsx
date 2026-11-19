import { useEffect } from 'react';
import { Platform } from 'react-native';
import { router, type Href } from 'expo-router';
import { useAuth } from '@/features/auth';
import { notificationsModule } from '@/lib/notifications-module';
import { notificationsState } from '@/lib/permissions';
import { registerPush } from '@/lib/push';

/**
 * The phone's notices, kept in step with the account: a phone that already
 * allowed them saves its address without asking again, a tap opens the room
 * the notice was about, and signing out stops them on the next phone.
 */
export function PushBridge() {
  const { session } = useAuth();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    const Notifications = notificationsModule();
    if (!Notifications) return;
    const open = (slug: unknown) => {
      if (typeof slug === 'string' && slug) router.push(`/room/${slug}` as Href);
    };
    // A notice that launched the app names its room once, at start.
    const last = (Notifications as unknown as { getLastNotificationResponseAsync?: () => Promise<unknown> })
      .getLastNotificationResponseAsync;
    if (last) {
      void Notifications.getLastNotificationResponseAsync()
        .then(response => open(response?.notification.request.content.data?.slug))
        .catch(() => undefined);
    }
    const subscription = Notifications.addNotificationResponseReceivedListener(response => {
      open(response.notification.request.content.data?.slug);
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!session?.user.id) return;
    let live = true;
    void notificationsState().then(state => {
      if (live && state === 'granted') void registerPush();
    });
    return () => { live = false; };
  }, [session?.user.id]);

  return null;
}
