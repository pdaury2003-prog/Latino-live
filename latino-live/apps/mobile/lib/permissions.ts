import { Platform } from 'react-native';
import { audioModule, imagePicker } from '@/lib/device-media';
import { notificationsModule } from '@/lib/notifications-module';

/** What the phone answers when the app reads a permission. */
export type AccessState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

function read(status: string | undefined): AccessState {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export async function microphoneState(): Promise<AccessState> {
  const Audio = audioModule();
  if (!Audio) return 'unavailable';
  try {
    return read((await Audio.getRecordingPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export async function askMicrophone(): Promise<AccessState> {
  const Audio = audioModule();
  if (!Audio) return 'unavailable';
  try {
    return read((await Audio.requestRecordingPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export async function photosState(): Promise<AccessState> {
  const Picker = imagePicker();
  if (!Picker) return 'unavailable';
  try {
    return read((await Picker.getMediaLibraryPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export async function askPhotos(): Promise<AccessState> {
  const Picker = imagePicker();
  if (!Picker) return 'unavailable';
  try {
    return read((await Picker.requestMediaLibraryPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export async function cameraState(): Promise<AccessState> {
  const Picker = imagePicker();
  if (!Picker) return 'unavailable';
  try {
    return read((await Picker.getCameraPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export async function askCamera(): Promise<AccessState> {
  const Picker = imagePicker();
  if (!Picker) return 'unavailable';
  try {
    return read((await Picker.requestCameraPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

/** Android needs a channel before the permission prompt makes sense. */
export async function ensureNoticeChannel() {
  const Notifications = notificationsModule();
  if (Platform.OS !== 'android' || !Notifications) return;
  try {
    await Notifications.setNotificationChannelAsync('sahar-avisos', {
      name: 'Avisos de Latino Live',
      description: 'Regalos, seguidores y mensajes de tus salas.',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#FFC24B',
    });
  } catch {
    // The channel is optional on Android versions that ignore channels.
  }
}

export async function notificationsState(): Promise<AccessState> {
  if (Platform.OS === 'web') return 'unavailable';
  const Notifications = notificationsModule();
  if (!Notifications) return 'unavailable';
  try {
    await ensureNoticeChannel();
    return read((await Notifications.getPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export async function askNotifications(): Promise<AccessState> {
  if (Platform.OS === 'web') return 'unavailable';
  const Notifications = notificationsModule();
  if (!Notifications) return 'unavailable';
  try {
    await ensureNoticeChannel();
    return read((await Notifications.requestPermissionsAsync()).status);
  } catch {
    return 'unavailable';
  }
}

export function accessLabel(state: AccessState) {
  if (state === 'granted') return 'Permitido';
  if (state === 'denied') return 'Bloqueado';
  if (state === 'unavailable') return 'En el teléfono';
  return 'Sin pedir';
}
