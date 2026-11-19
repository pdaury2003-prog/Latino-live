"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Copy, Crown, Diamond, Gift, Lock, MessageCircle, Mic, MicOff, Plus, Search, Send, Share2, Shield, X } from "lucide-react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useAuth } from "@/lib/auth-context";
import { getSupabase } from "@/lib/supabase";
import {
  GIFTS,
  MAX_MESSAGES,
  findRoom,
  getGifts,
  getMessages,
  getProfile,
  getRoomCode,
  getSeats,
  getSeatLocks,
  leaveSeat,
  listProfiles,
  postMessage,
  roomCodeMatches,
  searchPeople,
  sendGift,
  inviteToRoom,
  setRoomPrivate,
  setSeatLock,
  takeSeat,
  type GiftRow,
  type MessageRow,
  type ProfileRow,
  type RoomRow,
  type SeatRow,
} from "@/lib/live";
import { STICKERS, STICKER_GROUPS, clipForSticker, type Sticker, type StickerGroup, type StickerSignal } from "@/lib/stickers";
import { StickerActor } from "@/components/live/sticker-actor";
import { DragonEmotes, type DragonHandle } from "@/components/live/dragon-emotes";
import { RoomStage } from "@/components/live/room-stage";
import { ANDROID_APP_URL } from "@/lib/app-install";
import { DRAGON_CLIPS } from "@/lib/dragon-stage";
import { useRoomVoice } from "@/lib/use-room-voice";
import { cn } from "@/lib/utils";

/**
 * A request that never answers would leave the room stuck on "Entrando…"
 * forever, which on a weak phone network looks exactly like a broken app.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * The room on the web: seats, chat, gifts, stickers and live voice, all from
 * the same tables the phone app writes, so both kinds of device share a room.
 */
