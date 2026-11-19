import { NextResponse } from "next/server";

import { requireServerSupabase } from "@/lib/supabase-server";

/**
 * Hands a signed-in room a short-lived Cloudflare TURN relay, so two people in
 * different countries hear each other even when their carriers block a direct
 * path. The long-lived key stays here on the server; the phone only ever
 * receives a credential that expires.
 *
 * The app's own edge function reads the same two settings, but this project's
 * runtime hands the keys to the website and not to that function, so the site
 * is the one that can actually reach them.
 */
export const dynamic = "force-dynamic";

/**
 * The relay may also be asked for by the app's web build, which runs on its
 * own origin. Only public configuration is needed to call this, so the answer
 * is open; the relay credential itself is short-lived and useless without the
 * project's key.
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-app-key",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: cors });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: cors });
}

type IceServer = { urls: string; username?: string; credential?: string };
type RawServer = { urls: string | string[]; username?: string; credential?: string };

/** A relay credential lasts hours; one fetch serves every call for a while. */
let cached: { at: number; servers: IceServer[] } | null = null;
const CACHE_MS = 10 * 60 * 1000;
/** Two hours: longer than any room, short enough to stay a temporary pass. */
const TTL_SECONDS = 7200;

/**
 * Only the fields a call needs. Port 53 is dropped: Cloudflare lists an
 * alternate address there, but phones block that port, so trying it only
 * costs a timeout.
 */
function clean(value: unknown): IceServer[] {
  if (!Array.isArray(value)) return [];
  const servers: IceServer[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const urls = record.urls ?? record.url;
    const list = (Array.isArray(urls) ? urls : [urls]).filter(
      (url): url is string =>
        typeof url === "string" && url.length > 0 && !/:53(?:\?|$)/.test(url),
    );
    for (const url of list) {
      servers.push({
        urls: url,
        username: typeof record.username === "string" ? record.username : undefined,
        credential: typeof record.credential === "string" ? record.credential : undefined,
      });
    }
  }
  return servers;
}

type RelayResult =
  | { state: "active"; servers: IceServer[] }
  | { state: "missing" | "unknown-key" | "auth" | "rejected" | "unreachable"; detail: string };

/**
 * Asks Cloudflare for a temporary relay credential. The state it returns is
 * the whole diagnosis: a key that does not exist, a token that is refused, or
 * a working relay. Callers decide what to do with the servers.
 */
async function readRelay(ttl: number): Promise<RelayResult> {
  const keyId = process.env.TURN_KEY_ID ?? "";
  const apiToken = process.env.TURN_KEY_API_TOKEN ?? "";
  if (!keyId || !apiToken) {
    // Names only, never the values: it says which entry is missing.
    const absent = [!keyId && "TURN_KEY_ID", !apiToken && "TURN_KEY_API_TOKEN"].filter(Boolean);
    return { state: "missing", detail: `falta ${absent.join(" y ")}` };
  }
  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(keyId)}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiToken}`,
          "content-type": "application/json",
          // Cloudflare's edge refuses requests with a missing or non-browser
          // agent (error 1010), so the server names itself.
          "user-agent": "latino-live/1.0 (+https://latino-live.exaspark.app)",
        },
        body: JSON.stringify({ ttl }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) {
      // A refused key is a configuration problem the owner can fix; saying
      // which one beats a room that silently never relays.
      const reason = await response.text().catch(() => "");
      const unknownKey = response.status === 404 || /cannot find specified key/i.test(reason);
      const refused = response.status === 401 || response.status === 403;
      return {
        state: unknownKey ? "unknown-key" : refused ? "auth" : "rejected",
        detail: unknownKey
          ? "el Token ID no existe en esa cuenta de Cloudflare"
          : refused
            ? "Cloudflare rechazó el API token"
            : `cloudflare ${response.status}`,
      };
    }
    const body = (await response.json()) as { iceServers?: RawServer | RawServer[] };
    const raw = Array.isArray(body.iceServers) ? body.iceServers : body.iceServers ? [body.iceServers] : [];
    const servers = clean(raw);
    if (!servers.length) return { state: "rejected", detail: "cloudflare empty" };
    return { state: "active", servers };
  } catch {
    return { state: "unreachable", detail: "cloudflare unreachable" };
  }
}

export async function POST(request: Request) {
  const token = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  // Two callers need this: the website itself, which sends a signed-in
  // session, and the phone app, which sends its public app key because its
  // accounts live on the project's development backend, not on this site's.
  // Both keys below are public; the long-lived Cloudflare key never leaves
  // this server.
  const appKey = request.headers.get("x-app-key") ?? "";
  const publicKeys = [process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_ANON_KEY]
    .filter((value): value is string => Boolean(value));
  const knownApp = Boolean(appKey) && publicKeys.includes(appKey);
  if (!knownApp) {
    try {
      await requireServerSupabase(token);
    } catch {
      return json({ configured: false, state: "signed-out", iceServers: [] }, 401);
    }
  }

  if (cached && Date.now() - cached.at < CACHE_MS) {
    return json({ configured: true, state: "active", source: "cloudflare", iceServers: cached.servers });
  }

  const result = await readRelay(TTL_SECONDS);
  if (result.state !== "active") {
    return json({ configured: false, state: result.state, detail: result.detail, iceServers: [] });
  }
  cached = { at: Date.now(), servers: result.servers };
  return json({ configured: true, state: "active", source: "cloudflare", iceServers: result.servers });
}

/**
 * The setup check the owner can open in a browser: it asks Cloudflare with a
 * one-minute credential and reports only the state, never the credential, so
 * "my relay is off" becomes a sentence that says exactly what to fix.
 */
export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return json({ configured: true, state: "active" });
  }
  const result = await readRelay(60);
  if (result.state === "active") {
    return json({ configured: true, state: "active", servers: result.servers.length });
  }
  return json({ configured: false, state: result.state, detail: result.detail });
}
