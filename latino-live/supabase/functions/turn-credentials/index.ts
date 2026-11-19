// Hands the room's calls a relay, so two people can talk even when their
// networks never find each other directly (different carriers, countries or
// restrictive Wi-Fi). The provider's keys stay here on the server.
//
// Configure one of these in Cloud → Keys, in this order of preference:
//
//   Cloudflare Calls TURN — a global anycast relay that also answers on
//   port 443 over TLS, so it works where ordinary UDP is blocked:
//     TURN_KEY_ID          the key id of the Cloudflare TURN app
//     TURN_KEY_API_TOKEN   its API token
//
//   Metered — a hosted relay with a dashboard:
//     METERED_API_KEY      the TURN credential's API key
//     METERED_APP          the app name shown on the provider's dashboard
//
//   An own coturn server:
//     TURN_URLS            comma-separated turn: addresses
//     TURN_USERNAME / TURN_CREDENTIAL
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type IceServer = { urls: string; username?: string; credential?: string };
type RawServer = { urls: string | string[]; username?: string; credential?: string };

/** A relay credential is good for hours; one fetch serves the whole instance. */
let cached: { at: number; servers: IceServer[]; source: string } | null = null;
const CACHE_MS = 10 * 60 * 1000;

function ownRelay(): IceServer[] {
  const urls = (Deno.env.get('TURN_URLS') ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  if (!urls.length) return [];
  const username = Deno.env.get('TURN_USERNAME') ?? undefined;
  const credential = Deno.env.get('TURN_CREDENTIAL') ?? undefined;
  return urls.map(url => ({ urls: url, username, credential }));
}

/**
 * Only the fields a call needs, one entry per address. Port 53 is dropped:
 * Cloudflare lists an alternate address there, but browsers and Android block
 * that port, so a phone that tried it waited for a timeout for nothing.
 */
function clean(value: unknown): IceServer[] {
  if (!Array.isArray(value)) return [];
  const servers: IceServer[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const urls = record.urls ?? record.url;
    const list = (Array.isArray(urls) ? urls : [urls])
      .filter((url): url is string => typeof url === 'string' && url.length > 0 && !/:53(?:\?|$)/.test(url));
    for (const url of list) {
      servers.push({
        urls: url,
        username: typeof record.username === 'string' ? record.username : undefined,
        credential: typeof record.credential === 'string' ? record.credential : undefined,
      });
    }
  }
  return servers;
}

/**
 * What a provider answered, in terms the phone can show:
 *   missing  — the keys are not in Cloud → Keys yet
 *   rejected — the keys are there but the provider refused them
 *   ok       — a usable relay
 */
type ProviderResult = { servers: IceServer[]; state: 'missing' | 'rejected' | 'ok'; detail?: string };

const MISSING: ProviderResult = { servers: [], state: 'missing' };

/** Cloudflare's global relay: anycast, and reachable over TLS on 443. */
async function fromCloudflare(): Promise<ProviderResult> {
  const keyId = Deno.env.get('TURN_KEY_ID');
  const token = Deno.env.get('TURN_KEY_API_TOKEN');
  if (!keyId || !token) {
    // Names only, never the values: this tells the owner which entry in
    // Cloud → Keys is missing instead of a plain "no".
    const absent = [!keyId && 'TURN_KEY_ID', !token && 'TURN_KEY_API_TOKEN'].filter(Boolean);
    return { servers: [], state: 'missing', detail: `falta ${absent.join(' y ')}` };
  }
  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ttl: 86_400 }),
        signal: AbortSignal.timeout(4000),
      },
    );
    // A refused key or an unknown app is a configuration problem the owner can
    // fix; saying so is better than a room that silently never relays.
    if (!response.ok) return { servers: [], state: 'rejected', detail: `cloudflare ${response.status}` };
    const body = await response.json() as { iceServers?: RawServer | RawServer[] };
    const raw = Array.isArray(body.iceServers) ? body.iceServers : body.iceServers ? [body.iceServers] : [];
    const servers = clean(raw);
    return servers.length ? { servers, state: 'ok' } : { servers: [], state: 'rejected', detail: 'cloudflare empty' };
  } catch {
    return { servers: [], state: 'rejected', detail: 'cloudflare unreachable' };
  }
}

/** Metered's hosted relay, with the same kind of temporary credential. */
async function fromMetered(): Promise<ProviderResult> {
  const key = Deno.env.get('METERED_API_KEY');
  if (!key) return MISSING;
  const host = Deno.env.get('METERED_APP') || 'global';
  try {
    const url = `https://${host}.metered.live/api/v1/turn/credentials?apiKey=${encodeURIComponent(key)}`;
    const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    if (!response.ok) return { servers: [], state: 'rejected', detail: `metered ${response.status}` };
    const servers = clean(await response.json());
    return servers.length ? { servers, state: 'ok' } : { servers: [], state: 'rejected', detail: 'metered empty' };
  } catch {
    return { servers: [], state: 'rejected', detail: 'metered unreachable' };
  }
}

/**
 * The first provider that answers with a usable relay. When none does, the
 * answer says whether the project simply has no keys yet or whether the keys
 * it has were refused, so the owner knows what to fix.
 */
async function fromProvider(): Promise<{ servers: IceServer[]; source: string; state: 'active' | 'missing' | 'rejected'; detail?: string }> {
  const providers = [['cloudflare', fromCloudflare], ['metered', fromMetered]] as const;
  let rejected: { source: string; detail?: string } | null = null;
  let absent: string | undefined;
  for (const [source, read] of providers) {
    const result = await read();
    if (result.state === 'ok') return { servers: result.servers, source, state: 'active' };
    if (result.state === 'rejected' && !rejected) rejected = { source, detail: result.detail };
    if (result.state === 'missing' && result.detail) absent = result.detail;
  }
  if (rejected) return { servers: [], source: rejected.source, state: 'rejected', detail: rejected.detail };
  return { servers: [], source: 'none', state: 'missing', detail: absent };
}

Deno.serve(async (request: Request) => {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Método no permitido' }, 405);

  const own = ownRelay();
  if (own.length) return reply({ configured: true, state: 'active', source: 'own', iceServers: own });

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return reply({ configured: true, state: 'active', source: cached.source, iceServers: cached.servers });
  }

  const { servers, source, state, detail } = await fromProvider();
  // A refused key is reported every time: the owner may fix it at any moment
  // and the next check must see the fix, not a cached "no".
  if (state !== 'active') return reply({ configured: false, state, source, detail, iceServers: [] });
  cached = { at: Date.now(), servers, source };
  return reply({ configured: true, state, source, iceServers: servers });
});
