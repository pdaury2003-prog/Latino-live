# Latino Live · código completo

Este paquete contiene el código fuente del proyecto **Latino Live**: la web
(`apps/web`, Next.js) y la app Android (`apps/mobile`, Expo), más la base de
datos y las funciones del servidor (`supabase/`).

## Qué hay dentro

```
apps/web/            web pública (Next.js 16, React 19, Tailwind 4)
  app/               rutas: inicio, sala, entrar/registrarse, sitemap, robots
  components/live/   sala: asientos, chat, regalos, pegatinas y dragón 3D
  lib/               voz (WebRTC), relé TURN, dragón (three.js), datos
  public/            imágenes, regalos, marcos de ranking y modelos del dragón

apps/mobile/         app Android (Expo SDK 57)
  app/               pantallas: salas, sala, perfil, juegos, mensajes
  components/        sala, asientos, regalos, pegatinas, dragón 3D
  lib/               voz (WebRTC), relé TURN, datos, monedas, niveles
  lib/svip-kit.ts    las nueve piezas de cada nivel SVIP y sus colores
  assets/            imágenes, regalos en video y modelos del dragón

supabase/
  migrations/        tablas, permisos y políticas de la base de datos
  functions/         turn-credentials, youtube-search, delete-account…

packages/games/      motor de reglas (ajedrez, damas, ludo, dominó y casino)
server/              servidor Node con WebSockets para las mesas en vivo
```

## Cómo levantarlo

Requisitos: Node.js 22 y npm 10.

```bash
# web
cd apps/web
npm install
npm run dev          # http://localhost:3000

# app Android
cd apps/mobile
npm install
npm run dev          # abre Expo; la app se prueba en un teléfono
```

Para la app nativa hace falta generar el proyecto de Android con Expo
(`npx expo prebuild` o EAS Build). No requiere claves propias: la configuración
pública del backend ya viene en `public/spk-runtime-config.js`.

Scripts útiles:

```bash
cd apps/web && npm run typecheck
cd apps/mobile && npm run typecheck && npm test
```

## Lo que no va en el paquete

- `node_modules/` y `.next/` (se instalan/generan con `npm install` y al compilar).
- Claves privadas: viven en Cloud → Keys y nunca en el código.

El dragón de la sala se dibuja de dos formas según la plataforma: en el
teléfono, una capa nativa (módulo `modules/dragon-overlay`) con la página
`assets/dragon/dragon_layer.html`; en el navegador, el mismo escenario
(`lib/dragon-stage.ts`) sobre un lienzo dentro de la propia sala, con los
modelos servidos desde `public/dragon/`.

## Cómo funciona la voz

Cada persona se conecta directamente con las demás por WebRTC. Si dos redes no
se encuentran (operadores o países distintos), el servidor del proyecto entrega
credenciales de un relé TURN mediante la función `turn-credentials`; la clave
del proveedor se guarda en Cloud → Keys como `METERED_API_KEY` (y `METERED_APP`).
Sin esa clave la sala sigue funcionando por conexión directa.
