import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { androidInstallHref } from "@/lib/app-install.server";

export const metadata: Metadata = {
  title: "Descargar la app · Latino Live",
  description: "Instala Latino Live en tu teléfono Android para hablar en las salas con voz y micrófono.",
};

/**
 * The one address that hands out the app. With the install link set it sends
 * the phone straight to the download; without it, it says honestly what is
 * missing instead of installing the website as if it were the app.
 */
export default function Page() {
  const href = androidInstallHref();
  if (href) redirect(href);

  return (
    <main className="mx-auto flex min-h-[100svh] w-full max-w-[480px] flex-col justify-center bg-[#08091A] px-6 pb-10">
      <div className="rounded-[24px] border border-[#E8C27E]/30 bg-white/[0.05] px-5 py-7 text-center">
        <p className="text-[11px] font-semibold tracking-[0.24em] text-[#E8C27E]/80">LATINO LIVE</p>
        <h1 className="mt-2 text-[20px] font-semibold text-white">La app para Android</h1>
        <p className="mt-2 text-[13px] leading-5 text-white/65">
          La app se instala en el teléfono, con voz, micrófono y las salas en vivo. Esta página todavía no tiene el
          enlace de descarga publicado.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-white/15 px-5 text-[13px] font-semibold text-white/85"
        >
          Volver a las salas
        </Link>
      </div>
    </main>
  );
}
