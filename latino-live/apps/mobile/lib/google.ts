import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { config } from '@/lib/config';
import { authRedirect, requireSupabase } from '@/lib/supabase';

export type GoogleOutcome = 'signed-in' | 'redirected' | 'canceled';

export const GOOGLE_NOT_READY = 'El acceso con Google todavía no está activado. Usa tu correo o regístrate mientras tanto.';

/**
 * Reads the project's account settings to see whether Google is enabled, so the
 * app can say so instead of sending the person to a broken provider page.
 */
export async function googleEnabled(): Promise<boolean> {
  if (!config.backend || !config.anonKey) return false;
  try {
    const response = await fetch(`${config.backend}/auth/v1/settings`, {
      headers: { apikey: config.anonKey },
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: Record<string, boolean> };
    return Boolean(settings.external?.google);
  } catch {
    return false;
  }
}

function friendly(message: string) {
  if (/provider is not enabled|unsupported provider|not enabled/i.test(message)) {
    return GOOGLE_NOT_READY;
  }
  if (/redirect|url/i.test(message)) {
    return 'Google no pudo volver a la app. Inténtalo otra vez.';
  }
  return 'No pudimos entrar con Google. Inténtalo otra vez.';
}

/**
 * Google sign-in through the browser. The provider must be enabled for this
 * project's accounts; when it is not, the button says so instead of pretending.
 */
export async function signInWithGoogle(): Promise<GoogleOutcome> {
  const client = requireSupabase();
  const redirectTo = authRedirect();
  if (!(await googleEnabled())) throw new Error(GOOGLE_NOT_READY);

  if (Platform.OS === 'web') {
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error) throw new Error(friendly(error.message));
    if (!data?.url) throw new Error(GOOGLE_NOT_READY);
    if (typeof window !== 'undefined') {
      window.location.assign(data.url);
      return 'redirected';
    }
    return 'canceled';
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(friendly(error.message));
  if (!data?.url) throw new Error('El acceso con Google todavía no está activado. Usa tu correo mientras tanto.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) return 'canceled';

  const query = new URLSearchParams(result.url.split('?')[1] ?? '');
  const code = query.get('code');
  if (!code) return 'canceled';
  const exchanged = await client.auth.exchangeCodeForSession(code);
  if (exchanged.error) throw new Error(friendly(exchanged.error.message));
  return 'signed-in';
}
