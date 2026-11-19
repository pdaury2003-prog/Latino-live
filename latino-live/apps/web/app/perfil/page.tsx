import type { Metadata } from "next";
import { ProfileView } from "@/components/live/profile-view";

export const metadata: Metadata = {
  title: "Mi perfil · Latino Live",
  description: "Tu retrato, tu ID, tus contadores y tus salas en Latino Live.",
};

export default function Page() {
  return <ProfileView />;
}
