import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Política de privacidad · Latino Live",
  description:
    "Qué datos usa Latino Live, para qué sirven, con quién se comparten y cómo borrar tu cuenta y tus fotos.",
  openGraph: {
    title: "Política de privacidad · Latino Live",
    description: "Qué datos usa Latino Live y cómo borrar tu cuenta y tus fotos.",
  },
};

/**
 * The public privacy policy Google Play asks for. It is written from what the
 * app actually does, so every promise here can be checked in the product.
 * NEXT_PUBLIC_PRIVACY_EMAIL prints the owner's support address when it is set.
 */
const CONTACT_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() ?? "";
const UPDATED = "16 de noviembre de 2026";

type Section = { id: string; title: string; body: React.ReactNode };

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[13px] leading-[1.75] text-white/70">{children}</p>;
}

function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="mt-2 space-y-1.5">
      {items.map((item, index) => (
        <li key={index} className="flex gap-2 text-[13px] leading-[1.7] text-white/70">
          <span aria-hidden className="mt-[9px] size-1 shrink-0 rounded-full bg-[#E8C27E]/70" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

const SECTIONS: Section[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    body: (
      <>
        <P>
          Latino Live es una app de salas de voz en vivo para una comunidad hispanohablante. Las salas se abren en
          Estados Unidos, España, México y otros países de habla hispana, y cualquier persona con una cuenta puede
          entrar, sentarse en un asiento y hablar.
        </P>
        <P>
          En esta política, «la app» es Latino Live para Android y su sitio web, y «nosotros» es el equipo que mantiene
          el servicio.
        </P>
      </>
    ),
  },
  {
    id: "datos",
    title: "Qué datos usamos",
    body: (
      <>
        <P>Usamos solo lo que la app necesita para que las salas funcionen:</P>
        <List
          items={[
            <>
              <strong className="font-semibold text-white/85">Tu cuenta.</strong> Correo electrónico y contraseña. La
              contraseña se guarda cifrada; nunca vemos el texto que escribes.
            </>,
            <>
              <strong className="font-semibold text-white/85">Tu perfil.</strong> Nombre visible, foto, portada, país,
              número de usuario, nivel y membresía SVIP, tema elegido y la lista de personas que bloqueaste.
            </>,
            <>
              <strong className="font-semibold text-white/85">Lo que publicas.</strong> Mensajes del chat de la sala,
              mensajes directos, fotos que compartes, momentos, comentarios y reacciones.
            </>,
            <>
              <strong className="font-semibold text-white/85">Tu actividad en las salas.</strong> En qué sala estás, qué
              asiento ocupas, si el micrófono o la cámara están encendidos, regalos enviados y recibidos, y tu saldo de
              oro y diamantes con su historial de movimientos.
            </>,
            <>
              <strong className="font-semibold text-white/85">Tus conexiones.</strong> A quién sigues, quién te sigue,
              amistades e invitaciones a salas.
            </>,
            <>
              <strong className="font-semibold text-white/85">Avisos.</strong> Un identificador del teléfono para
              enviarte notificaciones. Se borra cuando cierras sesión en ese teléfono o desactivas los avisos.
            </>,
          ]}
        />
        <P>
          No usamos rastreadores publicitarios, no creamos perfiles para venderte publicidad y no vendemos tus datos a
          nadie.
        </P>
      </>
    ),
  },
  {
    id: "voz-camara",
    title: "Voz y cámara",
    body: (
      <>
        <P>
          El audio y el video de una sala viajan en vivo entre los teléfonos de las personas que están en ella, con un
          servidor de retransmisión cuando dos redes no consiguen conectarse directamente. Ese servidor solo reenvía la
          señal mientras la sala está abierta.
        </P>
        <P>
          <strong className="font-semibold text-white/85">
            No grabamos ni guardamos el audio ni el video de las salas.
          </strong>{" "}
          Cuando sales del micrófono o de la cámara, la transmisión termina. Lo que sí se guarda es el texto del chat y
          las fotos que decidas enviar.
        </P>
      </>
    ),
  },
  {
    id: "pagos",
    title: "Compras y monedas",
    body: (
      <>
        <P>
          Los diamantes se compran con tarjeta a través de un procesador de pagos en una página segura. El número de tu
          tarjeta lo recibe ese procesador, nunca la app, y no queda guardado en nuestros servidores.
        </P>
        <P>
          Si compras desde una tienda de aplicaciones, el cobro y los datos de pago los maneja la tienda según su propia
          política. El oro y los diamantes que ganas con regalos se registran en tu cuenta junto con el historial de
          movimientos.
        </P>
      </>
    ),
  },
  {
    id: "permisos",
    title: "Permisos del teléfono",
    body: (
      <>
        <P>Cada permiso se pide cuando lo necesitas y puedes negarlo o quitarlo después en los ajustes del teléfono:</P>
        <List
          items={[
            <>
              <strong className="font-semibold text-white/85">Micrófono:</strong> para hablar cuando ocupas un asiento.
              Sin él puedes seguir leyendo el chat y enviando regalos.
            </>,
            <>
              <strong className="font-semibold text-white/85">Cámara:</strong> solo si enciendes tu video en una sala de
              cámara.
            </>,
            <>
              <strong className="font-semibold text-white/85">Fotos:</strong> para elegir tu foto de perfil, tu portada,
              el fondo de tu sala o una imagen para el chat o tus momentos. Solo se sube la foto que eliges.
            </>,
            <>
              <strong className="font-semibold text-white/85">Notificaciones:</strong> para avisarte de regalos,
              seguidores, mensajes y salas de la gente que sigues. Puedes desactivarlas sin perder nada más.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: "para-que",
    title: "Para qué los usamos",
    body: (
      <List
        items={[
          "Crear tu cuenta, identificarte y mantener tu sesión.",
          "Mostrar tu perfil y tu asiento a las personas de la sala.",
          "Entregar el chat, los regalos y el audio en tiempo real.",
          "Guardar tu saldo, tus compras y tu historial.",
          "Enviar avisos que pediste, como un regalo o una sala nueva.",
          "Moderar: silenciar, expulsar o bloquear cuando alguien incumple las reglas.",
          "Responder a tus solicitudes sobre tus datos y cumplir obligaciones legales.",
        ]}
      />
    ),
  },
  {
    id: "compartir",
    title: "Con quién se comparten",
    body: (
      <>
        <P>
          No vendemos datos personales. Los comparten solo los proveedores que hacen funcionar la app, y únicamente lo
          necesario para su tarea:
        </P>
        <List
          items={[
            "El servicio de base de datos, cuentas y archivos donde vive tu información.",
            "El servidor de retransmisión de audio y video, que reenvía la señal en vivo.",
            "El procesador de pagos, para cobrar las recargas de diamantes.",
            "El servicio de notificaciones del teléfono, para entregar los avisos.",
          ]}
        />
        <P>
          También podemos entregar información si la ley lo exige o si es necesario para proteger a una persona de un
          daño grave. Lo que publicas en una sala —tu nombre, tu foto, tus mensajes, tus regalos— lo ven las personas
          que están en esa sala, y los mensajes directos los ve la persona a la que se los envías.
        </P>
      </>
    ),
  },
  {
    id: "conservacion",
    title: "Cuánto tiempo se guarda",
    body: (
      <>
        <P>
          Tu cuenta y tu perfil se guardan mientras la cuenta exista. El chat de una sala conserva solo los mensajes más
          recientes y el anfitrión puede vaciarlo; al cerrar la sala deja de estar disponible para el público.
        </P>
        <P>
          Cuando eliminas tu cuenta, se borran tu perfil, tus fotos, tus mensajes y tus tokens de avisos. Los registros de
          una compra pueden conservarse el tiempo que exige la ley fiscal y de contabilidad del procesador de pagos.
        </P>
      </>
    ),
  },
  {
    id: "seguridad",
    title: "Seguridad",
    body: (
      <P>
        Las conexiones con la app viajan cifradas. Cada tabla y cada archivo tienen reglas de acceso por persona: solo
        entra quien puede entrar, y cada foto se guarda bajo el identificador de su dueño. Ningún sistema es perfecto; si
        detectas algo raro en tu cuenta, escríbenos y lo revisamos.
      </P>
    ),
  },
  {
    id: "derechos",
    title: "Tus derechos y cómo borrar tu cuenta",
    body: (
      <>
        <P>
          Puedes pedir acceso a tus datos, corregirlos, llevártelos, oponerte a un uso o pedir que los borremos. También
          puedes cambiar tu perfil o bloquear a alguien dentro de la app en cualquier momento.
        </P>
        <P>
          <strong className="font-semibold text-white/85">Para eliminar tu cuenta:</strong> abre la app, entra a Perfil →
          Ajustes y elige «Eliminar cuenta». Se borran tu cuenta, tu perfil, tus fotos, tus mensajes, tus salas y tus
          avisos. La acción no se puede deshacer.
        </P>
        <P>
          Si no puedes entrar a la app, escríbenos desde el correo de tu cuenta y lo hacemos por ti.
        </P>
      </>
    ),
  },
  {
    id: "menores",
    title: "Menores de edad",
    body: (
      <P>
        Latino Live no está pensado para niños menores de 13 años. Si crees que un menor de 13 creó una cuenta,
        escríbenos y la eliminamos junto con sus datos.
      </P>
    ),
  },
  {
    id: "cambios",
    title: "Cambios a esta política",
    body: (
      <P>
        Si cambiamos algo importante —por ejemplo, un nuevo uso de tus datos— lo avisaremos en la app antes de que entre
        en vigor y actualizaremos la fecha de arriba. Seguir usando la app después del aviso significa que aceptas la
        versión nueva.
      </P>
    ),
  },
];

export default function Page() {
  return (
    <main className="relative mx-auto w-full max-w-[480px] bg-[#08091A] px-4 pb-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[linear-gradient(170deg,#0B1030_0%,#0E1436_40%,#120E2C_72%,#08091A_100%)]"
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
          <h1 className="font-display text-[19px] font-semibold text-white">Política de privacidad</h1>
        </div>
      </header>

      <div className="mt-2 flex items-center gap-2 rounded-2xl border border-[#E8C27E]/25 bg-[#E8C27E]/[0.08] px-3 py-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#E8C27E]/15">
          <ShieldCheck className="size-4 text-[#E8C27E]" />
        </span>
        <p className="text-[11.5px] leading-[1.6] text-white/70">
          En corto: el audio y el video no se graban, tus datos no se venden y puedes borrar tu cuenta desde la app
          cuando quieras.
        </p>
      </div>

      <p className="mt-4 text-[11px] text-white/45">Última actualización: {UPDATED}</p>

      <nav aria-label="Contenido" className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="text-[11px] font-semibold tracking-[0.2em] text-white/45">EN ESTA PÁGINA</p>
        <ol className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {SECTIONS.map((section, index) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="flex gap-1.5 text-[11.5px] leading-[1.4] text-white/65 underline-offset-2 hover:text-[#E8C27E] hover:underline"
              >
                <span className="tabular-nums text-[#E8C27E]/70">{index + 1}.</span>
                <span>{section.title}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6 space-y-6">
        {SECTIONS.map((section, index) => (
          <section key={section.id} id={section.id} className="scroll-mt-4">
            <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-white">
              <span className="text-[12px] tabular-nums text-[#E8C27E]/70">{index + 1}.</span>
              {section.title}
            </h2>
            {section.body}
          </section>
        ))}

        <section id="contacto" className="scroll-mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4">
          <h2 className="flex items-baseline gap-2 text-[15px] font-semibold text-white">
            <span className="text-[12px] tabular-nums text-[#E8C27E]/70">{SECTIONS.length + 1}.</span>
            Contacto
          </h2>
          <P>
            Para cualquier pregunta sobre esta política o para ejercer tus derechos, escríbenos desde el correo de tu
            cuenta y te respondemos en un plazo razonable.
          </P>
          {CONTACT_EMAIL ? (
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-[#E8C27E] px-4 text-[12.5px] font-semibold text-[#2A1B46] active:opacity-85"
            >
              {CONTACT_EMAIL}
            </a>
          ) : null}
        </section>
      </div>

      <footer className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-5 text-center">
        <Link href="/" className="text-[12px] font-semibold text-[#E8C27E] underline-offset-2 hover:underline">
          Volver a las salas
        </Link>
        <p className="text-[11px] text-white/35">Latino Live · Salas de voz en vivo</p>
      </footer>
    </main>
  );
}