export function RoomView({ id, code }: { id: string; code?: string }) {
  const { user } = useAuth();
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [gifts, setGifts] = useState<GiftRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Whether the room is missing or the phone failed to reach the project:
  // "no existe" needs no retry advice, a dropped connection does.
  const [errorKind, setErrorKind] = useState<"missing" | "network" | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // The people of the app this room can invite.
  const [peopleQuery, setPeopleQuery] = useState("");
  const [people, setPeople] = useState<ProfileRow[]>([]);
  const [peopleBusy, setPeopleBusy] = useState(false);
  const [inviting, setInviting] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState(false);
  const [giftBusy, setGiftBusy] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [panelGroup, setPanelGroup] = useState<StickerGroup | "dragon">("saludos");
  // The host's private room and its closed seats.
  const [seatLocks, setSeatLocks] = useState<number[]>([]);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [hostOpen, setHostOpen] = useState(false);
  const [privateBusy, setPrivateBusy] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [gateCode, setGateCode] = useState("");
  const [gateBusy, setGateBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const unlocked = useRef(false);
  // A code that came with an invitation is tried once, on its own.
  const codeTried = useRef(false);
  const seatRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const seenFlights = useRef<Set<string>>(new Set());
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const stickerChannel = useRef<RealtimeChannel | null>(null);
  // The 3D dragon stands on the seats; this is how a sticker reaches it.
  const dragon = useRef<DragonHandle | null>(null);
  const loadedRoom = useRef<RoomRow | null>(null);

  const roomId = room?.id ?? null;
  const me = seats.find(seat => seat.user_id === user?.id) ?? null;
  const isHost = Boolean(user?.id && room?.host_id === user.id);

  const flash = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  const voice = useRoomVoice({
    roomId,
    userId: user?.id,
    muted: Boolean(me?.muted),
    onError: message => flash(message),
  });

  const loadRoom = useCallback(async () => {
    // Without the project's connection there is nothing to show: saying so is
    // better than announcing that the room disappeared.
    if (!getSupabase()) {
      setError("No pudimos conectar. Revisa tu conexión e inténtalo otra vez.");
      setErrorKind("network");
      setLoading(false);
      return;
    }
    try {
      const found = await withTimeout(findRoom(id), 12000);
      if (!found) {
        setError("Esta sala ya no existe.");
        setErrorKind("missing");
        setRoom(null);
        loadedRoom.current = null;
        return;
      }
      setRoom(found);
      loadedRoom.current = found;
      setError(null);
      setErrorKind(null);
      // A private room shows its code screen and nothing else.
      if (Boolean(found.is_private) && found.host_id !== user?.id && !unlocked.current) {
        setGateOpen(true);
        return;
      }
      setGateOpen(false);
      // Each part arrives on its own: one slow list must not hide the room.
      const [nextSeats, nextMessages, nextGifts, nextLocks] = await Promise.allSettled([
        withTimeout(getSeats(found.id), 12000),
        withTimeout(getMessages(found.id), 12000),
        withTimeout(getGifts(found.id), 12000),
        withTimeout(getSeatLocks(found.id), 10000),
      ]);
      if (nextSeats.status === "fulfilled") setSeats(nextSeats.value);
      if (nextMessages.status === "fulfilled") setMessages(nextMessages.value);
      if (nextGifts.status === "fulfilled") setGifts(nextGifts.value);
      if (nextLocks.status === "fulfilled") setSeatLocks(nextLocks.value);
      if (found.host_id === user?.id) {
        getRoomCode(found.id).then(code => { if (code) setJoinCode(code); }).catch(() => undefined);
      }

      const seated = nextSeats.status === "fulfilled" ? nextSeats.value : [];
      if (seated.length) {
        try {
          const rows = await withTimeout(listProfiles(seated.map(seat => seat.user_id)), 10000);
          setProfiles(Object.fromEntries(rows.map(row => [row.id, row])));
        } catch {
          // Names fall back to the seat's own copy; the room stays open.
        }
      }
      if (nextSeats.status === "rejected" && nextMessages.status === "rejected" && nextGifts.status === "rejected") {
        flash("La sala abrió, pero no cargaron los asientos ni el chat. Toca Reintentar.");
      }
    } catch {
      // A refresh that fails keeps the room already on screen.
      if (loadedRoom.current) flash("No pudimos actualizar la sala. Revisa tu conexión.");
      else {
        setError("No pudimos abrir la sala. Revisa tu conexión.");
        setErrorKind("network");
      }
    } finally {
      setLoading(false);
    }
  }, [id, flash, user?.id]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    void getProfile(user.id).then(setProfile).catch(() => undefined);
  }, [user?.id]);

  // The room's live lines: seats, chat, gifts and the room itself.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !roomId) return;
    const channel = supabase.channel(`room-web:${roomId}:${Math.random().toString(36).slice(2)}`);
    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seats", filter: `room_id=eq.${roomId}` }, () => {
        void getSeats(roomId).then(setSeats).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` }, () => {
        void getMessages(roomId).then(setMessages).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_gifts", filter: `room_id=eq.${roomId}` }, () => {
        void getGifts(roomId).then(setGifts).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "room_seat_locks", filter: `room_id=eq.${roomId}` }, () => {
        void getSeatLocks(roomId).then(setSeatLocks).catch(() => undefined);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` }, () => {
        void loadRoom();
      });
    channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [roomId, loadRoom]);

  /** Where a seat is on the page, or the middle of the seats without one. */
  const spotFor = useCallback((seatNo: number | null) => {
    if (seatNo && seatRefs.current[seatNo]) {
      const box = seatRefs.current[seatNo]!.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }
    return { x: window.innerWidth / 2, y: window.innerHeight * 0.36 };
  }, []);

  const play = useCallback((signal: StickerSignal) => {
    if (!signal?.id || seenFlights.current.has(signal.id)) return;
    seenFlights.current.add(signal.id);
    if (seenFlights.current.size > 80) seenFlights.current = new Set([...seenFlights.current].slice(-40));
    // The dragon's animations are not pictures in flight: the model acts on
    // the seat itself, so the room only has to tell it which one to play.
    if (signal.stickerId.startsWith("dragon:")) {
      dragon.current?.play(signal.toSeat, signal.stickerId.slice("dragon:".length));
      return;
    }
    if (signal.stickerId.startsWith("dragon-pair:")) {
      const [left, right] = signal.stickerId.slice("dragon-pair:".length).split(":").map(Number);
      if (left && right) dragon.current?.pair(left, right);
      return;
    }
    // An emotion belongs to the person who sent it: the dragon acts on their
    // own seat, with no picture in flight and no round sticker.
    const seat = signal.fromSeat ?? signal.toSeat;
    if (seat) dragon.current?.play(seat, clipForSticker(signal.stickerId));
  }, [spotFor]);

  // Stickers travel on their own broadcast line, so they arrive instantly.
  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !roomId) return;
    const channel = supabase.channel(`room-stickers:${roomId}`, { config: { broadcast: { self: false } } });
    channel.on("broadcast", { event: "sticker" }, message => play(message.payload as StickerSignal));
    stickerChannel.current = channel;
    channel.subscribe();
    return () => {
      stickerChannel.current = null;
      void supabase.removeChannel(channel);
    };
  }, [roomId, play]);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function chooseSeat(seat: SeatRow | undefined, seatNo: number) {
    if (!room) return;
    if (seatLocks.includes(seatNo)) {
      flash(isHost ? "Ese asiento tiene candado. Ábrelo en los controles del anfitrión." : "El anfitrión cerró ese asiento.");
      return;
    }
    if (!user) { flash("Entra a tu cuenta para sentarte."); return; }
    try {
      if (me) await leaveSeat(room.id);
      if (!seat || seat.user_id !== user.id) await takeSeat(room.id, seatNo);
      await loadRoom();
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : "No pudimos moverte de asiento.");
    }
  }

  /** Checks the words of a private room before its seats are shown. */
  async function unlockRoom(words?: string) {
    if (!room || gateBusy) return;
    const code = (words ?? gateCode).trim();
    if (!code) return;
    setGateBusy(true);
    setGateError(null);
    try {
      if (!(await roomCodeMatches(room.id, code))) {
        setGateError("Ese código no abre esta sala. Pídeselo al anfitrión.");
        return;
      }
      unlocked.current = true;
      setGateOpen(false);
      setGateCode("");
      setLoading(true);
      await loadRoom();
    } catch {
      setGateError("No pudimos comprobar el código. Revisa tu conexión.");
    } finally {
      setGateBusy(false);
    }
  }

  // The invitation carries the code of a private room: the door opens itself.
  useEffect(() => {
    if (!gateOpen || !room || !code) return;
    if (codeTried.current) return;
    codeTried.current = true;
    setGateCode(code);
    void unlockRoom(code);
  }, [gateOpen, code, room]);

  /** The host opens or closes the room, and gets the code to share. */
  async function updatePrivate(next: boolean) {
    if (!room || privateBusy) return;
    setPrivateBusy(true);
    try {
      const code = await setRoomPrivate(room.id, next);
      setJoinCode(code);
      setRoom(current => (current ? { ...current, is_private: next } : current));
      flash(next ? `Sala privada. Código ${code}` : "La sala vuelve a ser pública.");
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : "No pudimos cambiar la privacidad.");
    } finally {
      setPrivateBusy(false);
    }
  }

  /** Puts a padlock on one seat, or takes it off. */
  async function toggleLock(no: number) {
    if (!room) return;
    const locked = seatLocks.includes(no);
    setSeatLocks(current => (locked ? current.filter(item => item !== no) : [...current, no].sort((a, b) => a - b)));
    if (!locked) setSeats(current => current.filter(seat => seat.seat_no !== no));
    try {
      await setSeatLock(room.id, no, !locked);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : "No pudimos cambiar el candado.");
      void getSeatLocks(room.id).then(setSeatLocks).catch(() => undefined);
      void loadRoom();
    }
  }

  async function copyJoinCode() {
    if (!joinCode) return;
    try {
      await navigator.clipboard.writeText(joinCode);
      flash("Código copiado. Pégalo en tu chat.");
    } catch {
      flash(`Código de la sala: ${joinCode}`);
    }
  }

  // The search waits for the person to stop typing.
  useEffect(() => {
    const text = peopleQuery.trim();
    if (text.length < 2) {
      setPeople([]);
      setPeopleBusy(false);
      return;
    }
    let alive = true;
    setPeopleBusy(true);
    const timer = setTimeout(() => {
      void searchPeople(text, user?.id).then(rows => {
        if (!alive) return;
        setPeople(rows);
        setPeopleBusy(false);
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [peopleQuery, user?.id]);

  async function invitePerson(person: ProfileRow) {
    if (!room || inviting) return;
    setInviting(person.id);
    try {
      await inviteToRoom(room.id, person.id);
      setInvited(current => ({ ...current, [person.id]: true }));
      flash(`${person.display_name} recibió tu invitación`);
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : "No pudimos invitar");
    } finally {
      setInviting(null);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || !room || !user || sending) return;
    setSending(true);
    setDraft("");
    try {
      await postMessage(room.id, text);
      setMessages(await getMessages(room.id));
    } catch {
      setDraft(text);
      flash("No pudimos enviar tu mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function give(giftKey: string) {
    if (!room || !user || giftBusy) return;
    setGiftBusy(true);
    try {
      const balance = await sendGift(room.id, giftKey);
      setProfile(current => (current ? { ...current, diamonds: balance } : current));
      setGiftOpen(false);
      flash("Tu regalo apareció en el chat de la sala.");
    } catch (cause) {
      flash(cause instanceof Error ? cause.message : "No pudimos enviar el regalo.");
    } finally {
      setGiftBusy(false);
    }
  }

  async function throwSticker(sticker: Sticker) {
    if (!room || !user) return;
    if (!me?.seat_no) {
      flash("Siéntate en un asiento para mandar una emoción.");
      return;
    }
    const signal: StickerSignal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stickerId: sticker.id,
      senderName: profile?.display_name ?? user.email?.split("@")[0] ?? "Alguien",
      // The sender's own seat: the emotion is theirs, wherever they sit.
      fromSeat: me.seat_no,
      toSeat: me.seat_no,
    };
    setStickerOpen(false);
    play(signal);
    try {
      await stickerChannel.current?.send({ type: "broadcast", event: "sticker", payload: signal });
    } catch {
      // The room keeps its own copy; the next one reaches the others.
    }
  }

  /** The dragon acts a real 3D animation on the chosen seat. */
  async function throwDragon(clip: string) {
    if (!room || !user) return;
    if (!me?.seat_no) {
      flash("Siéntate en un asiento para mandar una emoción.");
      return;
    }
    const signal: StickerSignal = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      stickerId: `dragon:${clip}`,
      senderName: profile?.display_name ?? user.email?.split("@")[0] ?? "Alguien",
      fromSeat: me.seat_no,
      toSeat: me.seat_no,
    };
    setStickerOpen(false);
    play(signal);
    try {
      await stickerChannel.current?.send({ type: "broadcast", event: "sticker", payload: signal });
    } catch {
      // Only this phone sees it; the room catches the next one.
    }
  }

  /** The two dragons walk to each other and kiss on the chosen seats. */


  const capacity = room?.max_seats ?? 10;
  const seatGrid = useMemo(
    // Every place is the same place: the host's chair is one more in the grid.
    () => Array.from({ length: capacity }, (_, index) => {
      const no = index + 1;
      return { no, seat: seats.find(item => item.seat_no === no) };
    }),
    [capacity, seats],
  );

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div className="space-y-2">
          <div className="mx-auto size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">Entrando a la sala…</p>
        </div>
      </div>
    );
  }
  if (error || !room) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6 text-center">
        <div>
          <p className="text-base font-semibold text-foreground">{error ?? "Sala no encontrada"}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {errorKind === "missing"
              ? "Quien la creó pudo cerrarla. Mira las demás salas abiertas."
              : "Si estás en una calle o con datos móviles, espera un momento y vuelve a intentarlo."}
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            {errorKind === "network" ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setLoading(true);
                  void loadRoom();
                }}
                className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground active:opacity-85"
              >
                Reintentar
              </button>
            ) : null}
            <Link href="/" className="rounded-full border border-border px-5 py-2 text-sm font-semibold text-foreground">
              Ver las salas
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // A private room shows its code screen and nothing else until it is right.
  if (gateOpen) {
    return (
      <div className="mx-auto flex min-h-[100svh] w-full max-w-[480px] flex-col justify-center px-6">
        <div className="rounded-3xl border border-border bg-card px-6 py-8 text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary/15">
            <Lock className="size-6 text-primary" />
          </span>
          <p className="mt-3 text-lg font-semibold text-foreground">Sala privada</p>
          <p className="mt-1 text-[12px] text-muted-foreground">«{room.title}» de {room.host_name} se abre con su código.</p>
          <input
            value={gateCode}
            onChange={event => setGateCode(event.target.value.toUpperCase())}
            onKeyDown={event => { if (event.key === "Enter") void unlockRoom(); }}
            maxLength={12}
            autoFocus
            autoComplete="off"
            aria-label="Código de la sala privada"
            placeholder="Código de la sala"
            className="mt-4 w-full rounded-xl border border-border bg-background px-3 py-3 text-center text-[16px] font-semibold tracking-[0.28em] text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/50"
          />
          {gateError ? <p role="alert" className="mt-2 text-[12px] text-destructive">{gateError}</p> : null}
          <button
            type="button"
            onClick={() => void unlockRoom()}
            disabled={gateBusy || !gateCode.trim()}
            className={cn(
              "mt-3 h-11 w-full rounded-full text-sm font-semibold",
              gateBusy || !gateCode.trim() ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground active:opacity-85",
            )}
          >
            {gateBusy ? "Comprobando…" : "Entrar"}
          </button>
          <Link href="/" className="mt-2 inline-flex h-10 items-center px-4 text-[12px] text-muted-foreground">
            Volver a las salas
          </Link>
        </div>
      </div>
    );
  }

  // Built from the address the person is on, so an invitation always lands in
  // this very room and not on a stale link kept from another device.
  const roomLink = typeof window === "undefined" || !room ? "" : `${window.location.origin}/room/${room.slug}`;
  // An invitation carries the app when there is one, so the person who opens it
  // installs Latino Live instead of staying in a browser tab.
  const appText = ANDROID_APP_URL ? ` Descarga la app: ${ANDROID_APP_URL}` : "";
  const inviteText = room ? `Estoy en «${room.title}» de ${room.host_name} en Latino Live. Entra, ocupa un asiento y habla en vivo:${appText}` : "";

  async function copyInvite() {
    if (!roomLink) return;
    try {
      await navigator.clipboard.writeText(`${inviteText} ${roomLink}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      flash("No pudimos copiar el enlace. Mantén pulsado para copiarlo.");
    }
  }

  async function shareInvite() {
    if (!roomLink) return;
    try {
      if (navigator.share) await navigator.share({ title: room?.title, text: inviteText, url: roomLink });
      else await copyInvite();
    } catch {
      // The person closed the share sheet.
    }
  }

  return (
    <div className="relative mx-auto flex h-[100svh] w-full max-w-[480px] flex-col overflow-hidden bg-[#070A1A]">
      <RoomStage />

      <header className="relative z-30 flex items-start gap-2 px-3 pt-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-[14px] bg-[rgba(16,18,28,0.78)] px-2 py-1.5 backdrop-blur">
          <span className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-[linear-gradient(135deg,#6D28D9,#2A1050)] text-[17px] font-black italic text-[#E9D5FF]">
            V
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-white">{room.title}</span>
            <span className="block truncate text-[11px] text-white/55">
              {room.host_name} · {seats.length}/{room.max_seats} asientos{room.is_private ? " · privada" : ""}
            </span>
          </span>
        </div>
        {isHost ? (
          <button
            type="button"
            aria-label="Controles del anfitrión"
            onClick={() => setHostOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur"
          >
            <Shield className="size-4" />
          </button>
        ) : null}
        <button
          type="button"
          aria-label="Invitar amigos a la sala"
          onClick={() => setInviteOpen(true)}
          className="grid size-9 shrink-0 place-items-center rounded-full bg-[#6D28D9] text-white"
        >
          <Share2 className="size-4" />
        </button>
        <Link href="/" aria-label="Salir de la sala" className="grid size-9 shrink-0 place-items-center rounded-full bg-white/10 text-white backdrop-blur">
          <X className="size-4" />
        </Link>
      </header>

      <div className="relative z-10 grid grid-cols-5 gap-x-1 px-3 pt-3">
        {seatGrid.map(({ no, seat }) => {
          const mine = seat?.user_id === user?.id;
          const speaking = Boolean(seat?.speaking && !seat.muted);
          const avatar = seat ? profiles[seat.user_id]?.avatar_url ?? seat.avatar_url : null;
          const locked = seatLocks.includes(no);
          return (
            <div
              key={no}
              className="flex flex-col items-center"
            >
              {/* The circle is the button: one tap on the seat, its label read
                  by a screen reader, and the name below stays plain text. */}
              <button
                ref={node => { seatRefs.current[no] = node; }}
                type="button"
                aria-label={seat ? `${seat.display_name}, asiento ${no}` : locked ? `Asiento ${no} cerrado con candado por el anfitrión` : `Asiento libre número ${no}, toca para sentarte`}
                onClick={() => void chooseSeat(seat, no)}
                className={cn(
                  // The portrait fills the circle inside its own gold rim; a
                  // free seat wears the house dragon, drawn whole.
                  "relative grid aspect-square w-full place-items-center overflow-hidden rounded-full",
                  locked
                    ? "bg-[linear-gradient(150deg,#2A2D35_0%,#171A21_100%)] ring-2 ring-[rgba(190,196,208,0.55)] ring-inset"
                    : "bg-[#0F1520] shadow-[0_0_12px_rgba(247,222,158,0.4)]",
                  speaking && !locked && "shadow-[0_0_18px_3px_rgba(247,222,158,0.7)]",
                  mine && !speaking && !locked && "shadow-[0_0_14px_rgba(247,222,158,0.5)]",
                )}
              >
                {seat ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatar ?? "/rooms/seat-dragon.png"}
                    alt={seat.display_name}
                    className={avatar ? "h-full w-full object-cover" : "h-full w-full object-contain"}
                  />
                ) : locked ? (
                  <span className="grid h-full w-full place-items-center bg-[linear-gradient(150deg,#2B2E36,#1C1F25)]">
                    <Lock className="size-[30%] min-h-3 text-[#E8C27E]" />
                  </span>
                ) : (
                  // The portrait carries its own gold ring; it is fitted whole
                  // and kept dark, and a plus says the place can be taken.
                  <span className="relative grid h-full w-full place-items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/rooms/seat-dragon.png" alt="" className="absolute inset-0 h-full w-full object-contain" />
                    <span className="absolute inset-0 bg-[rgba(4,7,14,0.62)]" />
                    <span className="relative grid size-[42%] place-items-center rounded-full border border-[#F3D58C]/75 bg-[rgba(10,14,24,0.55)]">
                      <Plus className="size-[62%] text-[#F3D58C]" strokeWidth={2.4} />
                    </span>
                  </span>
                )}
                {/* The crown follows the host, wherever they sit. */}
                {seat && seat.user_id === room.host_id ? (
                  <span className="absolute -top-0.5 left-1/2 grid size-4 -translate-x-1/2 place-items-center rounded-full bg-[#E8C27E]">
                    <Crown className="size-2.5 text-[#2A1B46]" />
                  </span>
                ) : null}
              </button>
              <span className={cn("mt-0.5 w-full truncate text-center text-[11px] font-semibold tabular-nums", seat ? "text-white/75" : "text-white/60")}>
                {seat ? seat.display_name : no}
              </span>
            </div>
          );
        })}
      </div>

      {room.announcement ? (
        <div className="relative z-10 mx-5 mt-2 rounded-[12px] bg-[rgba(6,8,14,0.72)] px-4 py-2.5">
          <p className="line-clamp-3 text-center text-[13px] leading-5 text-[#E9C46A]">{room.announcement}</p>
        </div>
      ) : null}

      <section className="relative z-10 mx-3 mt-2 flex min-h-0 flex-1 flex-col rounded-t-[20px] bg-[rgba(3,7,9,0.72)] px-3 py-2 backdrop-blur-sm">
        <div className="mb-1 flex items-center gap-2 text-[11px] text-white/50">
          <span className="text-sm font-semibold text-white">Chat de la sala</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5">{messages.length}/{MAX_MESSAGES}</span>
          <span className="ml-auto">{seats.length} en asientos</span>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.length === 0 ? (
            <p className="px-1 py-2 text-[12px] text-white/50">Sé la primera persona en escribir en esta sala.</p>
          ) : null}
          {messages.map(message => {
            if (message.kind === "system" || message.kind === "welcome") {
              return (
                <p key={message.id} className="flex items-start gap-1.5 text-[11px] text-white/50">
                  <span aria-hidden>✦</span>
                  <span className="flex-1">{message.body}</span>
                </p>
              );
            }
            if (message.kind === "gift") {
              return (
                <p key={message.id} className="flex items-center gap-2 rounded-xl border border-[#E8C27E]/40 bg-[#E8C27E]/10 px-2.5 py-1.5 text-[12px] text-white">
                  <Gift className="size-3.5 text-[#E8C27E]" />
                  {message.body}
                </p>
              );
            }
            if (message.kind === "announcement") {
              return (
                <p key={message.id} className="rounded-xl border border-[#E8C27E]/30 bg-[#E8C27E]/10 px-2.5 py-1.5 text-[12px] text-white">
                  <span className="mr-1 text-[11px] font-semibold text-[#E8C27E]">ANUNCIO</span>
                  {message.body}
                </p>
              );
            }
            const isMine = message.user_id === user?.id;
            return (
              <div key={message.id} className={cn("flex max-w-[85%] flex-col gap-0.5", isMine && "ml-auto items-end")}>
                <span className="px-1 text-[11px] text-white/50">{isMine ? "Tú" : message.author}</span>
                <p className={cn(
                  "rounded-2xl px-3 py-1.5 text-[13px] leading-5",
                  isMine ? "rounded-tr-md bg-[#E8C27E] text-[#2A1B46]" : "rounded-tl-md bg-white/10 text-white",
                )}>
                  {message.body}
                </p>
              </div>
            );
          })}
          <div ref={chatEnd} />
        </div>
        {gifts[0] ? (
          <p className="mt-1 truncate px-1 text-[11px] text-white/45">
            Último regalo: {gifts[0].sender_name} envió {GIFTS.find(gift => gift.key === gifts[0].gift_key)?.name ?? gifts[0].gift_key}
          </p>
        ) : null}
      </section>

      <div className="sticky bottom-0 z-30 mt-2 flex items-center gap-2 border-t border-white/10 bg-[rgba(6,8,14,0.94)] px-3 py-2 backdrop-blur">
        <button
          type="button"
          aria-label={me?.muted ? "Micrófono bloqueado por el anfitrión" : voice.micOn ? "Apagar el micrófono" : "Hablar en la sala"}
          disabled={!user || Boolean(me?.muted) || voice.status === "requesting"}
          onClick={() => { if (!user) { flash("Entra a tu cuenta para hablar."); return; } void voice.toggleMic(); }}
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            voice.micOn ? "bg-[#E24B3E] text-white" : me?.muted ? "bg-white/10 text-white/40" : "bg-[#E8C27E] text-[#2A1B46]",
          )}
        >
          {me?.muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}
        </button>
        <form
          className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-white/10 bg-white/[0.07] px-3"
          onSubmit={event => { event.preventDefault(); void send(); }}
        >
          <input
            value={draft}
            onChange={event => setDraft(event.target.value)}
            placeholder={user ? "Di algo…" : "Entra para escribir…"}
            maxLength={400}
            aria-label="Escribir un mensaje para la sala"
            className="w-0 min-w-0 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/40"
          />
          <button type="submit" aria-label="Enviar mensaje" disabled={!draft.trim() || sending} className="ml-1">
            <Send className={cn("size-4", draft.trim() ? "text-[#E8C27E]" : "text-white/35")} />
          </button>
        </form>
        <button
          type="button"
          aria-label="Enviar un regalo"
          onClick={() => { if (!user) { flash("Entra a tu cuenta para enviar regalos."); return; } setGiftOpen(true); }}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-[#E8C27E]/45 bg-[#E8C27E]/15"
        >
          <Gift className="size-5 text-[#E8C27E]" />
        </button>
        <button
          type="button"
          aria-label="Abrir las pegatinas"
          onClick={() => { if (!user) { flash("Entra a tu cuenta para enviar pegatinas."); return; } setStickerOpen(true); }}
          className="grid size-11 shrink-0 place-items-center rounded-full border border-white/12 bg-white/[0.07]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/dragon.png" alt="" className="size-7 object-contain" />
        </button>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full border border-primary/40 bg-card px-4 py-2 text-xs text-foreground shadow-lg">
          {toast}
        </div>
      ) : null}

      {hostOpen ? (
        <Sheet onClose={() => setHostOpen(false)} title="Controles del anfitrión">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Sala privada</span>
              {room.is_private ? (
                <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Privada</span>
              ) : null}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {room.is_private
                ? "Solo entra quien tenga el código, y la sala deja de aparecer en la cartelera."
                : "Con la sala privada solo entra quien tenga el código y deja de aparecer en la cartelera."}
            </p>
            {room.is_private ? (
              <>
                <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
                  <span className="flex-1 text-center text-[18px] font-bold tracking-[0.3em] text-foreground">{joinCode ?? "······"}</span>
                  <button
                    type="button"
                    onClick={() => void copyJoinCode()}
                    disabled={!joinCode}
                    aria-label="Copiar el código de la sala"
                    className="grid size-9 place-items-center rounded-full border border-primary/40 bg-primary/10 disabled:opacity-40"
                  >
                    <Copy className="size-4 text-primary" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={privateBusy}
                  onClick={() => void updatePrivate(false)}
                  className="mt-2 h-10 w-full rounded-full border border-border text-[13px] font-semibold text-foreground active:opacity-80"
                >
                  {privateBusy ? "Cambiando…" : "Hacer pública"}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={privateBusy}
                onClick={() => void updatePrivate(true)}
                className="mt-2 h-10 w-full rounded-full border border-primary/50 bg-primary/10 text-[13px] font-semibold text-primary active:opacity-85"
              >
                {privateBusy ? "Cambiando…" : "Hacer privada"}
              </button>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Candados por asiento</span>
              <span className="ml-auto text-[11px] text-muted-foreground">{seatLocks.length} cerrados</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Toca un número para cerrarlo o abrirlo. Un asiento cerrado nadie lo puede ocupar.
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {Array.from({ length: room.max_seats }, (_, index) => {
                const no = index + 1;
                const locked = seatLocks.includes(no);
                const taken = seats.some(seat => seat.seat_no === no);
                return (
                  <button
                    key={no}
                    type="button"
                    aria-pressed={locked}
                    aria-label={locked ? `Abrir el asiento ${no}` : `Cerrar con candado el asiento ${no}`}
                    onClick={() => void toggleLock(no)}
                    className={cn(
                      "flex h-9 min-w-9 items-center justify-center gap-0.5 rounded-lg border px-2 text-[12px] font-semibold tabular-nums active:opacity-80",
                      locked ? "border-destructive/60 bg-destructive/15 text-destructive" : taken ? "border-border bg-card text-primary" : "border-border bg-card text-foreground",
                    )}
                  >
                    {locked ? <Lock className="size-3" /> : null}
                    {no}
                  </button>
                );
              })}
            </div>
          </div>
        </Sheet>
      ) : null}

      {inviteOpen ? (
        <Sheet onClose={() => setInviteOpen(false)} title="Invita a tus amigos">
          <p className="text-[12px] text-muted-foreground">
            Invita a alguien que ya tenga cuenta en Latino Live: le llega la invitación y entra con un toque.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              value={peopleQuery}
              onChange={event => setPeopleQuery(event.target.value)}
              placeholder="Nombre de la persona"
              aria-label="Buscar a una persona para invitar"
              className="h-11 min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            {peopleBusy ? <span className="text-[11px] text-muted-foreground">Buscando…</span> : null}
          </div>
          {people.length > 0 ? (
            <div className="mt-2 grid gap-1.5">
              {people.map(person => (
                <div key={person.id} className="flex items-center gap-2 rounded-xl border border-border bg-background px-2.5 py-2">
                  {person.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={person.avatar_url} alt={person.display_name} className="size-8 rounded-full object-cover" />
                  ) : (
                    <span className="grid size-8 place-items-center rounded-full bg-muted text-[12px] font-semibold text-foreground">
                      {person.display_name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{person.display_name}</span>
                    {person.user_number ? <span className="block text-[11px] text-muted-foreground">N.º {person.user_number}</span> : null}
                  </span>
                  <button
                    type="button"
                    disabled={inviting === person.id || (invited[person.id] && !isHost)}
                    onClick={() => void invitePerson(person)}
                    className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5 text-[12px] font-semibold text-primary active:opacity-80 disabled:opacity-60"
                  >
                    {invited[person.id] ? "Invitada" : inviting === person.id ? "…" : "Invitar"}
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {peopleQuery.trim().length >= 2 && !peopleBusy && people.length === 0 ? (
            <p className="mt-2 text-[12px] text-muted-foreground">Nadie con ese nombre tiene cuenta en la app.</p>
          ) : null}
          <p className="mt-4 text-[12px] font-semibold text-foreground">O comparte el enlace</p>
          <p className="text-[12px] text-muted-foreground">
            Comparte este enlace. Quien lo abra entra directo a la sala, ocupa un asiento y puede hablar.
          </p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{roomLink}</span>
            <button
              type="button"
              onClick={() => void copyInvite()}
              aria-label="Copiar el enlace de la sala"
              className="flex shrink-0 items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground active:opacity-80"
            >
              {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`${inviteText} ${roomLink}`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#25D366] text-[13px] font-semibold text-white active:opacity-85"
            >
              <MessageCircle className="size-4" />
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(roomLink)}&text=${encodeURIComponent(inviteText)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#2AABEE] text-[13px] font-semibold text-white active:opacity-85"
            >
              <Send className="size-4" />
              Telegram
            </a>
          </div>
          <button
            type="button"
            onClick={() => void shareInvite()}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 text-[13px] font-semibold text-primary active:opacity-80"
          >
            <Share2 className="size-4" />
            Compartir en otra app
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            En iPhone se abre en Safari; también puedes añadirla a la pantalla de inicio.
          </p>
        </Sheet>
      ) : null}

      {giftOpen ? (
        <Sheet onClose={() => setGiftOpen(false)} title="Regalos para la sala">
          <p className="mb-2 text-[11px] text-muted-foreground">Tu regalo aparece en el chat de toda la sala.</p>
          <div className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
            <span className="flex items-center gap-1 text-[13px] text-foreground">
              <Diamond className="size-3.5 text-primary" />
              {profile?.diamonds ?? 0} diamantes
            </span>
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {GIFTS.map(gift => (
              <button
                key={gift.key}
                type="button"
                disabled={giftBusy}
                onClick={() => void give(gift.key)}
                className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background p-2 active:opacity-80"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={gift.art} alt={gift.name} className="size-14 object-contain" />
                <span className="text-[12px] font-medium text-foreground">{gift.name}</span>
                <span className="text-[11px] text-primary">{gift.cost} oro</span>
              </button>
            ))}
          </div>
        </Sheet>
      ) : null}

      {stickerOpen ? (
        <Sheet onClose={() => setStickerOpen(false)} title="Pegatinas">
          <p className="text-[11px] text-muted-foreground">
            {me?.seat_no ? `Sale en tu asiento ${me.seat_no}` : "Siéntate para mandarla"}
          </p>
          <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
            {STICKER_GROUPS.map(group => (
              <Chip key={group.key} active={panelGroup === group.key} onClick={() => setPanelGroup(group.key)}>
                {group.emoji} {group.label}
              </Chip>
            ))}
            <Chip active={panelGroup === "dragon"} onClick={() => setPanelGroup("dragon")}>
              🐲 Dragón 3D
            </Chip>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1">
            {panelGroup === "dragon"
              ? DRAGON_CLIPS.map(clip => (
                <button
                  key={clip.id}
                  type="button"
                  aria-label={`Que el dragón haga ${clip.label}`}
                  onClick={() => void throwDragon(clip.id)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-border bg-background px-1 py-1.5 active:opacity-75"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/dragon.png" alt="" className="size-9 object-contain" />
                  <span className="text-[12px] font-semibold text-foreground">{clip.emoji} {clip.label}</span>
                </button>
              ))
              : STICKERS.filter(item => item.group === panelGroup).map(sticker => (
              <button
                key={sticker.id}
                type="button"
                aria-label={`Enviar la pegatina ${sticker.name.replace(/_/g, " ")}`}
                onClick={() => void throwSticker(sticker)}
                className="flex flex-col items-center gap-1 py-1 active:opacity-75"
              >
                <StickerActor sticker={sticker} size={58} />
                <span className="w-full truncate text-center text-[11px] text-muted-foreground">{sticker.label}</span>
              </button>
              ))}
          </div>
          {/*
            A kiss needs the neighbour's yes, and this room has no way to ask
            yet: the button stays out until the ask exists here too, so nobody
            is kissed without answering.
          */}
        </Sheet>
      ) : null}

      <DragonEmotes
        ref={dragon}
        getSeatEl={seat => seatRefs.current[seat] ?? null}
        onError={message => flash(message)}
      />
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-medium",
        active ? "border-primary bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60" role="dialog" aria-label={title}>
      <button type="button" aria-label="Cerrar" className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[88svh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl border border-border bg-card px-4 pb-6 pt-3">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
        <div className="mb-2 flex items-center gap-2">
          <h2 className="flex-1 text-sm font-semibold text-foreground">{title}</h2>
          <button type="button" aria-label="Cerrar" onClick={onClose} className="grid size-7 place-items-center rounded-full border border-border">
            <X className="size-3.5 text-foreground" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
