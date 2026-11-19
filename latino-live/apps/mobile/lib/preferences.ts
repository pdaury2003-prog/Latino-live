import { getSupabase } from '@/lib/supabase';

export type SavedTheme = 'light' | 'dark';

/** The signed-in account, when there is one; every preference needs it. */
async function currentUserId(): Promise<string | null> {
  const client = getSupabase();
  if (!client) return null;
  try {
    const { data } = await client.auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/** The look saved to the account, so a new phone opens the same way. */
export async function loadTheme(): Promise<SavedTheme | null> {
  const client = getSupabase();
  const userId = await currentUserId();
  if (!client || !userId) return null;
  const { data, error } = await client.from('profiles').select('theme').eq('id', userId).maybeSingle();
  if (error) return null;
  const theme = (data as { theme?: string | null } | null)?.theme;
  return theme === 'light' || theme === 'dark' ? theme : null;
}

export async function saveTheme(theme: SavedTheme): Promise<void> {
  const client = getSupabase();
  const userId = await currentUserId();
  if (!client || !userId) return;
  await client.from('profiles').update({ theme }).eq('id', userId);
}

/**
 * Calls back when a person signs in, including the session restored at launch,
 * so the preferences saved in the account arrive with the session.
 */
export function onSignedIn(callback: () => void): () => void {
  const client = getSupabase();
  if (!client) return () => undefined;
  const { data } = client.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED')) callback();
  });
  return () => data.subscription.unsubscribe();
}

/** The newest notice the person has read, kept with the account. */
export async function loadNoticesSeen(): Promise<string | null> {
  const client = getSupabase();
  const userId = await currentUserId();
  if (!client || !userId) return null;
  const { data, error } = await client.from('profiles').select('notices_seen_at').eq('id', userId).maybeSingle();
  if (error) return null;
  return (data as { notices_seen_at?: string | null } | null)?.notices_seen_at ?? null;
}

export async function saveNoticesSeen(at: string): Promise<void> {
  const client = getSupabase();
  const userId = await currentUserId();
  if (!client || !userId) return;
  await client.from('profiles').update({ notices_seen_at: at }).eq('id', userId);
}
