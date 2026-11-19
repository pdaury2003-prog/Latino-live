import { getSupabase } from '@/lib/supabase';
import { markLive } from '@/lib/youtube-live';

export type YoutubeFilter = 'all' | 'live' | 'music';

export type YoutubeResult = {
  id: string;
  title: string;
  channel: string;
  duration: string;
  thumbnail: string;
  isLive?: boolean;
};

export const YOUTUBE_FILTERS: { key: YoutubeFilter; label: string }[] = [
  { key: 'all', label: 'Todo' },
  { key: 'live', label: 'En vivo' },
  { key: 'music', label: 'Música' },
];

/**
 * A few videos that always work, so the room can start watching with one tap:
 * a live radio, synthwave, jazz, and the Earth from space.
 */
export const YOUTUBE_PICKS: YoutubeResult[] = [
  {
    id: 'jfKfPfyJRdk',
    title: 'Lofi Girl · beats para estudiar y relajarse',
    channel: 'Lofi Girl',
    duration: 'EN VIVO',
    thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
    isLive: true,
  },
  {
    id: '4xDzrJKXOOY',
    title: 'Synthwave radio · retrowave para la noche',
    channel: 'Lofi Girl',
    duration: 'EN VIVO',
    thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg',
    isLive: true,
  },
  {
    id: 'DXUAyRRkI6k',
    title: 'Jazz cálido · ambiente de café',
    channel: 'Cafe Music',
    duration: 'EN VIVO',
    thumbnail: 'https://i.ytimg.com/vi/DXUAyRRkI6k/mqdefault.jpg',
    isLive: true,
  },
  {
    id: '21X5lGlDOfg',
    title: 'La Tierra en vivo desde la Estación Espacial',
    channel: 'NASA',
    duration: 'EN VIVO',
    thumbnail: 'https://i.ytimg.com/vi/21X5lGlDOfg/mqdefault.jpg',
    isLive: true,
  },
];

/**
 * Searches YouTube for the room's cinema mode. The search runs on the server,
 * so the host just types what they want and picks a video from the list: no
 * links to copy and nothing extra to install.
 */
export async function searchYoutube(query: string, filter: YoutubeFilter = 'all'): Promise<YoutubeResult[]> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const clean = query.trim().slice(0, 80);
  // A filter with no words still searches something useful.
  const words = clean || (filter === 'live' ? 'en vivo' : filter === 'music' ? 'música' : '');
  if (words.length < 2) return [];
  const { data, error } = await client.functions.invoke('youtube-search', {
    body: { query: words, filter },
  });
  if (error) throw new Error('No pudimos buscar en YouTube. Inténtalo otra vez.');
  const body = data as { videos?: YoutubeResult[]; error?: string } | null;
  if (body?.error) throw new Error(body.error);
  const videos = markLive(Array.isArray(body?.videos) ? body.videos : []);
  // The live filter only keeps streams; if YouTube returned none, the list
  // stays empty and the room explains it instead of showing a wrong result.
  return filter === 'live' ? videos.filter(video => video.isLive) : videos;
}

export { markLive };

/** The fixed videos that fit the chosen filter, for one-tap watching. */
export function youtubePicks(filter: YoutubeFilter): YoutubeResult[] {
  if (filter === 'music') return YOUTUBE_PICKS.slice(0, 3);
  return YOUTUBE_PICKS;
}
