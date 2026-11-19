import { AppState, Linking, Platform } from 'react-native';
import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { config } from './config';
import { getSupabase } from './supabase';
import { useAuth } from '@/features/auth';
import { timeoutSignal } from './abort';

export type Price = { id: string; currency: string; unitAmount: number; recurringInterval?: string | null; recurringIntervalCount?: number; entitlementKey?: string | null };
export type Product = { id: string; name: string; description?: string; prices: Price[] };
export type Ownership = { entitlements: { entitlementKey: string }[]; subscriptions: unknown[]; orders: unknown[] };
export const emptyOwnership: Ownership = { entitlements: [], subscriptions: [], orders: [] };
const attempts = new Map<string, string>();
export function paymentsAvailable() { return Boolean(config.platform && config.backend); }
async function call<T>(path: string, body?: object, requestKey?: string, expectedUserId?: string): Promise<T> {
  if (!paymentsAvailable()) throw new Error('Payments are not set up for this app yet.');
  const session = (await getSupabase()?.auth.getSession())?.data.session;
  if (expectedUserId && session?.user.id !== expectedUserId) throw new Error('You switched accounts. Please try again.');
  const response = await fetch(`${config.platform}/api/app-payments/${path}`, {
    method: body ? 'POST' : 'GET', signal: timeoutSignal(20_000),
    headers: { Accept: 'application/json', 'X-SPK-App-Backend': config.backend,
      ...(session ? { 'X-SPK-Supabase-Access-Token': session.access_token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(requestKey ? { 'Idempotency-Key': requestKey } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(typeof value.message === 'string' ? value.message : 'Payments are temporarily unavailable. Please retry.');
  if (expectedUserId && (await getSupabase()?.auth.getSession())?.data.session?.user.id !== expectedUserId) throw new Error('You switched accounts. Please try again.');
  return value as T;
}
export { priceLabel } from './price';
export const products = () => call<{ items: Product[] }>('products');
export function useOwnership() {
  const { session } = useAuth(), queryClient = useQueryClient();
  const key = ['ownership', session?.user.id ?? null];
  const result = useQuery({ queryKey: key, queryFn: () => call<Ownership>('me', undefined, undefined, session?.user.id), enabled: Boolean(session) && paymentsAvailable(), retry: 1, refetchInterval: 30_000, refetchIntervalInBackground: false });
  useEffect(() => {
    const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['ownership'] }); };
    const activity = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    const links = Linking.addEventListener('url', refresh);
    if (Platform.OS === 'web') window.addEventListener('focus', refresh);
    return () => { activity.remove(); links.remove(); if (Platform.OS === 'web') window.removeEventListener('focus', refresh); };
  }, [queryClient]);
  return { ...result, data: session ? result.data ?? emptyOwnership : emptyOwnership };
}
// Reserve a browser tab in the click handler. A network retry retains the
// same idempotency key, including when the first response was lost.
export async function visitPayment(path: 'checkout' | 'portal', priceId?: string) {
  const tab = Platform.OS === 'web' ? window.open('about:blank', '_blank') : null;
  if (tab) tab.opener = null;
  const auth = getSupabase()?.auth;
  const person = (await auth?.getSession())?.data.session?.user.id;
  const body = { ...(priceId ? { priceId } : {}), ...(config.applicationId ? { applicationId: config.applicationId } : {}) };
  const identity = JSON.stringify([person, path, body]);
  const key = attempts.get(identity) ?? Crypto.randomUUID(); attempts.set(identity, key);
  try {
    if (!person) throw new Error('Entra a tu cuenta antes de pagar.');
    const result = await call<{ url: string }>(path, body, key, person);
    if ((await auth?.getSession())?.data.session?.user.id !== person) throw new Error('Cambiaste de cuenta. Inténtalo otra vez.');
    const url = new URL(result.url);
    if (url.protocol !== 'https:') throw new Error('No pudimos abrir la página de pago.');
    if (tab) tab.location.replace(url.href);
    else await WebBrowser.openBrowserAsync(url.href);
    attempts.delete(identity);
  } catch (error) { tab?.close(); throw error; }
}
