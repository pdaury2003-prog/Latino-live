# Servidor de juegos · Latino Live

Puerta de entrada en vivo para las mesas de la sala y el casino privado. El
estado lo decide el motor de `packages/games`; el dinero lo mueven solo las
funciones `game_charge` y `game_credit` de la base del proyecto.

## Qué hace

- Autentica cada conexión con el token de Supabase (nunca con una llave
  embebida en la app).
- Mantiene las mesas de salón (ajedrez, damas, ludo, dominó) sincronizadas para
  toda la sala.
- Mantiene el casino (tragamonedas, póker, ruleta, blackjack) en un canal
  privado: solo el jugador recibe su estado.
- Valida cada jugada contra el motor antes de guardarla.
- Cobra la apuesta y paga el premio en la misma base que la billetera de
  diamantes, con bloqueo de fila y topes diarios.
- Late cada 30 s, limita a 40 mensajes cada 10 s por conexión y cierra solo las
  mesas viejas.

## Variables

| Nombre | Para qué |
| --- | --- |
| `PORT` | puerto HTTP/WebSocket (8787 por defecto) |
| `SUPABASE_URL` | URL pública del backend del proyecto |
| `SUPABASE_ANON_KEY` | valida el token de cada persona |
| `SUPABASE_SERVICE_ROLE_KEY` | mueve mesas y diamantes; sin ella el casino se apaga y quedan solo los juegos de salón |
| `ALLOWED_ORIGINS` | orígenes permitidos, separados por coma |
| `MIN_BET`, `MAX_BET`, `MAX_DAILY` | límites de la mesa |
| `ALLOW_DEV_AUTH` | `1` solo en local para probar con `?dev=nombre` |

Las llaves se guardan en Cloud → Keys o en el panel del proveedor donde se
despliegue este servicio. Nunca se escriben en el repositorio.

## Correr y probar

```bash
cd server
npm install
npm run typecheck
npm test              # pruebas del servicio con una base falsa
ALLOW_DEV_AUTH=1 npm start
npm run smoke         # dos conexiones reales, una mesa y una jugada
```

Salud: `GET /health` devuelve `{ ok, tables, casino, sessions }` y nunca
configuración.

## Protocolo

Conectar a `wss://<host>/ws` con `Authorization: Bearer <token>` o
`?token=<token>`. Mensajes de la app:

```json
{"type":"room.join","roomId":"<uuid>"}
{"type":"table.create","kind":"chess","roomId":"<uuid>","seats":["u1","u2"]}
{"type":"table.create","kind":"slots","stake":50}
{"type":"table.ready","tableId":"<uuid>"}
{"type":"table.action","tableId":"<uuid>","action":{"type":"move","from":"e2","to":"e4"}}
{"type":"table.list"}
```

El servidor responde `ready`, `table.state`, `table.list`, `presence`, `error` y
`pong`. El `table.state` ya viene recortado para quien lo recibe: las manos del
dominó y las cartas del póker de los demás nunca salen del servidor.

## Despliegue

Cualquier host que corra un contenedor (Render, Railway, Fly.io, Cloud Run)
sirve. Usa al menos dos regiones y un balanceador con *sticky sessions* o un
almacén compartido de mesas si vas a escalar a más de una instancia; el estado
de una mesa vive en memoria y se respalda en `game_tables`. El WebSocket usa el
puerto 443 detrás del proxy del proveedor.

## Límites y juego responsable

Los diamantes son una moneda virtual sin retiro. Antes de publicar el casino en
Google Play hay que cumplir su política de apuestas y juegos sociales: mayoría
de edad, límites, autoexclusión y ningún canje por dinero. Este servicio ya
aplica topes por mano y por día; la pantalla debe mostrar el saldo, el límite y
una forma de cerrar el casino.
