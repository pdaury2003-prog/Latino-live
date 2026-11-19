# Juegos en vivo · arquitectura

Este documento describe cómo se sincronizan las mesas de Latino Live, dónde se
mueven los diamantes y qué necesita el arte generado con IA para verse como un
solo producto. El código vive en `packages/games` (reglas), `server` (tiempo
real) y `supabase/migrations/0098_games_engine.sql` (dinero y permisos).

## 1. Principios

1. **Una sola base y una sola billetera.** El proyecto ya tiene Supabase,
   `profiles.diamonds`, regalos y salas. No se crea otra base, otro usuario ni
   otro saldo. El servidor de juegos es una puerta de entrada, no un segundo
   backend de datos.
2. **El teléfono propone, el servidor decide.** La app manda una acción
   (`move`, `play`, `raise`); el motor la valida y el servidor la guarda. Ningún
   cliente calcula un premio, un turno ni una carta.
3. **El dinero se mueve en una transacción.** Las funciones
   `game_charge` / `game_credit` bloquean la fila del perfil (`for update`),
   comprueban saldo y tope diario, y dejan un asiento en el libro mayor.
4. **Público y privado son canales distintos.** Una mesa de salón se difunde a
   la sala; el casino viaja solo al teléfono del jugador.
5. **El motor es puro.** `packages/games` no importa React, Supabase ni el
   reloj: recibe un estado, una acción y una función de azar, y devuelve un
   estado nuevo. Eso permite probarlo y repetir una mano.

## 2. Piezas

```
app Android / web
   │  Supabase (sesión, perfiles, salas, asientos, voz)
   │
   ├── WebSocket  wss://games/ws   ──►  server (Node 22 + ws)
   │                                      │  JWT de Supabase
   │                                      │  GameService (mesas, cobros)
   │                                      │  GameHub (canales, presencia)
   │                                      │
   │                                      └── packages/games (reglas)
   │
   └── Postgres (Supabase)
          game_tables · game_bets · game_wallet_entries · game_settings
          game_charge() · game_credit() · game_open_table() · game_save_table()
```

- **`packages/games`**: ajedrez, damas, ludo, dominó, tragamonedas, póker,
  ruleta y blackjack. Cada juego expone el mismo contrato:
  `create`, `apply`, `view`, `settlement`, `isOver`, `legalActions`.
- **`server`**: autentica, difunde, persiste y cobra. También sirve de respaldo
  cuando se despliega en varias regiones.
- **Supabase**: sigue siendo la verdad de las cuentas, la sala y los diamantes.
  `game_tables` se añade a la publicación de Realtime para que la app pueda
  reaccionar aunque el WebSocket parpadee.

## 3. Catálogo y reglas

| Juego | Módulo | Reglas cubiertas | Visibilidad |
| --- | --- | --- | --- |
| Ajedrez | `src/chess.ts` | jaque, mate, ahogado, enroque, al paso, promoción, 50 jugadas, triple repetición, material insuficiente | sala |
| Damas | `src/checkers.ts` | damas españolas, captura obligatoria, cadena completa, dama voladora, coronación | sala |
| Ludo | `src/ludo.ts` | 4 fichas, salida con 6, 52 casillas, calle de 6, meta exacta, casillas seguras, captura, tres seises | sala |
| Dominó | `src/domino.ts` | doble seis, manos privadas, entrada por extremos, robo, pase, tranca y puntos | sala |
| Tragamonedas | `src/casino/slots.ts` | 3×3, 5 líneas, tabla de pagos, RTP 93,6 % | privada |
| Póker | `src/casino/poker.ts` | Hold'em sin límite, ciegas, subidas mínimas, all-in, botes laterales, evaluador de 7 cartas | privada (mesa de jugadores) |
| Ruleta | `src/casino/roulette.ts` | ruleta europea, pleno, color, par/impar, alto/bajo, docena, columna | privada |
| Blackjack | `src/casino/blackjack.ts` | zapato de 6 barajas, as blando, crupier en 17, 3:2, doblar | privada |

Las pruebas están en `packages/games/tests` (54) y `server/tests` (13). Cubren
movimientos ilegales, capturas, trancas, pagos, botes laterales y el reparto de
cartas ocultas.

## 4. Dinero

### Contrato

- Se cobra **lo apostado acumulado** por mesa y persona, no cada incremento.
  `game_charge(table, user, total)` resta solo la diferencia y guarda
  `game_bets.charged`; repetir la llamada no cobra dos veces.
- Se paga **el premio acumulado**. `game_credit(table, user, total)` acredita
  solo la diferencia y guarda `game_bets.credited`.
- Si una jugada se rechaza, no se cobra. Si la versión de la mesa cambió, la
  jugada no se guarda.
- El resultado que ve la app es `premio - apuesta`; la billetera recibe el
  premio y la parte no jugada vuelve por el mismo camino.

### Secuencia de una mano

