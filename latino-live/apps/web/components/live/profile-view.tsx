"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Copy, Crown, Diamond, Heart, LogOut, Radio, Sparkles, UserPlus, Users, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getProfile, getProfileStats, listRooms, type ProfileRow, type ProfileStats, type RoomRow } from "@/lib/live";
import { cn } from "@/lib/utils";

const EMPTY: ProfileStats = { followers: 0, following: 0, friends: 0, visitors: 0, is_following: false };

/** The four looks the house sells, named the way the phone app names them. */
const SVIP_NAMES: Record<number, string> = {
  1: "Imperial esmeralda",
  2: "Imperial zafiro",
  3: "Imperial amatista",
  4: "Fénix dorado",
  5: "Dragón esmeralda",
  6: "Guardián de oro",
  7: "Tormenta zafiro",
  8: "Dragón esmeralda",
  9: "Fénix carmesí",
  10: "Imperial corona",
};

/**
 * The profile on the web, dressed like the phone app: a violet galaxy, the
 * portrait in gold, the two numbers the hall knows a person by, the counts and
 * the house's cards.
 */
export function ProfileView() {
  const { status, user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<ProfileStats>(EMPTY);
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [row, counts, open] = await Promise.all([
      getProfile(user.id).catch(() => null),
      getProfileStats(user.id).catch(() => EMPTY),
      listRooms().catch(() => []),
    ]);
    setProfile(row);
    setStats(counts);
    setRooms(open.filter(room => room.host_id === user.id));
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading") {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto grid min-h-[70vh] w-full max-w-[480px] place-items-center px-6 text-center">
        <div>
          <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary/15">
            <Sparkles className="size-7 text-primary" />
          </span>
          <p className="mt-3 text-lg font-semibold text-foreground">Tu perfil vive en la nube</p>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            Entra con tu correo para tener tu retrato, tu ID y tus contadores en todos tus dispositivos, y para sentarte y hablar en las salas.
          </p>
          <Link href="/login" className="mt-4 inline-flex h-11 items-center justify-center rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground">
            Entrar o crear cuenta
          </Link>
        </div>
      </div>
    );
  }

  const name = profile?.display_name ?? user.email?.split("@")[0] ?? "Invitado";
  const initial = name.slice(0, 1).toUpperCase();
  const svip = profile?.svip_level ?? 0;

  async function copyId() {
    if (!profile?.user_number) return;
    try {
      await navigator.clipboard.writeText(String(profile.user_number));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[480px] pb-10">
      <section className="relative overflow-hidden px-4 pb-4 pt-3">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(160deg,#2C1157_0%,#1B0E3A_50%,#0D0B18_86%,#0A0913_100%)]" />
        <div aria-hidden className="absolute -right-12 -top-16 size-56 rounded-full bg-[#7C3AED]/30 blur-2xl" />
        <div aria-hidden className="absolute -left-16 top-28 size-52 rounded-full bg-[#E24AA8]/16 blur-2xl" />
        <span aria-hidden className="pointer-events-none absolute right-5 top-24 text-[84px] font-extrabold leading-none text-white/[0.045]">V</span>

        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold tracking-[0.22em] text-[#EDE4FF]">
            <Sparkles className="size-3.5 text-[#D8B4FE]" />
            MI PERFIL
          </span>
          <Link href="/" className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-medium text-[#F5E9FF]">
            Ver salas
          </Link>
        </div>

        <div className="relative mt-3 flex items-center gap-3">
          <span className="grid size-[92px] shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,#F8DCA0,#D3A24C,#8A5B18)]">
            <span className="grid size-[84px] place-items-center overflow-hidden rounded-full bg-[#1B1226]">
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt={name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-[30px] font-semibold text-white">{initial}</span>
              )}
            </span>
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-[21px] font-bold text-white">{name}</p>
              {svip > 0 ? (
                <span className="rounded-[6px] bg-[#3FAF6A] px-1.5 py-0.5 text-[11px] font-bold text-[#04241A]">
                  SVIP {svip}
                </span>
              ) : null}
            </div>
            {profile?.user_number ? (
              <button type="button" onClick={() => void copyId()} className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-white/70 active:opacity-70">
                ID: {profile.user_number}
                <Copy className={cn("size-3", copied && "text-[#86EFAC]")} />
              </button>
            ) : null}
            <p className="mt-1 line-clamp-2 text-[11px] text-white/55">{profile?.bio || "Sin bio todavía"}</p>
          </div>
        </div>

        <div className="relative mt-3 flex items-center gap-3 rounded-[14px] border border-white/8 bg-[rgba(40,10,60,0.55)] px-3 py-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-[#E8C27E]/16">
            <Crown className="size-[18px] text-[#E8C27E]" />
          </span>
          <div className="flex-1 text-right">
            <p className="text-[12px] font-semibold tabular-nums text-[#E8C27E]">Nivel {profile?.level ?? 1}</p>
            <p className="mt-0.5 text-[11px] text-white/60">
              {(profile?.xp ?? 0).toLocaleString("es-US")} XP en total
            </p>
          </div>
        </div>

        <div className="relative mt-3 flex">
          {[
            { label: "Amigos", value: stats.friends },
            { label: "Siguiendo", value: stats.following },
            { label: "Seguidores", value: stats.followers },
            { label: "Visitas", value: stats.visitors },
          ].map(item => (
            <div key={item.label} className="flex-1 text-center">
              <p className="text-[17px] font-bold tabular-nums text-white">{item.value}</p>
              <p className="mt-0.5 text-[11px] text-white/60">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-1 flex gap-2.5 px-4">
        <div className="relative h-[86px] flex-1 overflow-hidden rounded-[16px] bg-[linear-gradient(135deg,#F0A81F,#D9531C)] px-3.5 py-3">
          <Crown className="absolute bottom-2 right-2 size-9 text-white/30" />
          <p className="text-[15px] font-bold text-white">Noble</p>
          <p className="mt-0.5 text-[11px] text-white/85">Corona y privilegios</p>
        </div>
        <div className="relative h-[86px] flex-1 overflow-hidden rounded-[16px] bg-[linear-gradient(135deg,#E4566F,#E08A0C)] px-3.5 py-3">
          <Wallet className="absolute bottom-2 right-2 size-9 text-white/30" />
          <p className="text-[15px] font-bold text-white">Billetera</p>
          <p className="mt-0.5 text-[11px] tabular-nums text-white/85">{(profile?.diamonds ?? 0).toLocaleString("es-US")} diamantes</p>
        </div>
      </div>

      <div className="relative mx-4 mt-3">
        <p className="mb-2 ml-1 text-[11px] tracking-[0.18em] text-[#B9A8D9]">MI SVIP</p>
        <div className="relative overflow-hidden rounded-[16px] bg-[linear-gradient(135deg,#7C3AED,#C026D3)] px-4 py-3">
          <Diamond className="absolute bottom-1 right-4 size-10 text-white/25" />
          <p className="text-[17px] font-bold text-white">{svip > 0 ? SVIP_NAMES[svip] ?? "Tu membresía" : "Sin membresía"}</p>
          <p className="mt-0.5 text-[11px] text-white/85">
            {svip > 0 ? "Activa · marco, medalla, burbuja y fondo en todas las salas" : "Marco, medalla, burbuja y fondo de perfil"}
          </p>
        </div>
      </div>

      <div className="mx-4 mt-3 overflow-hidden rounded-[20px] bg-[#14121C]">
        {[
          { icon: Radio, tint: "#A78BFA", label: "Mis salas", hint: rooms.length > 0 ? `${rooms.length} abiertas` : "Aún no tienes", href: "/#salas" },
          { icon: Heart, tint: "#FB7185", label: "Las salas de la casa", hint: "En vivo ahora", href: "/#salas" },
          { icon: Users, tint: "#60A5FA", label: "Quién está en línea", hint: "En tu sala", href: "/#salas" },
          { icon: UserPlus, tint: "#F472B6", label: "Invitar amigos", hint: "Con el enlace de la sala", href: "/#salas" },
        ].map((row, index, rows) => (
          <Link
            key={row.label}
            href={row.href}
            className="flex h-[54px] items-center gap-3 px-4 active:opacity-70"
            style={{ borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderBottomColor: "rgba(255,255,255,0.07)" }}
          >
            <span className="grid size-7 place-items-center rounded-lg" style={{ backgroundColor: `${row.tint}22` }}>
              <row.icon className="size-3.5" style={{ color: row.tint }} />
            </span>
            <span className="flex-1 text-[14px] font-semibold text-[#F3EEFF]">{row.label}</span>
            <span className="text-[11px] text-white/45">{row.hint}</span>
            <ChevronRight className="size-4 text-white/40" />
          </Link>
        ))}
      </div>

      {rooms.length > 0 ? (
        <div className="mx-4 mt-3">
          <p className="mb-2 ml-1 text-[12px] font-semibold tracking-[0.18em] text-[#B9A8D9]">TUS SALAS</p>
          {rooms.map(room => (
            <Link key={room.id} href={`/room/${room.slug}`} className="mb-2 flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2.5 active:opacity-85">
              <Radio className="size-4 text-[#E8C27E]" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-white">{room.title}</span>
              <span className="text-[11px] text-white/45">{room.max_seats} asientos</span>
              <ChevronRight className="size-4 text-white/40" />
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mx-4 mt-3 rounded-[20px] bg-[#14121C] px-4 py-3">
        <p className="text-[12px] font-semibold tracking-[0.18em] text-[#B9A8D9]">TU CUENTA</p>
        <p className="mt-1 text-[12px] text-white/55">{user.email}</p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[12px] font-semibold text-white/80 active:opacity-75"
        >
          <LogOut className="size-3.5" />
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
