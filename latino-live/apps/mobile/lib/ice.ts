export type IceServer = { urls: string; username?: string; credential?: string };

/** The free address finders that let two phones meet directly. */
const STUN: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

/**
 * The room's own relay, when the project has one. Without it the two people
 * still connect directly in most networks; with it, the room also works
 * between carriers and countries that would otherwise never find each other.
 *
 * Set `EXPO_PUBLIC_TURN_URL` (comma-separated), `EXPO_PUBLIC_TURN_USERNAME`
 * and `EXPO_PUBLIC_TURN_CREDENTIAL` to switch it on.
 */
function turnServers(): IceServer[] {
  const urls = (process.env.EXPO_PUBLIC_TURN_URL ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  if (!urls.length) return [];
  const username = process.env.EXPO_PUBLIC_TURN_USERNAME;
  const credential = process.env.EXPO_PUBLIC_TURN_CREDENTIAL;
  return urls.map(url => ({ urls: url, username, credential }));
}

/**
 * The servers every call starts with: the address finders first, then a relay
 * this build was configured with. When the project has its own relay it is
 * added from the server before the first call.
 *
 * A public "free" relay is deliberately not here. The one this app carried
 * spent a failing call on a host that resolves to the reserved discard
 * addresses (192.0.2.1 and 100::1) and refuses every allocation, so a room
 * that needed a relay arrived nowhere. A relay must be a real service the
 * project holds credentials for, never a hopeful address in a list.
 */
export const ICE_FALLBACK: IceServer[] = [...STUN, ...turnServers()];

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
/** A call waits this long for a relay already on its way, never longer. */
const FIRST_CALL_WAIT_MS = 1200;

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
  // One lookup at a time. After ten quiet minutes it asks again, so a relay
  // added later starts to work without restarting the app.
  if (!askedAt || Date.now() - askedAt > RELAY_CACHE_MS) {
    askedAt = Date.now();
    running = (async () => {
      try {
        const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 2500));
        const extra = (await Promise.race([read(), timeout])) ?? [];
        const own = relayEntries(extra);
        // The project's relay goes first. Direct paths stay in the list: when
        // two phones can reach each other, that is the lowest-latency path and
        // the voice arrives soonest.
        if (own.length) relayed = { at: Date.now(), servers: [...STUN, ...own, ...turnServers()] };
      } catch {
        // Offline or the relay is not configured: the call goes direct.
      } finally {
        running = null;
      }
    })();
  }
  // A call that arrives while the lookup is in flight waits a moment for it
  // instead of starting without a relay: the first call is exactly the one
  // that needs it, and a second of reach is worth more than a second saved.
  if (running) {
    await Promise.race([running, new Promise(resolve => setTimeout(resolve, FIRST_CALL_WAIT_MS))]);
  }
  if (relayed && Date.now() - relayed.at < RELAY_CACHE_MS) {
    return { servers: relayed.servers, dedicated: true };
  }
  return { servers: ICE_FALLBACK, dedicated: false };
}

/**
 * What the connection check in Settings reports:
 *   active      the project holds a working relay
 *   missing     no relay was configured yet
 *   rejected    a relay was configured but its keys were refused
 *   unreachable the server did not answer in time
 */
export type RelayCheckState =
  | 'active'
  | 'missing'
  | 'rejected'
  /** The Token ID does not exist in the account that owns the API token. */
  | 'unknown-key'
  /** Cloudflare refused the API token itself. */
  | 'auth'
  | 'unreachable';

/** What the check found, with the server's own reason when there is one. */
export type RelayCheck = { state: RelayCheckState; detail?: string };

/** The server's answer, with the reason it carries when no relay is handed out. */
export type RelayReply = { iceServers?: IceServer[] | null; state?: string; detail?: string } | null;

/**
 * Asks the project's server for its relay right now, ignoring the ten-minute
 * cache, and says exactly why the room can or cannot cross restrictive
 * networks. Used by the connection check in Settings.
 */
export async function checkRelay(read: () => Promise<RelayReply>): Promise<RelayCheck> {
  try {
    const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), 4000));
    const reply = await Promise.race([read(), timeout]);
    if (!reply) return { state: 'unreachable' };
    const own = relayEntries(reply.iceServers ?? []);
    if (!own.length) {
      const state = reply.state;
      if (state === 'rejected' || state === 'unknown-key' || state === 'auth') {
        return { state, detail: reply.detail };
      }
      return { state: 'missing', detail: reply.detail };
    }
    relayed = { at: Date.now(), servers: [...STUN, ...own, ...turnServers()] };
    askedAt = Date.now();
    return { state: 'active' };
  } catch {
    return { state: 'unreachable' };
  }
}

/**
 * Forgets the relay on purpose: another account signs in, or a test starts
 * from a clean launch. The next call asks the server again.
 */
export function resetRelayCache() {
  relayed = null;
  askedAt = 0;
  running = null;
}

/**
 * Starts the relay lookup before a room is opened, so the project's own relay
 * is already in the list by the first call. Called once at launch; a failure
 * only means the call goes direct.
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
