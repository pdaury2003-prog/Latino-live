import type { MetadataRoute } from "next";
import { publicServerSupabase } from "@/lib/supabase-server";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://latino-live.exaspark.app";

/**
 * Every open room, so a search for a room's name or its host finds it. Rooms
 * change often, so this list is rebuilt every few minutes instead of daily.
 */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE, changeFrequency: "hourly", priority: 1 },
    // The public policy Google Play asks for, and the one people link to.
    { url: `${SITE}/privacidad`, changeFrequency: "monthly", priority: 0.3 },
  ];
  try {
    const supabase = await publicServerSupabase();
    const { data } = await supabase
      .from("rooms")
      .select("slug, created_at")
      .is("closed_at", null)
      // A private room is link-only: never listed for search engines.
      .eq("is_private", false)
      .limit(200);
    for (const room of (data ?? []) as { slug: string; created_at: string }[]) {
      entries.push({
        url: `${SITE}/room/${room.slug}`,
        lastModified: room.created_at ? new Date(room.created_at) : undefined,
        changeFrequency: "hourly",
        priority: 0.8,
      });
    }
  } catch {
    // Without data the home page still lists what is open.
  }
  return entries;
}
