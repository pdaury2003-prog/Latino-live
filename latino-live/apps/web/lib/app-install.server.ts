import { existsSync } from "node:fs";
import path from "node:path";
import { ANDROID_APP_URL, BUNDLED_APK_PATH } from "@/lib/app-install";

/**
 * Where the phone gets the app itself: the install link when the owner set it,
 * or the APK kept in the site's download folder. Empty means there is no app
 * to hand out yet, and the site says so instead of pretending.
 */
export function androidInstallHref(): string {
  if (ANDROID_APP_URL) return ANDROID_APP_URL;
  const local = path.join(process.cwd(), "public", BUNDLED_APK_PATH.replace(/^\//, ""));
  return existsSync(local) ? BUNDLED_APK_PATH : "";
}
