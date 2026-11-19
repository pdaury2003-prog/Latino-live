import type { Metadata } from "next";
import { RoomView } from "@/components/live/room-view";
import { publicServerSupabase, siteOrigin } from "@/lib/supabase-server";
import { titleFromKey } from "@/lib/room-title";

type RoomHead = {
  id: string;
  slug: string;
  title: string;
  host_name: string;
  max_seats: number;
  announcement: string;
};

/** The room a link names, or null when it no longer exists. */
async function roomFor(key: string): Promise<RoomHead | null> {
  try {
    const supabase = await publicServerSupabase();
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key);
    const { data } = await supabase
      .from("rooms")
      .select("id, slug, title, host_name, max_seats, announcement")
      .eq(uuid ? "id" : "slug", key)
      .maybeSingle();
    return (data as RoomHead | null) ?? null;
  } catch {
    return null;
  }
}

/** A pasted room link shows the room, its host and how to join. */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const room = await roomFor(id);
  const site = await siteOrigin();
  // A link must preview well even when the room could not be read; the address
  // itself already names the room.
  const slug = room?.slug ?? id;
  const url = `${site}/room/${slug}`;
  const name = room?.title ?? titleFromKey(id);
  const host = room?.host_name;
  // A room that cannot be read yet must not claim it is live; the link itself
  // still names it, which is what makes an invitation worth opening.
  const title = host ? `${name} · ${host} en vivo` : `${name} · Latino Live`;
  const description = host
    ? `Entra a la sala de ${host}, ocupa un asiento y habla en vivo. ${room?.max_seats ?? 10} asientos, regalos y pegatinas animadas.`
    : `Entra a «${name}», ocupa un asiento y habla en vivo. Regalos, pegatinas animadas y un dragón 3D.`;
  return {
    title,
    description,
    alternates: { canonical: `/room/${slug}` },
    openGraph: {
      type: "website",
      url,
      siteName: "Latino Live",
      locale: "es_US",
      title,
      description,
      images: [{ url: `${url}/opengraph-image`, width: 1200, height: 630, alt: `${name} en Latino Live` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${url}/opengraph-image`],
    },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ code?: string }>;
}) {
  const { id } = await params;
  // The invitation to a private room carries its code in the link.
  const { code } = await searchParams;
  return <RoomView id={id} code={code} />;
}
