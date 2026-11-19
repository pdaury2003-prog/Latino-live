/**
 * The Android app's install link, set once by the owner. The browser version is
 * never offered as a download of the app, so everything that offers the app
 * reads this one value.
 */
export const ANDROID_APP_URL = (process.env.NEXT_PUBLIC_ANDROID_APP_URL ?? "").trim();

/** The APK the project ships with the site, if its owner put one here. */
export const BUNDLED_APK_PATH = "/descargas/latino-live.apk";
