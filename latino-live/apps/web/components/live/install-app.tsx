"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Share, X } from "lucide-react";
import { BUNDLED_APK_PATH } from "@/lib/app-install";

type Device = "android" | "iphone" | "other";

function device(): Device {
  const agent = window.navigator.userAgent;
  if (/android/i.test(agent)) return "android";
  if (/iphone|ipad|ipod/i.test(agent)) return "iphone";
  return "other";
}

/**
 * The install entry of the billboard: the Android app when its link exists, and
 * on iPhone the honest note that this is the browser version, which can be kept
 * on the home screen but is not the installed app.
 */
export function InstallApp({ href = "" }: { href?: string }) {
  const [kind, setKind] = useState<Device | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setKind(device());
    try {
      setDismissed(window.localStorage.getItem("latino:install-tip") === "off");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed || kind === null) return null;

  // An iPhone has no APK: it gets the honest note that this page is the browser
  // version, not the installed app.
  if (kind === "iphone") {
    return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[12px] leading-5 text-white/80">
      <Share className="mt-0.5 size-4 shrink-0 text-white/60" />
      <p className="flex-1">
        Esta es la versión web. En iPhone puedes tenerla a mano con
        <span className="font-semibold text-white"> Compartir → Añadir a pantalla de inicio</span>;
        la app instalable es la de Android.
      </p>
      <button
        type="button"
        aria-label="Ocultar el aviso"
        onClick={() => {
          setDismissed(true);
          try { window.localStorage.setItem("latino:install-tip", "off"); } catch { /* private mode */ }
        }}
        className="grid size-5 place-items-center rounded-full border border-white/15"
      >
        <X className="size-3 text-white/50" />
      </button>
    </div>
    );
  }

  // Every other phone downloads the app itself, never the website: this row
  // points at the APK and nothing else. Without an APK yet, the site says so
  // instead of handing out the browser version.
  if (!href) {
    return (
      <div className="mt-3 flex items-start gap-2 rounded-2xl border border-white/12 bg-white/[0.06] px-3 py-2 text-[12px] leading-5 text-white/75">
        <Smartphone className="mt-0.5 size-4 shrink-0 text-white/55" />
        <p className="flex-1">
          La app para Android se está preparando.
          <span className="text-white/55"> Mientras tanto, esta web ya tiene voz, chat y regalos.</span>
        </p>
        <button
          type="button"
          aria-label="Ocultar el aviso"
          onClick={() => {
            setDismissed(true);
            try { window.localStorage.setItem("latino:install-tip", "off"); } catch { /* private mode */ }
          }}
          className="grid size-5 place-items-center rounded-full border border-white/15"
        >
          <X className="size-3 text-white/50" />
        </button>
      </div>
    );
  }

  return (
    <a
      href={href}
      rel="noopener"
      // Our own APK is saved with its name; an install page is just opened.
      download={href.startsWith(BUNDLED_APK_PATH) ? "latino-live.apk" : undefined}
      className="mt-3 flex items-center gap-3 rounded-2xl border border-[#E8C27E]/35 bg-[#E8C27E]/12 px-3 py-2.5 active:opacity-85"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E8C27E]/20">
        <Download className="size-4 text-[#E8C27E]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-white">Descargar la app</span>
        <span className="block text-[11px] text-white/60">
          {kind === "android" ? "El APK para tu teléfono, con voz y micrófono." : "Para teléfonos Android."}
        </span>
      </span>
      <span className="rounded-full bg-[#E8C27E] px-3 py-1.5 text-[12px] font-semibold text-[#2A1B46]">Descargar</span>
    </a>
  );
}
