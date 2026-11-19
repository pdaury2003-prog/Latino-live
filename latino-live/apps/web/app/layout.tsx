import type { Metadata } from "next";
import Script from "next/script";
import "@fontsource/geist/400.css";
import "@fontsource/geist/500.css";
import "@fontsource/geist/600.css";
import "@fontsource/geist/700.css";
import "./globals.css";
import "./spk-theme.css";
import { AppShell } from "@/components/app/app-shell";
import { AppProviders } from "./providers";
import designTheme from "./spk-design-theme.mjs";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://latino-live.exaspark.app"),
  title: "Latino Live · Salas de voz en vivo",
  description: "Entra a una sala, ocupa un asiento, habla en vivo y envía regalos y pegatinas animadas.",
  applicationName: "Latino Live",
  icons: { icon: "/icon-512.png", apple: "/icon-512.png" },
  openGraph: {
    title: "Latino Live",
    description: "Salas de voz en vivo: siéntate, habla y envía regalos y pegatinas animadas a otros asientos.",
    images: ["/logo.png"],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#0a0908" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
      </head>
      <body>
        <Script src="/spk-runtime-config.js" strategy="beforeInteractive" />
        <AppProviders designTheme={designTheme}>
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
