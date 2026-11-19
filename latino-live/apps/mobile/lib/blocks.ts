import { getSupabase } from '@/lib/supabase';

export type BlockedPerson = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  blocked_at: string;
};

function client() {
  const value = getSupabase();
  if (!value) throw new Error('Necesitas una cuenta para usar esta opción.');
  return value;
}

/** The people this account blocked, newest first. */
export async function listBlocked(): Promise<BlockedPerson[]> {
  const { data, error } = await client().rpc('blocked_profiles');
  if (error) throw error;
  return (data ?? []) as BlockedPerson[];
}

/** Blocks a person: no private messages, no following, no friendship. */
export async function blockUser(userId: string): Promise<void> {
  const { error } = await client().rpc('block_user', { p_user: userId });
  if (error) throw error;
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await client().rpc('unblock_user', { p_user: userId });
  if (error) throw error;
}
