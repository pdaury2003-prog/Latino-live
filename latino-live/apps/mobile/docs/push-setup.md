# Avisos con la app cerrada

Los avisos dentro de la app (la franja de la portada y la pantalla Avisos) ya
funcionan. Para que además lleguen al teléfono con la app cerrada hacen falta
dos piezas que dependen de una cuenta de Google, y por eso las aporta el dueño
de la app.

## 1. Proyecto de notificaciones — hecho

`push.config.json` guarda el proyecto de notificaciones que conoce el servicio
de envío:

```json
{ "easProjectId": "dfbf0f7d-0374-458b-b3bb-a3e0af7d572e" }
```

`app.config.js` lo copia a `extra.eas.projectId` en cada compilación, que es de
donde el teléfono lo lee. La prueba `tests/push-project.test.ts` avisa si el
valor desaparece o deja de ser un UUID.

## 2. Firebase — falta

**`google-services.json`** — el proyecto de Firebase con una app Android
registrada para el paquete `com.latinolivechat.app`. Se descarga en Firebase →
Configuración del proyecto → Tus apps → Android y se coloca en esta carpeta
(`apps/mobile/google-services.json`). Viaja dentro del APK, como en cualquier
app Android, así que no es un secreto de servidor.

Además, el proyecto de notificaciones necesita la clave de FCM V1 para Android:
se sube en Expo → Project settings → Credentials → Android, con la cuenta de
servicio que Firebase genera en Configuración del proyecto → Cuentas de
servicio. Sin esa clave Expo acepta la dirección del teléfono pero no puede
entregar el aviso.

## Cómo queda

En cuanto exista el archivo, `app.config.js` lo toma solo: el APK obtiene la
dirección del teléfono al abrir Avisos, la guarda en la cuenta y el servidor
manda el aviso. Sin él la configuración es exactamente `app.json`, así que la
app sigue compilando e instalándose igual.

Comprobación en el teléfono: Avisos → «Probar aviso en este teléfono». Si llega
con la app cerrada, todo está en su sitio; la misma pantalla dice qué falta si
no.
