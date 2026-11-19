// Searches YouTube for the room's cinema mode, so the host picks a video from
// a list instead of pasting a link. The search runs here, not in the app, so
// the phone never loads YouTube's page and no API key is needed.
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Thumb = { url?: string; width?: number };
type Run = { text?: string };
type VideoRenderer = {
  videoId?: string;
  title?: { runs?: Run[]; simpleText?: string };
  ownerText?: { runs?: Run[] };
  longBylineText?: { runs?: Run[] };
  lengthText?: { simpleText?: string };
  thumbnail?: { thumbnails?: Thumb[] };
  badges?: { metadataBadgeRenderer?: { style?: string; label?: string } }[];
};

/** Finds every videoRenderer in YouTube's page data, wherever it is nested. */
function collectVideos(node: unknown, found: VideoRenderer[], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 22 || found.length >= 20) return;
  if (Array.isArray(node)) {
    for (const item of node) collectVideos(item, found, depth + 1);
    return;
  }
  const record = node as Record<string, unknown>;
  const renderer = record.videoRenderer as VideoRenderer | undefined;
  if (renderer?.videoId) found.push(renderer);
  for (const value of Object.values(record)) collectVideos(value, found, depth + 1);
}

function textOf(value: { runs?: Run[]; simpleText?: string } | undefined) {
  if (!value) return '';
  if (value.simpleText) return value.simpleText;
  return (value.runs ?? []).map(run => run.text ?? '').join('').trim();
}

Deno.serve(async (request: Request) => {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Método no permitido' }, 405);

  let query = '';
  try {
    const body = await request.json();
    query = String(body?.query ?? '').trim().slice(0, 80);
  } catch {
    return reply({ error: 'Falta la búsqueda' }, 400);
  }
  if (query.length < 2) return reply({ videos: [] });

  // YouTube's own search endpoint answers with plain JSON. It is what the
  // site itself uses, so it keeps working from servers whose network YouTube
  // treats differently from a home connection; reading the results page
  // sometimes returns a consent screen with no videos in it.
  const inner = await searchApi(query, reply);
  if (inner) return inner;

  const target = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=es&gl=MX`;
  let html = '';
  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
        'Accept-Language': 'es-MX,es;q=0.9',
      },
    });
    if (!response.ok) return reply({ error: 'YouTube no respondió. Inténtalo otra vez.' }, 502);
    html = await response.text();
  } catch {
    return reply({ error: 'No pudimos buscar en YouTube. Revisa tu conexión.' }, 502);
  }

  const match = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});<\/script>/)
    ?? html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});/);
  if (!match) return reply({ videos: [] });

  let data: unknown;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return reply({ videos: [] });
  }

  const found: VideoRenderer[] = [];
  collectVideos(data, found);

  return reply({ videos: toVideos(found) });
});

/** Turns YouTube's renderers into the small list the app shows. */
function toVideos(found: VideoRenderer[]) {
  const seen = new Set<string>();
  const videos = [];
  for (const item of found) {
    const id = item.videoId;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const live = (item.badges ?? []).some(badge => /LIVE|EN VIVO|EN DIRECTO/i.test(badge.metadataBadgeRenderer?.label ?? ''));
    const thumbnails = item.thumbnail?.thumbnails ?? [];
    const thumbnail = thumbnails.length ? thumbnails[thumbnails.length - 1]?.url ?? '' : '';
    videos.push({
      id,
      title: textOf(item.title) || 'Video de YouTube',
      channel: textOf(item.ownerText ?? item.longBylineText),
      duration: live ? 'EN VIVO' : item.lengthText?.simpleText ?? '',
      thumbnail: thumbnail || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    });
    if (videos.length >= 12) break;
  }

  return videos;
}

/**
 * Asks YouTube's search endpoint directly. `null` means it did not answer or
 * answered without videos, so the caller falls back to the results page.
 */
async function searchApi(query: string, reply: (body: object, status?: number) => Response) {
  const body = {
    context: {
      client: {
        clientName: 'WEB',
        clientVersion: '2.20240726.00.00',
        gl: 'MX',
        hl: 'es',
      },
    },
    query,
  };
  try {
    const response = await fetch(
      'https://www.youtube.com/youtubei/v1/search?prettyPrint=false&key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36',
          'Accept-Language': 'es-MX,es;q=0.9',
          Origin: 'https://www.youtube.com',
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) return null;
    const found: VideoRenderer[] = [];
    collectVideos(await response.json(), found);
    const videos = toVideos(found);
    return videos.length ? reply({ videos }) : null;
  } catch {
    return null;
  }
}
