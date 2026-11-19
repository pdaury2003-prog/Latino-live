/**
 * The project's public runtime file, read without touching the running app.
 *
 * Kept free of React Native imports so the parsing can be tested on its own:
 * a build made outside the platform has no server variables, and this is what
 * lets the phone find the server it belongs to.
 */
export type RuntimeEnvironment = { supabaseUrl?: unknown; supabaseAnonKey?: unknown; platformOrigin?: unknown };
export type ServerValues = { url: string; key: string; platform: string };

/**
 * Reads the values out of the site's runtime file. The file assigns one JSON
 * object to a global, so the object is taken by its braces and nothing else in
 * the file is executed or trusted.
 */
export function parseRuntimeConfig(text: string): RuntimeEnvironment | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const value = JSON.parse(text.slice(start, end + 1)) as unknown;
    return value && typeof value === 'object' ? (value as RuntimeEnvironment) : null;
  } catch {
    return null;
  }
}

/** The usable address, public key and site origin, or null when any is missing. */
export function readServerValues(values: RuntimeEnvironment | null | undefined): ServerValues | null {
  if (!values) return null;
  const url = typeof values.supabaseUrl === 'string' ? values.supabaseUrl.trim() : '';
  const key = typeof values.supabaseAnonKey === 'string' ? values.supabaseAnonKey.trim() : '';
  if (!url || !key) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  const platform = typeof values.platformOrigin === 'string' ? values.platformOrigin.trim() : '';
  return { url, key, platform };
}
