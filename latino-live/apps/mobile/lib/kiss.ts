import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
export { neighborSeat } from '@/lib/seat-neighbors';

/**
 * The kiss of two neighbours.
 *
 * A person asks the seat next to theirs; the request reaches only that seat,
 * and nothing happens until the person there says yes. Accepting makes the two
 * dragons walk to each other on every phone in the room. A request that is
 * never answered dies on its own, so nobody is left waiting behind a dialog.
 */

export type KissEvent = {
  /** One request, from the ask to its answer. */
  id: string;
  kind: 'ask' | 'accept' | 'decline' | 'gone';
  /** The seat the kiss comes from, and the one it goes to. */
  from: number;
  to: number;
  fromName: string;
  toName: string;
  at: number;
};

/** How long the neighbour has to answer. */
export const KISS_TIMEOUT = 15_000;

function channelName(roomId: string) {
  return `room-kiss:${roomId}`;
}

/**
 * The room's kiss line. It works like the stickers': a fixed channel every
 * phone in the room joins, which rejoins by itself when the socket drops.
 */
export function useKissChannel(roomId: string | null, onEvent: (event: KissEvent) => void) {
  const callback = useRef(onEvent);
  callback.current = onEvent;
  const channel = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client || !roomId) return;
    let open = true;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let live: RealtimeChannel | null = null;

    const start = () => {
      if (!open) return;
      if (live) {
        try { void client.removeChannel(live); } catch { /* already gone */ }
        live = null;
      }
      live = client.channel(channelName(roomId));
      live.on('broadcast', { event: 'kiss' }, message => {
        const payload = message.payload as KissEvent | undefined;
        if (payload?.id && payload.kind) callback.current(payload);
      });
      channel.current = live;
      live.subscribe(status => {
        if (!open) return;
        if (status === 'SUBSCRIBED') { attempt = 0; return; }
        if (status !== 'CHANNEL_ERROR' && status !== 'TIMED_OUT' && status !== 'CLOSED') return;
        if (retry) return;
        const wait = Math.min(8000, 700 * 2 ** attempt);
        attempt += 1;
        retry = setTimeout(() => { retry = null; start(); }, wait);
      });
    };

    start();
    const activity = AppState.addEventListener('change', state => {
      if (state !== 'active' || !open) return;
      if (!live || String(live.state) !== 'joined') start();
    });

    return () => {
      open = false;
      activity.remove();
      if (retry) clearTimeout(retry);
      channel.current = null;
      if (live) void client.removeChannel(live);
    };
  }, [roomId]);

  return useCallback(async (event: KissEvent) => {
    const client = getSupabase();
    if (!client || !roomId) return;
    const live = channel.current;
    if (live && String(live.state) === 'joined') {
      try {
        await live.send({ type: 'broadcast', event: 'kiss', payload: event });
        return;
      } catch {
        // The room channel is down: a short-lived one still reaches the room.
      }
    }
    const temporary = client.channel(channelName(roomId));
    await new Promise<void>(resolve => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      temporary.subscribe(status => { if (status === 'SUBSCRIBED') done(); });
      setTimeout(done, 1500);
    });
    try { await temporary.send({ type: 'broadcast', event: 'kiss', payload: event }); } catch { /* lost */ }
    setTimeout(() => { void client.removeChannel(temporary); }, 2000);
  }, [roomId]);
}

