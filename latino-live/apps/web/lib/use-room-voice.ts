"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { createLiveAudio, unlockRoomAudio } from "@/lib/live-audio";
import { loadIceServers, type IceServer } from "@/lib/ice";
import type { LiveAudio, LiveSignal } from "@/lib/live-audio.types";
import { setSpeaking } from "@/lib/live";

export type VoiceStatus = "idle" | "requesting" | "live" | "error";

/**
 * Live room audio in the browser. Everyone in the room joins the same channel
 * as they arrive, so they hear the others without pressing anything, and the
 * microphone only opens when the person chooses to speak.
 */
export function useRoomVoice({
  roomId,
  userId,
  muted,
  onError,
}: {
  roomId: string | null;
  userId: string | undefined;
  muted: boolean;
  onError: (message: string) => void;
}) {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [connected, setConnected] = useState(false);
  const [micOn, setMicOn] = useState(false);
  // True once the project's relay answered: calls work between countries too.
  const [relay, setRelay] = useState(false);
  const [members, setMembers] = useState<string[]>([]);
  const audioRef = useRef<LiveAudio | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const micRef = useRef(false);
  micRef.current = micOn;
  const errorRef = useRef(onError);
  errorRef.current = onError;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  const teardown = useCallback(() => {
    audioRef.current?.stop();
    audioRef.current = null;
    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) void getSupabase()?.removeChannel(channel);
    setStatus("idle");
    setConnected(false);
    setMicOn(false);
    setMembers([]);
    if (roomId) void setSpeaking(roomId, false);
  }, [roomId]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !roomId || !userId) return;
    let open = true;
    // Every phone and browser must join the SAME channel, or nobody hears
    // anybody: a per-user name would put each person alone in a private room.
    const room = supabase.channel(`live:${roomId}`, {
      config: { broadcast: { self: false, ack: false }, presence: { key: userId } },
    });
    channelRef.current = room;

    room.on("broadcast", { event: "signal" }, message => {
      const signal = message.payload as LiveSignal;
      if (!signal?.kind) return;
      const to = "to" in signal ? signal.to : undefined;
      if (to && to !== userId) return;
      audioRef.current?.receive(signal);
    });

    room.on("presence", { event: "sync" }, () => {
      if (!open) return;
      const ids = Object.keys(room.presenceState());
      setMembers(ids);
      for (const id of ids) {
        if (id !== userId && userId < id) {
          void room.send({ type: "broadcast", event: "signal", payload: { kind: "join", from: userId, to: id } });
        }
      }
      setConnected(true);
    });

    // The relay arrives from the project's own server; calls fall back to a
    // direct path when it is not configured yet.
    void (async () => {
      // The list answers at once with the public relays; the project's own one
      // joins it as soon as its server replies, and is used first from then on.
      const pool = await loadIceServers(async () => {
        const { data } = await supabase.functions.invoke("turn-credentials", { body: {} });
        const reply = data as { iceServers?: IceServer[] } | null;
        return reply?.iceServers ?? null;
      });
      const iceServers = pool.servers;
      // The badge only claims the project's own relay when one really answered.
      setRelay(pool.dedicated);
      if (!open) return;
      const audio = createLiveAudio({
        selfId: userId,
        iceServers,
        onRemoteChange: () => undefined,
        onError: message => errorRef.current(message),
        onSignal: signal => {
          void room.send({ type: "broadcast", event: "signal", payload: signal });
        },
      });
      audioRef.current = audio;
      void audio.start().catch(() => undefined);
      room.subscribe(result => {
        if (!open) return;
        if (result === "SUBSCRIBED") {
          void room.track({ live: true, joinedAt: Date.now() }).catch(() => undefined);
          return;
        }
        if (result === "CHANNEL_ERROR" || result === "TIMED_OUT" || result === "CLOSED") {
          setConnected(false);
        }
      });
    })();

    return () => {
      open = false;
      teardown();
    };
  }, [roomId, userId, teardown]);

  // The host can silence this seat: the microphone is cut at once.
  useEffect(() => {
    if (!muted) return;
    audioRef.current?.setMicEnabled(false);
    setMicOn(false);
  }, [muted]);

  // A phone silences the page after a call, a locked screen or another app. One
  // touch brings every voice back, and so does returning to the tab.
  useEffect(() => {
    if (!roomId) return;
    const unlock = () => unlockRoomAudio();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        unlockRoomAudio();
        audioRef.current?.resume?.();
      }
    };
    const onOnline = () => audioRef.current?.resume?.();
    const once = { once: true, passive: true } as AddEventListenerOptions;
    window.addEventListener('pointerdown', unlock, once);
    window.addEventListener('keydown', unlock, once);
    window.addEventListener('touchend', unlock, once);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchend', unlock);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOnline);
    };
  }, [roomId]);

  const toggleMic = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || mutedRef.current) return false;
    unlockRoomAudio();
    if (micRef.current) {
      audio.setMicEnabled(false);
      setMicOn(false);
      if (roomId) void setSpeaking(roomId, false);
      return false;
    }
    setStatus("requesting");
    const ready = await audio.enableMic();
    if (!ready) {
      setStatus("error");
      errorRef.current("No pudimos abrir el micrófono. Revisa el permiso del navegador.");
      return false;
    }
    setMicOn(true);
    setStatus("live");
    if (roomId) void setSpeaking(roomId, true);
    return true;
  }, [roomId]);

  return { status, connected, micOn, relay, members, toggleMic };
}
