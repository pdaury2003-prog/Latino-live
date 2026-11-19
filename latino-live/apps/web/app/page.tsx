import { HomeView } from "@/components/live/home-view";
import { androidInstallHref } from "@/lib/app-install.server";

export default function Page() {
  return <HomeView installHref={androidInstallHref()} />;
}