```
app            server                 motor              Postgres
 │  create ───►  │                      │                   │
 │               │  create(state) ─────►│                   │
 │               │◄──── estado inicial ─┘                   │
 │               │  game_open_table ──────────────────────► │ (fila)
 │               │  game_charge(total apostado) ──────────► │ (bloqueo + saldo)
 │               │  game_save_table(version 0) ───────────► │
 │◄── estado ────│                      │                   │
 │  action ─────►│  apply(state, acción)│                   │
 │               │◄──── estado nuevo ───┘                   │
 │               │  game_save_table(version n) ───────────► │
 │               │  game_charge(nueva apuesta) ────────────► │
 │               │  si terminó: game_credit(premio) ───────► │
 │◄── estado ────│                      │                   │
```

### Límites

`game_settings` define `min_bet`, `max_bet` y `max_daily` (1 / 5.000 / 20.000
por defecto). El tope diario se calcula con las entradas `bet` del día. La app
debe mostrar el saldo y el límite antes de apostar. Los diamantes son una
moneda virtual sin retiro; no se convierten en dinero.

### Idempotencia y recuperación

- `game_bets (table_id, user_id)` es la memoria de cuánto se cobró y pagó.
- Si el proceso se cae después de guardar y antes de pagar, `GameService.sweep`
  reintenta el premio cada minuto.
- Para escalar a varias instancias hace falta un almacén compartido de mesas
  (Redis o similar) o sesiones pegajosas; el estado también queda en
  `game_tables.state` para reconstruir.

## 5. Tiempo real

### Canales

- `room:<roomId>`: presencia y mesas de salón. Entra quien esté sentado en la
  sala o su anfitrión; el servidor lo comprueba contra `room_seats`.
- `casino:<userId>`: no se difunde. Solo las conexiones de ese jugador reciben
  su estado. En el póker, cada jugador recibe su propia vista de la misma mesa.

### Mensajes

La app envía `hello`, `room.join`, `room.leave`, `table.create`, `table.ready`,
`table.action`, `table.get`, `table.list` y `ping`. El servidor responde `ready`,
`table.state`, `table.list`, `presence`, `error` y `pong`.

Reglas del canal:

- Token de Supabase obligatorio; el token no se guarda en claro.
- 40 mensajes cada 10 s por conexión; 32 KB por mensaje.
- Latido cada 30 s; una conexión que no responde se cierra.
- Reintento con espera exponencial en la app (0,5 s → 1 s → 2 s → 5 s).
- Si el WebSocket no está disponible, la app puede leer `game_tables` por
  Realtime y volver a pedir `table.get` al reconectar.

### Privacidad

`viewGame` recorta el estado antes de enviarlo:

- Dominó: solo la mano propia; los rivales muestran `handCounts`.
- Póker: solo las cartas propias hasta el showdown; el mazo nunca sale.
- Blackjack: la carta tapada del crupier no viaja hasta que termina la mano.
- Ruleta y tragamonedas: son de una sola persona y no se difunden.

## 6. Herramientas de generación visual con IA

El objetivo es que mesas, fichas, cartas e interfaz parezcan el mismo producto,
no ocho estilos distintos. Estas son las condiciones de entrega.

### Biblia de estilo

- **Paleta fija** (la de `DESIGN.md`): fondo noche `#080607`, tarjeta
  `#171113`, oro `#FFC24B`, texto `#FFFFFF`; modo claro `#F1EFEA`, tarjeta
  `#FFFFFF`, oro `#8A5B08`, texto `#111111`. El arte no introduce verdes de
  casino, rojos de alarma ni neones ajenos.
- **Un solo punto de vista**: tableros en picado 3/4 (60°), fichas de frente,
  cartas ligeramente inclinadas. Nada de mezclar perspectiva isométrica con
  plana en la misma mesa.
- **Una sola luz**: foco cálido superior izquierdo, sombra suave inferior
  derecha. Los reflejos son dorados, nunca azules.
- **Materiales**: madera oscura, fieltro negro, metal dorado, cristal ahumado.
  Sin plástico brillante ni degradados de arcoíris.
- **Semilla y referencia**: cada lote parte de la misma imagen de referencia y
  de la misma semilla; se guarda la semilla en el nombre del archivo.

### Entregables por juego

