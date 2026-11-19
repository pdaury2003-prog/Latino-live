# Latino Live · código fuente

Este paquete contiene el proyecto completo: el sitio web, la app Android y el
backend del proyecto (tablas, permisos y funciones).

## Qué hay dentro

```
apps/web/        el sitio público (Next.js)
apps/mobile/     la app Android (Expo SDK 57)
packages/games/  el motor de reglas de los juegos
server/          el servidor de mesas en vivo (Node + WebSockets)
supabase/        migraciones y funciones del backend
docs/            arquitectura, publicación y avisos
DESIGN.md        colores, tipografía y piezas visuales
PRODUCT.md       qué hace el producto y para quién
```

## Cómo abrirlo

Requisitos: Node.js 22 y npm 10.

```bash
# el sitio web
cd apps/web
npm install
npm run dev          # http://localhost:3000

# la app Android
cd apps/mobile
npm install
npm run dev          # abre el simulador o el teléfono
```

La app Android se instala en el teléfono generando el proyecto nativo con Expo
(`npx expo prebuild` o EAS Build).

```bash
# el servidor de juegos
cd server
npm install
npm run typecheck
npm test
npm start            # escucha en :8787
```

## Qué necesita para conectarse

Las credenciales no viajan en el paquete, por seguridad:

- **Web y app**: leen la dirección y la llave pública de su propio backend. Si
  abres el proyecto en otro entorno, configura las variables públicas de
  Supabase (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`).
- **Servidor de juegos**: necesita `SUPABASE_URL`, `SUPABASE_ANON_KEY` y
  `SUPABASE_SERVICE_ROLE_KEY`. Sin la última, el casino se apaga y quedan los
  juegos de sala. Ver `server/README.md`.

Sin credenciales el proyecto compila y se ve, pero no entra a las salas.

## Comprobaciones

```bash
cd apps/web     && npm run typecheck
cd apps/mobile  && npm run typecheck && npm test
cd server       && npm run typecheck && npm test
```

## Archivos grandes que no van aquí

El instalador de la app y los paquetes de descarga viven en la web publicada
(`/descargas/`), no dentro del código. Los modelos 3D del dragón sí están
incluidos.
