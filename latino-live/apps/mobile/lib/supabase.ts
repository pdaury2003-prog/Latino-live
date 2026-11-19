import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import { config } from './config';

let client: SupabaseClient | null = null;
export function getSupabase() {
  if (!config.backend || !config.anonKey) return null;
  return client ??= createClient(config.backend, config.anonKey, { auth: {
    storage: AsyncStorage, autoRefreshToken: true, persistSession: true,
    detectSessionInUrl: Platform.OS === 'web', flowType: 'pkce',
  } });
}
export function requireSupabase() {
  const value = getSupabase();
  if (!value) throw new Error('Tu cuenta no está disponible en este momento. Inténtalo más tarde.');
  return value;
}
export function authRedirect() {
  return Platform.OS === 'web' ? `${window.location.origin}/auth/callback`
    : config.scheme ? `${config.scheme}://auth/callback` : undefined;
}
