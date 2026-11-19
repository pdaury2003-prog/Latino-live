import { Platform } from 'react-native';

type NotificationsModule = typeof import('expo-notifications');

let cached: NotificationsModule | null | undefined;

/**
 * The system notices module. An installed build that predates it, or a phone
 * that does not ship it, must never stop the app from opening, so it is loaded
 * on demand and a missing module simply disables the notices.
 */
export function notificationsModule(): NotificationsModule | null {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  try {
    cached = require('expo-notifications') as NotificationsModule;
  } catch {
    cached = null;
  }
  return cached;
}
