import { AppState } from 'react-native';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

/**
 * Keeps one realtime channel alive for as long as a screen needs it.
 *
 * A phone that sleeps, walks into an elevator or changes from WiFi to mobile
 * data loses its socket. The client reconnects on its own most of the time,
 * but a channel that ends in error would stay dead forever, and every event
 * that crossed the gap would be missed. This helper rejoins with a growing
 * pause, and refreshes the screen once each time it comes back, so nothing
 * stays out of date.
 */
export function keepLiveChannel(
  client: SupabaseClient,
  name: string,
  build: (channel: RealtimeChannel) => RealtimeChannel,
  refresh?: () => void,
) {
  let channel: RealtimeChannel | null = null;
  let open = true;
  let attempt = 0;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let first = true;

  const schedule = () => {
    if (!open || retry) return;
    const wait = Math.min(15_000, 700 * 2 ** attempt);
    attempt += 1;
    retry = setTimeout(() => {
      retry = null;
      if (open) start();
    }, wait);
  };

  const start = () => {
    if (!open) return;
    if (channel) {
      try { void client.removeChannel(channel); } catch { /* already gone */ }
      channel = null;
    }
    channel = build(client.channel(`${name}:${Math.random().toString(36).slice(2)}`));
    channel.subscribe(status => {
      if (!open) return;
      if (status === 'SUBSCRIBED') {
        attempt = 0;
        // Anything written while the socket was down is read once now.
        if (!first) refresh?.();
        first = false;
        return;
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') schedule();
    });
  };

  start();

  const activity = AppState.addEventListener('change', state => {
    if (state !== 'active' || !open) return;
    refresh?.();
    if (!channel || String(channel.state) !== 'joined') schedule();
  });

  return () => {
    open = false;
    activity.remove();
    if (retry) clearTimeout(retry);
    if (channel) void client.removeChannel(channel);
  };
}
