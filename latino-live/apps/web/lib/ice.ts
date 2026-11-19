export type IceServer = { urls: string; username?: string; credential?: string };

/** The free address finders that let two browsers meet directly. */
const STUN: IceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun.cloudflare.com:3478" },
];

/**
 * The room's own relay, when the project has one. Without it the two people
 * still connect directly in most networks; with it, the room also works
 * between carriers and countries that would otherwise never find each other.
 *
 * Set `NEXT_PUBLIC_TURN_URL` (comma-separated), `NEXT_PUBLIC_TURN_USERNAME`
 * and `NEXT_PUBLIC_TURN_CREDENTIAL` to switch it on.
 */
function turnServers(): IceServer[] {
  const urls = (process.env.NEXT_PUBLIC_TURN_URL ?? "")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
  if (!urls.length) return [];
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  return urls.map(url => ({ urls: url, username, credential }));
}

/**
 * Public relays, free and keyless, used while the project has none of its own.
 * Two people in different countries or behind a restrictive network cannot
 * always find each other directly; this is what carries their voice through.
 *
 * The TLS entry on port 443 matters most: it looks like ordinary web traffic,
 * so offices, hotels and carriers that block UDP still let the voice through.
 */
const PUBLIC_TURN: IceServer[] = [
  { urls: "turns:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
];

/**
 * The servers every call starts with: direct first, then the project's own
 * relay when it has one, and the public relay as the last resort.
 */
export const ICE_FALLBACK: IceServer[] = [...STUN, ...turnServers(), ...PUBLIC_TURN];

/** Asks the project's server for its own relay; null when it has none. */
export type RelayReader = () => Promise<IceServer[] | null>;

export type RelayPool = {
  /** The servers a call may use, best path first. */
  servers: IceServer[];
  /** True when the project handed out its own relay, not only the public one. */
  dedicated: boolean;
};

let relayed: { at: number; servers: IceServer[] } | null = null;
let askedAt = 0;
let running: Promise<void> | null = null;
const RELAY_CACHE_MS = 10 * 60 * 1000;

/** Only the entries a call can actually reach a relay through. */
function relayEntries(list: IceServer[]): IceServer[] {
  return list.filter(server => /^turns?:/i.test(String(server.urls)));
}

/**
 * The servers a call starts with. It answers at once: the project's own relay
 * is fetched in the background and used from the next call on, so a slow
 * server never delays the voice. The key stays on the server.
 */
export async function loadIceServers(read: RelayReader): Promise<RelayPool> {
  if (relayed && Date.now() - relayed.at < RELAY_CACHE_MS) {
    return { servers: relayed.servers, dedicated: true };
  }
  // One lookup at a time; every caller keeps going with the public relay.
  // After ten quiet minutes it asks again, so a relay added later works
  // without reloading the page.
  if (!askedAt || Date.now() - askedAt > RELAY_CACHE_MS) {
    askedAt = Date.now();
    running = (async () => {
      try {
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 2500));
        const extra = (await Promise.race([read(), timeout])) ?? [];
        const own = relayEntries(extra);
        if (own.length) relayed = { at: Date.now(), servers: [...STUN, ...own, ...PUBLIC_TURN, ...turnServers()] };
      } catch {
        // Offline or the relay is not configured: the public one carries it.
      } finally {
        running = null;
      }
    })();
  }
  return { servers: ICE_FALLBACK, dedicated: false };
}

/**
 * Starts the relay lookup before a room is opened, so the project's own relay
 * is already in the list by the first call.
 */
export function prefetchRelay(read: RelayReader): void {
  if (relayed || (askedAt && Date.now() - askedAt < RELAY_CACHE_MS)) return;
  void loadIceServers(read);
}

/** Waits for the lookup in flight, for a caller that wants the final list. */
export async function settledRelay(): Promise<RelayPool> {
  if (running) await running;
  if (relayed) return { servers: relayed.servers, dedicated: true };
  return { servers: ICE_FALLBACK, dedicated: false };
}
