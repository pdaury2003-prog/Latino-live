import Constants from 'expo-constants';
import { timeoutSignal } from './abort';
import { parseRuntimeConfig, readServerValues, type RuntimeEnvironment } from './runtime-config';

/**
 * The app's own scheme, read from its manifest so a build made by its owner
 * keeps working without the platform's variables. A manifest may declare one
 * scheme or a list; the first one is what its links use.
 */
function manifestScheme(): string {
  const declared = Constants.expoConfig?.scheme;
  const value = Array.isArray(declared) ? declared[0] : declared;
  return typeof value === 'string' ? value.trim() : '';
}

// Expo inlines only statically referenced public variables. Never put a
// service-role key, payment credential or platform token in this module.
export const config = {
  backend: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  applicationId: process.env.EXPO_PUBLIC_SPK_APPLICATION_ID ?? '',
  platform: process.env.EXPO_PUBLIC_SPK_PLATFORM_ORIGIN ?? '',
  // The manifest wins: a link must open this app, whatever built it.
  scheme: manifestScheme() || process.env.EXPO_PUBLIC_SPK_APPLICATION_ID || '',
  // The app's own site: the public pages a store listing points at.
  site: 'https://latino-live.exaspark.app',
  statusUrl: process.env.EXPO_PUBLIC_SPK_APP_STATUS_URL ?? '',
  versionCode: Number(process.env.EXPO_PUBLIC_SPK_VERSION_CODE ?? 0),
  preview: process.env.EXPO_PUBLIC_SPK_PREVIEW === 'true',
  // Diamond top-ups with a card. A store build turns them off, because Google
  // Play only accepts its own billing for digital goods inside the app.
  topUp: process.env.EXPO_PUBLIC_ENABLE_TOPUP !== 'false',
  // True only for the package that goes to a store. Play Billing works just in
  // an app installed by Play, so a build from the direct link must not offer it.
  storeBuild: process.env.EXPO_PUBLIC_STORE_BUILD === 'true',
  /**
   * El CDN propio delante de las fotos, cuando existe. Vacío significa que se
   * sirven desde el almacenamiento del proyecto, como siempre.
   */
  assetHost: process.env.EXPO_PUBLIC_ASSET_HOST ?? '',
};

/**
 * The server this app belongs to, when the build did not carry it.
 *
 * A build made by the app's owner (EAS, or `npx expo run:android`) has no
 * platform variables, so without this the app would open and then say the
 * rooms are unavailable. The project's public site already serves exactly
 * these two values to every browser that opens it — the address and the
 * public app key — so the phone reads the same file instead of the values
 * being copied into the source. Row-level security, not secrecy, is what
 * protects the data; the public key grants nothing on its own.
 */
/** Takes the address and public key into the running config, when they are usable. */
function adoptRuntimeConfig(values: RuntimeEnvironment | null | undefined) {
  const server = readServerValues(values);
  if (!server) return false;
  config.backend = server.url;
  config.anonKey = server.key;
  if (!config.platform && server.platform) config.platform = server.platform;
  return true;
}

let resolved: Promise<boolean> | null = null;

/** Fills the server address and public key when the build did not include them. */
export function resolveRuntimeConfig(): Promise<boolean> {
  if (config.backend && config.anonKey) return Promise.resolve(true);
  resolved ??= (async () => {
    // On the site, the page already loaded the project's runtime config.
    const declared = (globalThis as { __SPK_RUNTIME_CONFIG__?: RuntimeEnvironment }).__SPK_RUNTIME_CONFIG__;
    if (adoptRuntimeConfig(declared)) return true;
    try {
      const response = await fetch(`${config.site}/spk-runtime-config.js`, {
        signal: timeoutSignal(8_000),
        headers: { Accept: 'text/javascript' },
      });
      if (!response.ok) return false;
      return adoptRuntimeConfig(parseRuntimeConfig(await response.text()));
    } catch {
      return false;
    }
  })();
  return resolved;
}
