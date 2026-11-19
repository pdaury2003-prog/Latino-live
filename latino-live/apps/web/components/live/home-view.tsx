"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Diamond, Gem, Radio, Sparkles, Trophy, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import {
  acceptRoomInvite,
  coverArt,
  getRoomRanking,
  getSeatsForRooms,
  listRoomInvites,
  listRooms,
  photoUrl,
  type RankedRoom,
  type RoomInviteRow,
  type RoomRow,
  type SeatRow,
} from "@/lib/live";
import { RankFrame } from "@/components/live/rank-frame";
import { InstallApp } from "@/components/live/install-app";
import { cn } from "@/lib/utils";

const COUNTRIES: Record<string, string> = { US: "USA", ES: "España", MX: "México", AR: "Argentina", CO: "Colombia" };

function count(value: number) {
  try {
    return new Intl.NumberFormat("es-US").format(value);
  } catch {
    return String(value);
  }
}

/**
 * The billboard: today's podium with the animated TOP frames, then every open
 * room. A room opens in the browser and shares the seats and chat with the
 * people using the phone app.
 */
export function HomeView({ installHref = "" }: { installHref?: string }) {
  const { status, user } = useAuth();
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [seats, setSeats] = useState<Record<string, SeatRow[]>>({});
  const [ranking, setRanking] = useState<RankedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The rooms other people invited this person to.
  const [invites, setInvites] = useState<RoomInviteRow[]>([]);

  const load = useCallback(async () => {
    try {
      const [nextRooms, nextRanking, pending] = await Promise.all([
        listRooms(),
        getRoomRanking(8),
        user?.id ? listRoomInvites(user.id).catch(() => []) : Promise.resolve([]),
      ]);
      setRooms(nextRooms);
      setRanking(nextRanking);
      setInvites(pending);
      setSeats(await getSeatsForRooms(nextRooms.map(room => room.id)));
      setError(null);
    } catch {
      setError("No pudimos cargar las salas. Revisa tu conexión.");
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const top = ranking.filter(item => Number(item.score) > 0).slice(0, 3);

  return (
    <div className="relative mx-auto w-full max-w-[480px] bg-[#08091A] px-4 pb-10">
      {/* The house's night behind the billboard, the same one the rooms wear. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[linear-gradient(170deg,#0B1030_0%,#0E1436_38%,#120E2C_70%,#08091A_100%)]" />
      <div aria-hidden className="pointer-events-none absolute right-4 top-6 -z-10 size-32 rounded-full bg-[#7C3AED]/20 blur-2xl" />
      <header className="relative flex items-center gap-3 pb-3 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Latino Live" className="size-11 rounded-xl object-contain" />
        <div className="flex-1">
          <h1 className="font-display text-lg font-semibold tracking-[0.14em] text-white">LATINO LIVE</h1>
          <p className="text-[11px] tracking-[0.3em] text-[#E8C27E]/75">SALAS DE VOZ</p>
        </div>
        <Link
          href={user ? "/perfil" : "/login"}
          className="flex items-center gap-1.5 rounded-full border border-[#C4B5FD]/25 bg-[#7C3AED]/55 px-3 py-1.5 text-[12px] text-white backdrop-blur"
        >
          <User className="size-3.5 text-[#F3E8FF]" />
          {status === "loading" ? "…" : user ? user.email?.split("@")[0] : "Entrar"}
        </Link>
      </header>

      <div className="relative flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] text-white/75 backdrop-blur">
        <span className="size-2 rounded-full bg-[#E8C27E]" aria-hidden />
        Todas las salas están abiertas
        <span className="ml-auto inline-flex items-center gap-1">
          <Radio className="size-3.5 text-[#E8C27E]/80" />
          {rooms.length} salas
        </span>
      </div>

      <InstallApp href={installHref} />

      {invites.map(invite => (
        <Link
          key={invite.id}
          href={`/room/${invite.room_slug}${invite.join_code ? `?code=${invite.join_code}` : ""}`}
          onClick={() => { void acceptRoomInvite(invite.id); }}
          className="relative mt-4 flex items-center gap-3 rounded-2xl border border-[#C4B5FD]/32 bg-[#7C3AED]/16 p-3 active:opacity-85"
        >
          <span className="grid size-10 place-items-center rounded-full bg-[#C4B5FD]/18">
            <Sparkles className="size-4 text-[#E9D5FF]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white">
              {invite.from_name} te invitó a {invite.room_title}
            </span>
            <span className="block truncate text-[11px] text-white/60">
              {invite.join_code ? "Sala privada · el código ya viene" : "Toca para entrar y ocupar un asiento"}
            </span>
          </span>
          <span className="rounded-full bg-[#E8C27E] px-3 py-1.5 text-[12px] font-semibold text-[#2A1B46]">Entrar</span>
        </Link>
      ))}

      {top.length > 0 ? (
        <section className="relative mt-5">
          <div className="mb-2 flex items-center gap-1.5">
            <Trophy className="size-4 text-[#E8C27E]" />
            <h2 className="text-base font-semibold text-white">Ranking de hoy</h2>
            <span className="ml-auto text-[11px] text-white/50">Diamantes + PK</span>
          </div>
          <div className="flex items-end justify-center gap-1">
            {[1, 0, 2].map(position => {
              const item = top[position];
              if (!item) return <div key={`gap-${position}`} className="w-24" />;
              const first = position === 0;
              const photo = item.photo_path ? photoUrl(item.photo_path) : null;
              return (
                <Link
                  key={item.room_id}
                  href={`/room/${item.room_id}`}
                  className={cn("flex flex-col items-center rounded-2xl px-0.5 pb-1", first ? "w-44" : "w-32 pt-4")}
                >
                  <RankFrame rank={position + 1} width={first ? 176 : 120} uri={photo} name={item.title} />
                  <span className={cn("mt-0.5 w-full truncate text-center font-semibold text-white", first ? "text-[13px]" : "text-[12px]")}>
                    {item.title}
                  </span>
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-semibold text-white/90">
                    <Gem className="size-3 text-[#E8C27E]" />
                    {count(Number(item.gold))}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <section id="salas" className="mt-5">
        <div className="mb-2 flex items-center gap-1.5">
          <Radio className="size-4 text-[#E8C27E]" />
          <h2 className="text-base font-semibold text-white">Salas en vivo</h2>
          <span className="ml-auto text-[11px] text-white/50">{rooms.length}</span>
        </div>
        {loading ? <p className="py-6 text-center text-sm text-white/55">Cargando salas…</p> : null}
        {error ? <p className="py-6 text-center text-sm text-[#FCA5A5]">{error}</p> : null}
        <div className="grid grid-cols-2 gap-2.5">
          {rooms.map(room => {
            const taken = seats[room.id] ?? [];
            const host = taken.find(seat => seat.seat_no === 1);
            return (
              <Link
                key={room.id}
                href={`/room/${room.slug}`}
                className="group overflow-hidden rounded-[20px] border bg-[rgba(16,18,32,0.92)] transition-transform hover:-translate-y-0.5"
                style={{ borderColor: "rgba(232,194,126,0.22)" }}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={room.background_path ? photoUrl(room.background_path) : coverArt(room.cover)}
                    alt=""
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-[#E8C27E] px-2 py-0.5 text-[11px] font-bold text-[#2A1B46]">EN VIVO</span>
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white/85">
                    {COUNTRIES[room.country] ?? room.country}
                  </span>
                  <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-2 pb-1.5 pt-6">
                    <span className="grid size-5 place-items-center rounded-full bg-[#E8C27E]/90 text-[11px] font-bold text-[#2A1B46]">
                      {(host?.display_name ?? room.host_name).slice(0, 1).toUpperCase()}
                    </span>
                    <span className="truncate text-[11px] text-white/90">{room.host_name}</span>
                    <span className="ml-auto text-[11px] text-white/80">{taken.length}/{room.max_seats}</span>
                  </div>
                </div>
                <div className="px-2.5 py-2">
                  <p className="truncate text-[13px] font-semibold text-white">{room.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-white/50">
                    <Sparkles className="size-3 text-[#E8C27E]/80" />
                    {taken.length > 0 ? `${taken.length} en el escenario` : "Sé la primera persona"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <p className="relative mt-6 flex items-center justify-center gap-1.5 text-center text-[11px] text-white/45">
        <Diamond className="size-3 text-[#E8C27E]/70" />
        Las salas y el chat se actualizan en vivo con todos los teléfonos.
      </p>
      {/* The policy lives one tap away, where Play, the app and search expect it. */}
      <div className="relative mt-2 flex items-center justify-center gap-3 text-[11px] text-white/40">
        <Link href="/privacidad" className="underline-offset-2 hover:text-[#E8C27E] hover:underline">
          Privacidad
        </Link>
        <span aria-hidden>·</span>
        <Link href="/descargar" className="underline-offset-2 hover:text-[#E8C27E] hover:underline">
          Descargar la app
        </Link>
        <span aria-hidden>·</span>
        <Link href="/descargar/codigo" className="underline-offset-2 hover:text-[#E8C27E] hover:underline">
          Código
        </Link>
      </div>
    </div>
  );
}
