---
schema: spk.product.v1
screens:
  - id: salas
    title: Salas en vivo
    path: /
    requirements:
      - salas
  - id: sala
    title: Sala de voz
    path: /room/[id]
    previewPath: /room/fiesta-nocturna
    requirements:
      - sala
      - asientos
      - chat
      - regalos
      - controles
flows:
  - id: entrar
    from: salas
    to: sala
    action: Tocar una sala en vivo
  - id: volver
    from: sala
    to: salas
    action: Cerrar la sala
requirements:
  - id: salas
    title: Cartelera de salas en vivo con saldo y eventos
    scope: included
  - id: sala
    title: Sala de voz con asientos, chat, regalos y controles del dueño
    scope: included
  - id: asientos
    title: Mover de asiento y ampliar asientos en tiempo real
    scope: included
  - id: chat
    title: Chat compartido de la sala con un máximo de 20 mensajes
    scope: included
  - id: regalos
    title: Enviar regalos visibles para toda la sala
    scope: included
  - id: controles
    title: Silenciar, expulsar y anunciar como dueño de la sala
    scope: included
  - id: perfil
    title: Foto de perfil y portada desde el móvil
    scope: later
---

# Latino Live

App de salas de voz en vivo para una comunidad hispanohablante, en español. Las
monedas de la sala se muestran en oro y diamantes como unidades internas.

Las personas entran a una sala, ocupan un asiento para hablar, conversan en un
chat común de toda la sala, envían regalos y el dueño modera la sala en directo.
