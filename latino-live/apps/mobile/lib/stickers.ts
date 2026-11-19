import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

/** What travels between phones when two seats kiss. */
export type StickerBroadcast = {
  id: string;
  stickerId: string;
  senderName: string;
  fromSeat: number | null;
  toSeat: number | null;
};

/**
 * The room's live line. The couple signal rides here so both phones start the
 * kiss in the same instant instead of waiting for a database event. The name
 * stays the old one so phones still on an earlier version keep hearing it.
 */
function channelName(roomId: string) {
  return `room-stickers:${roomId}`;
}

/**
 * Every phone in the room listens on the room's own line. The channel rejoins
 * after a lost socket, growing the pause between tries so a phone without
 * signal does not hammer the server.
 */
export function useStickerChannel(roomId: string | null, onSignal: (signal: StickerBroadcast) => void) {
  const callback = useRef(onSignal);
  callback.current = onSignal;
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
      // A fixed name is what lets the sender reach every listener.
      live = client.channel(channelName(roomId), { config: { broadcast: { self: true } } });
      live.on('broadcast', { event: 'sticker' }, message => {
        const payload = message.payload as StickerBroadcast | undefined;
        if (payload?.id) callback.current(payload);
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

  return useCallback(async (payload: StickerBroadcast) => {
    const client = getSupabase();
    if (!client || !roomId) return;
    const live = channel.current;
    if (live && String(live.state) === 'joined') {
      try {
        await live.send({ type: 'broadcast', event: 'sticker', payload });
        return;
      } catch {
        // The room channel is down: a short-lived one still reaches the room.
      }
    }
    const temporary = client.channel(channelName(roomId), { config: { broadcast: { self: true } } });
    await new Promise<void>(resolve => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      temporary.subscribe(status => { if (status === 'SUBSCRIBED') done(); });
      setTimeout(done, 1500);
    });
    try { await temporary.send({ type: 'broadcast', event: 'sticker', payload }); } catch { /* lost */ }
    setTimeout(() => { void client.removeChannel(temporary); }, 2000);
  }, [roomId]);
}