| Pieza | Tamaño | Formato | Notas |
| --- | --- | --- | --- |
| Tablero de ajedrez/damas | 2048×2048 | WEBP q90 | 8×8, casillas alineadas al píxel, sin texto |
| Tablero de ludo | 2048×2048 | WEBP q90 | 52 casillas + 4 calles, estrella segura visible |
| Mesa de dominó | 2048×1024 | WEBP q90 | fieltro, sin fichas dibujadas |
| Fichas de ajedrez | 256×256 | PNG/WEBP alfa | 2 colores, silueta legible a 24 px |
| Fichas de damas | 256×256 | PNG/WEBP alfa | 2 colores + corona para dama |
| Fichas de ludo | 192×192 | PNG/WEBP alfa | 4 colores accesibles, misma silueta |
| Dominó | 512×256 | PNG/WEBP alfa | 0–6, puntos grabados, dorso común |
| Cartas | 512×716 | PNG/WEBP | 52 + dorso, índice en la esquina |
| Paños y paneles | 512×512 | WEBP | 9-slice, radio 24, borde 1 px |
| Botones | 3 estados | WEBP | normal, pulsado, deshabilitado |
| Fichas de apuesta | 128×128 | PNG alfa | 1, 5, 10, 50, 100 |
| Efectos | 512×512 | sprite sheet 8–12 | triunfo, línea, carta, dado |
| Sonidos de interfaz | ≤ 1 s | OGG mono | toque, ficha, carta, dado |
| Ambiente de casino | 8–12 s loop | OGG | sin voces, sin melodía pegajosa |
| Ganar/perder | 1,5–3 s | OGG | campanas doradas / golpe seco |

### Nombres y carpetas

```
assets/games/<juego>/
  board.webp
  piece-white.webp · piece-black.webp
  token-red.webp · token-blue.webp · token-green.webp · token-yellow.webp
  tile-6-6.webp · tile-back.webp
  card-AS.webp · card-back.webp
  ui-panel-9.webp · ui-button-9.webp
  fx-win.json · fx-roll.json
  sfx-tap.ogg · sfx-dice.ogg · sfx-win.ogg
```

### Control de calidad

- Silueta: cada ficha se reconoce en blanco y negro a 24 px.
- Contraste: texto e iconos ≥ 4,5:1; el color nunca es la única señal (las
  fichas de ludo llevan forma o marca además del color).
- 1× y 2×: nada de texto rasterizado; los números van en la interfaz, no en el
  arte.
- Seguro: 12 % de margen en tableros y paneles para recortes redondos.
- Peso: ≤ 300 KB por pieza, ≤ 1,5 MB por tablero, ≤ 2 MB por efecto.
- Nada de logotipos reales, caras de famosos, billetes ni símbolos de dinero
  real. La moneda es el diamante de la app.

### Plantilla de petición

> «Tablero de [juego] para una app de sala latina, picado 3/4 a 60°, madera
> oscura y fieltro negro, detalles en oro `#FFC24B`, luz cálida superior
> izquierda, sombra suave, sin texto, sin logotipos, fondo transparente donde
> aplique, consistente con la referencia adjunta, semilla [n]».

## 7. Despliegue y latencia

- Contenedor Node 22 (`server/Dockerfile`), puerto 8787, salud en `/health`.
- Regiones recomendadas: EE. UU. este, Europa oeste y Sudamérica; el jugador
  entra por la más cercana (DNS geográfico o anycast del proveedor).
- TLS y WebSocket en 443. Si el proveedor no mantiene la conexión, la app
  reintenta y recupera el estado con `table.get`.
- Presupuesto: acción → difusión < 150 ms p95 en la misma región y < 350 ms
  entre continentes. La voz sigue por WebRTC/TURN, no por este servidor.
- Métricas: conexiones, mesas activas, p95 de acción, cobros rechazados,
  premios pendientes y reconexiones.
- Una instancia por región al empezar; para más, sesiones pegajosas o un
  adaptador de salas compartido.

## 8. Seguridad y juego responsable

- RLS: las mesas de salón se leen solo desde la sala; las privadas solo por su
  dueño; el libro mayor solo por su persona. Insertar o cambiar mesas y saldos
  está revocado para `anon` y `authenticated`.
- El servidor usa la llave de servicio solo del lado del servidor. Sin ella el
  casino se apaga y quedan los juegos de salón.
- Límite por mano y por día; sin retiro de diamantes; sin apuestas entre
  personas.
- Antes de publicar en Google Play: política de apuestas y juegos sociales,
  verificación de edad, autoexclusión y textos claros de que la moneda es
  virtual. La app debe mostrar el saldo, el límite y un botón para cerrar el
  casino.
- Auditoría: `game_wallet_entries` guarda cada movimiento con saldo posterior;
  `game_tables.version` detecta escrituras simultáneas.

## 9. Estado actual y siguientes pasos

Hecho en este cambio:

- Motor con ocho juegos y 54 pruebas.
- Servidor WebSocket con autenticación, presencia, canales públicos/privados,
  latido, límites y persistencia.
- Migración aplicada con mesas, libro mayor y funciones transaccionales.
- Prueba de humo con dos conexiones reales y una jugada de ajedrez.

Pendiente para que se juegue desde la app:

1. Pantalla de juego que abra el WebSocket y dibuje el estado (empezando por
   ajedrez y dominó, que ya tienen mesa y reglas).
2. Desplegar `server` en una región y poner su URL en la configuración pública.
3. Pantalla de casino con saldo, límite, confirmación de apuesta y el canal
   privado.
4. Generar el primer lote de arte con la biblia de la sección 6 y medirlo con
   el control de calidad.
