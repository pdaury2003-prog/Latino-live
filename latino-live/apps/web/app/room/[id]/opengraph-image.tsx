import { ImageResponse } from "next/og";
import { publicServerSupabase } from "@/lib/supabase-server";
import { titleFromKey } from "@/lib/room-title";

export const alt = "Sala de voz en vivo en Latino Live";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type RoomHead = { slug: string; title: string; host_name: string; max_seats: number; announcement: string };

async function roomFor(key: string): Promise<RoomHead | null> {
  try {
    const supabase = await publicServerSupabase();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const { data } = await supabase
      .from("rooms")
      .select("slug, title, host_name, max_seats, announcement")
      .eq(uuid ? "id" : "slug", key)
      .maybeSingle();
    return (data as RoomHead | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * The picture a room link shows in WhatsApp, Telegram or X. It carries the
 * room's own name and host, because a shared link that only says "Latino Live"
 * tells nobody why they should tap it.
 */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const room = await roomFor(id);
  const title = room?.title ?? titleFromKey(id);
  const host = room?.host_name ?? "Latino Live";
  const seats = room?.max_seats ?? 10;
  const subtitle = room ? `${host} te espera en un asiento · ${seats} asientos` : `Ocupa un asiento y habla en vivo · ${seats} asientos`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #16100d 0%, #2a1512 45%, #4a1d16 100%)",
          color: "#fff8ef",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 20px",
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,196,107,0.45)",
              color: "#ffd79b",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: 2,
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 99, background: "#ff5a4d" }} />
            EN VIVO
          </div>
          <div style={{ fontSize: 30, color: "#ffd79b", letterSpacing: 3, fontWeight: 700 }}>
            LATINO LIVE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1 }}>{title}</div>
          <div style={{ display: "flex", fontSize: 36, color: "#f3d9c2" }}>
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 32, color: "#ffd79b", fontWeight: 600 }}>
            Entra y habla en vivo
          </div>
          <div
            style={{
              display: "flex",
              padding: "16px 30px",
              borderRadius: 999,
              background: "#ff6b5e",
              color: "#ffffff",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            Ocupar mi asiento
          </div>
        </div>
      </div>
    ),
    size,
  );
}
