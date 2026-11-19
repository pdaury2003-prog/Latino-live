import { Platform, Share } from 'react-native';
import { config } from '@/lib/config';

const SCHEME = config.scheme || 'ai.exaspark.app';
/**
 * The published site: a link anyone can open. A build made by the app's owner
 * has no platform address, so the app's own site is used instead of a private
 * scheme that only this phone understands.
 */
const WEB = (config.platform || config.site).replace(/\/+$/, '');

/**
 * A link to the room. The site's own address is shared when the app knows it,
 * because it opens on any phone; the app's private address is the fallback
 * for a build that was not given the published address.
 */
export function roomLink(slug: string) {
  return WEB ? `${WEB}/room/${slug}` : `${SCHEME}://room/${slug}`;
}

/** The short code guests read out: the unique suffix of the room's link. */
export function roomCode(slug: string) {
  const parts = slug.split('-').filter(Boolean);
  const tail = parts[parts.length - 1] ?? slug;
  return tail.toUpperCase();
}

export type ShareOutcome = 'shared' | 'copied' | 'canceled' | 'failed';

/** Opens the phone's share sheet with words of our own. */
export async function shareText(title: string, message: string): Promise<ShareOutcome> {
  try {
    if (Platform.OS === 'web') {
      const web = globalThis as unknown as { navigator?: { share?: (data: { title: string; text: string }) => Promise<void>; clipboard?: { writeText: (text: string) => Promise<void> } } };
      if (web.navigator?.share) {
        await web.navigator.share({ title, text: message });
        return 'shared';
      }
      if (web.navigator?.clipboard) {
        await web.navigator.clipboard.writeText(message);
        return 'copied';
      }
      return 'failed';
    }
    const result = await Share.share({ title, message });
    return result.action === Share.sharedAction ? 'shared' : 'canceled';
  } catch {
    return 'failed';
  }
}

/** Opens the phone's share sheet with an invitation that opens the room. */
export async function shareRoom(room: { title: string; slug: string; host_name: string }): Promise<ShareOutcome> {
  const link = roomLink(room.slug);
  const appLink = `${SCHEME}://room/${room.slug}`;
  const message = `${room.host_name} te invita a la sala "${room.title}" en Latino Live.\n\nAbre el enlace en tu teléfono:\n${link}\n\nCódigo de sala: ${roomCode(room.slug)}${WEB ? `\n\nYa tienes la app? Abre: ${appLink}` : ''}`;
  return shareText(room.title, message);
}
