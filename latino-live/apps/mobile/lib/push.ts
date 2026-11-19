import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { getSupabase } from '@/lib/supabase';
import { notificationsModule } from '@/lib/notifications-module';
import { ensureNoticeChannel } from '@/lib/permissions';

const TOKEN_KEY = 'sahar:push:token';

/**
 * What stops a notice arriving with the app closed, when something does:
 * `project` the build has no notification project, `firebase` it has no
 * Firebase setup, `permission` the person said no, `server` the address could
 * not be saved. `ready` means nothing is missing.
 */
export type PushState = 'ready' | 'project' | 'firebase' | 'permission' | 'server' | 'unsupported';

/** The app's notification project, when this build carries one. */
function projectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return Constants.easConfig?.projectId ?? extra?.eas?.projectId ?? null;
}

/**
 * The address the notification service knows this phone by. It is read from
 * the phone, so a reinstall or a cleared app gets a fresh one.
 */
async function deviceAddress(): Promise<{ address: string | null; state: PushState }> {
  if (Platform.OS === 'web') return { address: null, state: 'unsupported' };
  const Notifications = notificationsModule();
  const project = projectId();
  if (!Notifications) return { address: null, state: 'unsupported' };
  if (!project) return { address: null, state: 'project' };
  try {
    const address = (await Notifications.getExpoPushTokenAsync({ projectId: project })).data;
    return address ? { address, state: 'ready' } : { address: null, state: 'firebase' };
  } catch (cause) {
    // Without the Firebase setup inside the APK the phone cannot get an
    // address at all; that is a build gap, not a connection problem.
    const code = (cause as { code?: string } | null)?.code ?? '';
    const message = cause instanceof Error ? cause.message : '';
    const firebase = code === 'ERR_NOTIFICATIONS_NO_APP_ID'
      || /firebase|google-services|FIS|no app id|appId/i.test(message)
      || code === 'ERR_NOTIFICATIONS_NO_APPLICATION_ID';
    return { address: null, state: firebase ? 'firebase' : 'server' };
  }
}

/**
 * Gives this phone's address to the signed-in account, so the notice of a
 * room opening arrives even when the app is not open.
 */
export async function registerPush(): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  const Notifications = notificationsModule();
  if (!Notifications) return 'unsupported';
  try {
    await ensureNoticeChannel();
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return 'permission';
    const { address, state } = await deviceAddress();
    if (!address) return state;
    const client = getSupabase();
    if (!client) return 'server';
    const { error } = await client.rpc('save_push_token', { p_token: address, p_platform: Platform.OS });
    if (error) return 'server';
    await AsyncStorage.setItem(TOKEN_KEY, address).catch(() => undefined);
    return 'ready';
  } catch {
    return 'server';
  }
}

/** Asks for the phone's permission and, when granted, gives the address. */
export async function enablePush(): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  const Notifications = notificationsModule();
  if (!Notifications) return 'unsupported';
  try {
    await ensureNoticeChannel();
    const asked = await Notifications.requestPermissionsAsync();
    if (asked.status !== 'granted') return 'permission';
  } catch {
    return 'server';
  }
  return registerPush();
}

/**
 * Signing out stops the notices on this phone. The address is read again when
 * possible, and the last saved one is used when the phone cannot ask the
 * service (for example with no connection).
 */
export async function unregisterPush(): Promise<void> {
  if (Platform.OS === 'web') return;
  const stored = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  const address = (await deviceAddress()).address ?? stored;
  if (!address) return;
  const client = getSupabase();
  if (client) {
    try {
      await client.rpc('drop_push_token', { p_token: address });
    } catch {
      // A phone that cannot reach the server forgets the address anyway.
    }
  }
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

/**
 * What this phone can do right now, and it leaves the address saved when it
 * can. Opening Avisos after installing is enough to know whether this build
 * reaches the phone with the app closed.
 */
export async function pushCapability(): Promise<PushState> {
  if (Platform.OS === 'web') return 'unsupported';
  const Notifications = notificationsModule();
  if (!Notifications) return 'unsupported';
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (permission.status !== 'granted') return 'permission';
    await ensureNoticeChannel();
    return await registerPush();
  } catch {
    return 'server';
  }
}

/**
 * Sends one notice to this account's phones, so the person can see for
 * themselves that it arrives. Returns false when there is nowhere to send it.
 */
export async function sendTestPush(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;
  try {
    const { data, error } = await client.rpc('push_test');
    if (error) return false;
    return data === true;
  } catch {
    return false;
  }
}
