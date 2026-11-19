# Publicar en Google Play con tu cuenta

Esta app se compila y se firma con tu cuenta de Expo, así que el paquete que
llega a Play es tuyo: `com.latinolivechat.app`. Es distinto del paquete que
entrega la plataforma al instalar desde el enlace, y por eso las dos versiones
no se actualizan entre sí.

## Lo que necesitas, una sola vez

- Cuenta de Expo (gratis) y `eas-cli`, que se usa sin instalar nada:
  `npx eas-cli@latest`.
- Cuenta de desarrollador de Google Play (pago único de 25 USD) con tu
  identidad verificada.
- Un proyecto de Firebase para los avisos con la app cerrada.

## 1. Las llaves del servidor

La app necesita saber a qué servidor entrar. No hay que configurar nada: si la
compilación no trae la dirección, la app lee el archivo público del proyecto
(`https://latino-live.exaspark.app/spk-runtime-config.js`), el mismo que ya
recibe cualquier navegador que abre el sitio, y con eso entra a las salas.

Si prefieres fijarla dentro del paquete, estos son los dos valores:

| Variable | Qué es |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | la dirección del servidor del proyecto |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | la llave pública de la app |

Están en la nube del proyecto (Cloud → Keys); la llave pública no da acceso a
datos ajenos porque cada tabla tiene sus reglas de acceso. Guárdalos en tu
cuenta de Expo:

```sh
npx eas-cli@latest login
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value "<la dirección>" --visibility plaintext
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "<la llave pública>" --visibility sensitive
```

Opcional, solo si quieres que las salas crucen redes que bloquean la conexión
directa: `EXPO_PUBLIC_TURN_URL`, `EXPO_PUBLIC_TURN_USERNAME` y
`EXPO_PUBLIC_TURN_CREDENTIAL`, con los datos de tu relay.

Sin ellas la app igual funciona: las lee del archivo público al abrir. Solo
necesita conexión la primera vez que se abre en cada teléfono.

## 2. Los avisos con la app cerrada

En Firebase, crea un proyecto y dentro «Agregar app → Android» con el paquete
**`com.latinolivechat.app`**. Descarga `google-services.json` y colócalo en
`apps/mobile/`. La configuración lo toma sola.

Después crea `apps/mobile/push.config.json` con el identificador del proyecto
de notificaciones:

```json
{ "easProjectId": "<el id que te da Expo al inicializar el proyecto>" }
```

## 3. Tu primer paquete

```sh
cd apps/mobile
npx eas-cli@latest init          # enlaza esta carpeta con tu cuenta de Expo
npx eas-cli@latest build --platform android --profile production
```

La primera vez EAS te ofrece crear la llave de firma: acepta y **guarda el
archivo `.jks` y su contraseña**. Esa llave es la identidad de tu app en Play;
si se pierde, no se pueden publicar actualizaciones.

El perfil `production` genera un **`.aab`**, que es lo que Play acepta, y sube
el número de versión solo en cada compilación. El perfil `preview` genera un
**`.apk`** para probar en un teléfono antes de subir nada:

```sh
npx eas-cli@latest build --platform android --profile preview
```

### Si Play dice «needs to have the package name com.latinolivechat.app»

Ese mensaje significa que el archivo subido lo generó otra herramienta y lleva
otro paquete (por ejemplo `ai.exaspark.app.p15d7574…`). Play exige que el
paquete del archivo sea exactamente el de la ficha. La solución es subir el
`.aab` que produce el comando de arriba, no el de la plataforma: descarta el
borrador rechazado en Play Console y sube el nuevo archivo.

### Comprobar un `.aab` antes de subirlo

La app trae su propia comprobación, sin instalar nada más:

```sh
cd apps/mobile
npm run check:aab -- "../Latino live.aab"
```

Dice el paquete que lleva dentro, si trae el código de la app y si ese paquete
es el de tu ficha. Si el archivo es el de la plataforma, lo nombra y te dice
que generes el tuyo. Con `--expect otros.paquete` se comprueba otra ficha.

## 4. La ficha en Play Console

1. «Crear aplicación» e introduce el nombre **Latino Live**. El identificador
   que pide Play es exactamente `com.latinolivechat.app`: no se puede cambiar
   después, así que revísalo antes de confirmar.
2. Ficha de la tienda: descripción corta y larga, ícono de 512×512, imagen
   destacada de 1024×500 y al menos dos capturas de teléfono. La app ya trae
   ícono e imágenes en `assets/`.
3. Política de privacidad: `https://latino-live.exaspark.app/privacidad`.
4. Seguridad de los datos: declara correo, fotos, mensajes y audio; la política
   ya explica que el audio y el video no se graban.
5. Clasificación de contenido y público objetivo. La app no es para menores de
   13 años.
6. Eliminación de cuenta: la app ya la ofrece en Perfil → Ajustes, y la política
   indica la ruta; Play pide esa misma información en el formulario.
7. Sube el `.aab` en «Producción» o empieza por «Prueba interna».

Si tu cuenta de desarrollador es personal y nueva, Play exige una prueba
cerrada con al menos 12 probadores durante 14 días antes de habilitar la
publicación abierta.

## 5. Lo que falta antes de enviar a revisión

Las recargas dentro de la app ya se cobran con **Google Play Billing**. En el
`.aab` de `production`, `eas.json` activa `EXPO_PUBLIC_STORE_BUILD=true` y
apaga la recarga con tarjeta (`EXPO_PUBLIC_ENABLE_TOPUP=false`); la billetera
muestra los paquetes con el precio que Play le da a cada persona. El `.apk` de
`preview` y la versión del enlace directo siguen cobrando con tarjeta, porque
Play Billing solo funciona en una app instalada por Play.

### Los cuatro productos en Play Console

En Play Console → Monetizar con Play → Productos → Productos integrados en la
app, crea uno por paquete con estos identificadores exactos:

| Identificador | Diamantes | Precio |
|---|---|---|
| `diamonds_100` | 100 | 0,99 USD |
| `diamonds_500` | 500 | 4,99 USD |
| `diamonds_1200` | 1.200 | 9,99 USD |
| `diamonds_3000` | 3.000 | 19,99 USD |

El precio de cada país lo pone Play solo. El identificador debe ser idéntico:
la app pide esos cuatro y el servidor no acredita ningún otro.

### La cuenta de servicio que comprueba cada compra

El teléfono nunca decide si una compra es real: el servidor pregunta a Google.
Para eso hace falta una cuenta de servicio:

1. En Google Cloud Console, crea un proyecto (o usa el mismo de Play), activa
   **Google Play Android Developer API** y crea una cuenta de servicio.
2. Crea una llave JSON para esa cuenta y descárgala.
3. En Play Console → Usuarios y permisos, invita el correo de la cuenta de
   servicio con permiso para **ver datos financieros, pedidos y cancelaciones**.
4. Guarda el contenido completo del archivo JSON en Cloud → Keys con el nombre
   `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.

Si el paquete no es `com.latinolivechat.app`, agrega también
`GOOGLE_PLAY_PACKAGE` con el identificador real.

Mientras esa llave no exista, la app dice con claridad que la recarga todavía
no está abierta; no cobra nada.

## Actualizaciones

Cada cambio de código necesita una compilación nueva con el perfil
`production` y subir su `.aab`. `eas.json` incrementa el número de versión
solo; el nombre de la versión (`version` en `app.json`) lo subes tú cuando
quieras, por ejemplo a `1.1.0`.

No cambies el paquete `com.latinolivechat.app` después de crear la ficha: Play
lo trata como otra app y los usuarios tendrían que desinstalar e instalar de
nuevo.
