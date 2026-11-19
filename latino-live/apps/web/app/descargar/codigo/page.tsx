import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, Download, FileArchive } from "lucide-react";

export const metadata: Metadata = {
  title: "Descargar el código de la app · Latino Live",
  description: "El código completo de la app Android de Latino Live y las reglas de su servidor, en un solo archivo.",
  openGraph: {
    title: "Descargar el código de la app · Latino Live",
    description: "El código completo de la app Android y las reglas de su servidor.",
  },
};

const PACKAGE = "/descargas/latino-live-app-8k2m4p.zip";
const SIZE = "39 MB";

export default function Page() {
  return (
    <main className="relative mx-auto w-full max-w-[480px] bg-[#08091A] px-4 pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[340px] bg-[linear-gradient(170deg,#0B1030_0%,#0E1436_40%,#120E2C_72%,#08091A_100%)]"
      />

      <header className="flex items-center gap-3 pb-2 pt-4">
        <Link
          href="/"
          aria-label="Volver a las salas"
          className="grid size-9 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-white/80 active:opacity-70"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[11px] tracking-[0.28em] text-[#E8C27E]/75">LATINO LIVE</p>
          <h1 className="font-display text-[19px] font-semibold text-white">Código de la app</h1>
        </div>
      </header>

      <p className="mt-2 text-[13px] leading-[1.7] text-white/70">
        Un archivo de {SIZE} con la app Android completa, las reglas del servidor y un LEEME que explica cómo abrirla.
      </p>

      <a
        href={PACKAGE}
        download
        className="mt-4 flex items-center gap-3 rounded-2xl border border-[#E8C27E]/30 bg-[#E8C27E]/[0.10] px-4 py-3 active:opacity-80"
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E8C27E]/15">
          <FileArchive className="size-5 text-[#E8C27E]" />
        </span>
        <span className="flex-1">
          <span className="block text-[13.5px] font-semibold text-white">Descargar la app (.zip)</span>
          <span className="block text-[11.5px] text-white/55">Código, servidor e imágenes · {SIZE}</span>
        </span>
        <Download className="size-4 text-[#E8C27E]" />
      </a>

      <section className="mt-6">
        <h2 className="text-[15px] font-semibold text-white">Cómo abrirla</h2>
        <p className="mt-2 text-[13px] leading-[1.7] text-white/70">
          Descomprime el archivo, abre una terminal en la carpeta y ejecuta estos tres pasos. El segundo descarga las
          dependencias desde internet, una sola vez, así que necesita conexión y unos minutos.
        </p>
        <pre className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-3 text-[11.5px] leading-[1.8] text-[#E8C27E]">
{`cd apps/mobile
npm install
npm run dev`}
        </pre>
      </section>

      <section className="mt-5">
        <h2 className="text-[15px] font-semibold text-white">Qué trae</h2>
        <ul className="mt-2 space-y-1.5">
          {[
            "apps/mobile: las pantallas, el audio en vivo, el dragón 3D, los marcos, el SVIP y los regalos.",
            "supabase: las tablas, las reglas de acceso y las funciones del servidor.",
            "DESIGN.md y PRODUCT.md: los colores y lo que hace el producto.",
            "Un LEEME.txt con los pasos y lo que necesita para conectarse.",
          ].map(item => (
            <li key={item} className="flex gap-2 text-[13px] leading-[1.7] text-white/70">
              <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-[#E8C27E]/70" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-[1.7] text-white/45">
          Las credenciales de la conexión no viajan en el paquete, por seguridad. Sin ellas la app abre y se ve, pero no
          entra a las salas.
        </p>
      </section>

      <footer className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-5 text-center">
        <Link href="/" className="text-[12px] font-semibold text-[#E8C27E] underline-offset-2 hover:underline">
          Volver a las salas
        </Link>
        <p className="text-[11px] text-white/35">Latino Live · Salas de voz en vivo</p>
      </footer>
    </main>
  );
}
