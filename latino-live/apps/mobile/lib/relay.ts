import { config } from './config';
import type { IceServer } from './ice';
import { getSupabase } from './supabase';

/**
 * The relay's answer, in the terms the room can show. `iceServers` carries
 * short-lived credentials the phone may use; `state` says why it is empty.
 */
export type RelayReply = { iceServers?: IceServer[] | null; state?: string; detail?: string } | null;

/** The project's own site, where the relay key lives. */
const SITE = 'https://latino-live.exaspark.app';

/**
 * Where a relay may be asked for. The app's backend function is tried first,
 * then the project's site: this project's runtime hands the Cloudflare key to
 * the website and not to the function, so the site is the one that answers.
 */
function candidates(): string[] {
  const origins = [config.platform, SITE]
    .map(origin => origin.replace(/\/+$/, ''))
    .filter(Boolean);
  return [...new Set(origins)];
}

let siteKey: { origin: string; key: string; at: number } | null = null;
const SITE_KEY_MS = 10 * 60 * 1000;

/**
 * The site's own public key, read from the file it serves to browsers. The
 * relay route only accepts this key or a signed-in session, so nobody else can
 * spend the project's relay by calling the address. The file holds public
 * configuration only; no secret is ever read here.
 */
async function publicSiteKey(origin: string): Promise<string> {
  if (siteKey && siteKey.origin === origin && Date.now() - siteKey.at < SITE_KEY_MS) return siteKey.key;
  try {
    const response = await fetch(`${origin}/spk-runtime-config.js`);
    if (!response.ok) return '';
    const text = (await response.text()).trim();
    const json = /__SPK_RUNTIME_CONFIG__=([\s\S]*?);?\s*$/.exec(text)?.[1];
    if (!json) return '';
    const parsed = JSON.parse(json) as { supabaseAnonKey?: unknown };
    const key = typeof parsed.supabaseAnonKey === 'string' ? parsed.supabaseAnonKey : '';
    if (key) siteKey = { origin, key, at: Date.now() };
    return key;
  } catch {
    return '';
  }
}

async function askSite(origin: string, token: string): Promise<RelayReply> {
  const appKey = await publicSiteKey(origin);
  try {
    const response = await fetch(`${origin}/api/turn`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(appKey ? { 'x-app-key': appKey } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: '{}',
    });
    if (!response.ok) return null;
    return (await response.json()) as RelayReply;
  } catch {
    return null;
  }
}

/**
 * Reads the room's relay: the backend function first, the site second, and the
 * first answer that actually carries a relay wins. A signed-out phone gets
 * nothing from either, and the call simply goes direct.
 */
export async function readRelay(): Promise<RelayReply> {
  const client = getSupabase();
  if (!client) return null;

  let first: RelayReply = null;
  try {
    const { data } = await client.functions.invoke('turn-credentials', { body: {} });
    first = data as RelayReply;
    if (first?.iceServers?.length) return first;
  } catch {
    // The function may be unavailable; the site can still answer.
  }

  const session = await client.auth.getSession().catch(() => null);
  const token = session?.data.session?.access_token;
  if (!token) return first;

  for (const origin of candidates()) {
    const reply = await askSite(origin, token);
    if (reply?.iceServers?.length) return reply;
    first = first?.detail ? first : (reply ?? first);
  }
  return first;
}
