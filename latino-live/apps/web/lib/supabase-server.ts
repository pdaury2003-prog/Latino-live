import "server-only";

import { readFile } from "node:fs/promises";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";

import { isPublicSupabaseConfiguration } from "@/lib/supabase";

/** The address the request came in on, used to reach the site's own files. */
export async function siteOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "latino-live.exaspark.app";
  const proto = list.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

/** Parses the one assignment the runtime configuration file holds. */
function parseRuntimeConfig(script: string): { url: string; key: string } {
  const json = /^globalThis\.__SPK_RUNTIME_CONFIG__=(.*);\s*$/su.exec(script)?.[1];
  if (!json) throw new Error("Authentication configuration is invalid.");
  const config: unknown = JSON.parse(json);
  const value = (config ?? {}) as Record<string, unknown>;
  return {
    url: typeof value.supabaseUrl === "string" ? value.supabaseUrl : "",
    key: typeof value.supabaseAnonKey === "string" ? value.supabaseAnonKey : "",
  };
}

/** The public project configuration, read on the server without being run. */
async function publicConfiguration(): Promise<{ url: string; key: string }> {
  // The published server sees the same public configuration the browser gets,
  // as build-time variables; the runtime script is the preview's own way of
  // handing it over, so both are accepted.
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
  let key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (url && key) return { url, key };

  let script = "";
  try {
    script = await readFile("public/spk-runtime-config.js", "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // A built release keeps that file only among its served files, so the site
  // asks itself for it rather than giving up on the room's name.
  if (!script) {
    try {
      const response = await fetch(`${await siteOrigin()}/spk-runtime-config.js`, { cache: "no-store" });
      if (response.ok) script = await response.text();
    } catch {
      // Offline: the room keeps its generic title.
    }
  }
  if (script) {
    // Preview updates this public configuration without restarting the app.
    // Parse its JSON assignment; never execute project-controlled JavaScript.
    const runtime = parseRuntimeConfig(script);
    if (runtime.url && runtime.key) {
      url = runtime.url;
      key = runtime.key;
    }
  }
  if (!isPublicSupabaseConfiguration(url, key)) {
    throw new Error("Authentication and data services are not enabled for this application.");
  }
  return { url, key };
}

/**
 * Reads the public rooms on the server, so a link pasted into a chat already
 * carries the room's name and who is hosting it. Only the rows anybody
 * visiting the site can see are read.
 */
export async function publicServerSupabase() {
  const { url, key } = await publicConfiguration();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function requireServerSupabase(accessToken: string) {
  if (!accessToken.trim()) throw new Error("Sign in to continue.");

  const { url, key } = await publicConfiguration();

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await client.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Your session could not be verified. Sign in again.");
  return { client, user: data.user };
}
