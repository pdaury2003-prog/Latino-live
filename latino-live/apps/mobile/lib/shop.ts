// Shop client: frames and SVIP are bought with diamonds; diamond top-ups are
// paid with Stripe and credited by the server from the paid entitlement.
import { getSupabase } from '@/lib/supabase';
import { ALL_FRAMES, GOLD_FRAMES, type GoldFrameKey } from '@/lib/gold';

export type FrameKey = GoldFrameKey;

export type ShopItem = {
  key: string;
  kind: 'frame' | 'svip';
  name: string;
  price_diamonds: number;
  sort_order: number;
};

/** The frames shipped with the app, keyed by the shop key. */
export const FRAMES = GOLD_FRAMES.map(item => ({ key: item.key, name: item.name, note: item.note, art: item.art }));

export function frameArt(key: string | null | undefined): number | null {
  if (!key) return null;
  const found = ALL_FRAMES.find(frame => `frame:${frame.key}` === key || frame.key === key);
  return found?.art ?? null;
}

export function frameName(key: string | null | undefined): string | null {
  if (!key) return null;
  const found = ALL_FRAMES.find(frame => `frame:${frame.key}` === key || frame.key === key);
  return found?.name ?? null;
}

export async function shopItems(): Promise<ShopItem[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from('shop_items').select('*').order('sort_order');
  if (error) throw error;
  return (data ?? []) as ShopItem[];
}

export async function myFrames(): Promise<string[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data: auth } = await client.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) return [];
  const { data, error } = await client.from('profile_frames').select('frame_key').eq('user_id', uid);
  if (error) throw error;
  return (data ?? []).map(row => (row as { frame_key: string }).frame_key);
}

export async function buyFrame(key: string): Promise<number> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('buy_frame', { p_key: `frame:${key}` });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function buySvip(level: number): Promise<number> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('buy_svip', { p_level: level });
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Credits every paid diamond pack that has not reached the wallet yet. */
export async function claimDiamondPacks(): Promise<number> {
  const client = getSupabase();
  if (!client) return 0;
  const { data, error } = await client.rpc('claim_diamond_packs');
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

/** Gold earned from gifts turns into diamonds: 100 gold = 1 diamond. */
export const GOLD_PER_DIAMOND = 100;

/** One line of the wallet's history: a card purchase, an exchange or a gift. */
export type WalletEntry = {
  kind: 'compra' | 'cambio' | 'regalo';
  at: string;
  diamonds: number;
  gold: number;
  title: string;
  note: string | null;
  amountMinor: number | null;
  currency: string | null;
};

type WalletRow = {
  entry_kind: string;
  at: string;
  diamonds: number;
  gold: number;
  title: string;
  note: string | null;
  amount_minor: number | null;
  currency: string | null;
};

/** Everything that moved the wallet, newest first, read straight from the server. */
export async function walletHistory(limit = 40): Promise<WalletEntry[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.rpc('wallet_history', { p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as WalletRow[]).map(row => ({
    kind: row.entry_kind === 'compra' || row.entry_kind === 'regalo' ? row.entry_kind : 'cambio',
    at: row.at,
    diamonds: Number(row.diamonds ?? 0),
    gold: Number(row.gold ?? 0),
    title: row.title,
    note: row.note,
    amountMinor: row.amount_minor === null ? null : Number(row.amount_minor),
    currency: row.currency,
  }));
}

export async function convertGold(gold: number): Promise<{ gold: number; diamonds: number }> {
  const client = getSupabase();
  if (!client) throw new Error('Cuentas no disponibles');
  const { data, error } = await client.rpc('convert_gold', { p_gold: Math.floor(gold) });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as { gold: number; diamonds: number } | null;
  if (!row) throw new Error('No pudimos cambiar el oro');
  return row;
}
