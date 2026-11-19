---
schema: spk.design.v1
name: Latino Live Salas de Voz
defaultTheme: dark
brand: { primary: '#FFC24B' }
themes:
  light: { background: '#F1EFEA', foreground: '#121110', card: '#FFFFFF', 'card-foreground': '#121110', popover: '#FFFFFF', 'popover-foreground': '#121110', primary: '#8A5B08', 'primary-foreground': '#FFF9EC', secondary: '#FFFFFF', 'secondary-foreground': '#121110', muted: '#E9E5DD', 'muted-foreground': '#5A5348', accent: '#F6ECD6', 'accent-foreground': '#3A2A08', destructive: '#B3261E', 'destructive-foreground': '#FFF6F5', success: '#1B6E4E', 'success-foreground': '#F1FFF9', warning: '#9A5508', 'warning-foreground': '#FFF8EF', border: '#DCD7CC', input: '#DCD7CC', ring: '#8A5B08', 'chart-1': '#8A5B08', 'chart-2': '#A8620C', 'chart-3': '#1B6E4E', 'chart-4': '#B9913B', 'chart-5': '#7A6337', 'sidebar-background': '#FFFFFF', 'sidebar-foreground': '#121110', 'sidebar-primary': '#8A5B08', 'sidebar-primary-foreground': '#FFF9EC', 'sidebar-accent': '#F6ECD6', 'sidebar-accent-foreground': '#3A2A08', 'sidebar-border': '#DCD7CC', 'sidebar-ring': '#8A5B08' }
  dark: { background: '#080607', foreground: '#FFFFFF', card: '#171113', 'card-foreground': '#FFFFFF', popover: '#171113', 'popover-foreground': '#FFFFFF', primary: '#FFC24B', 'primary-foreground': '#2A1B06', secondary: '#221418', 'secondary-foreground': '#FFFFFF', muted: '#1E1417', 'muted-foreground': '#D8C9BE', accent: '#33201F', 'accent-foreground': '#FFFFFF', destructive: '#FF6B6B', 'destructive-foreground': '#2A0708', success: '#3FE0B4', 'success-foreground': '#04211A', warning: '#FF8A3D', 'warning-foreground': '#2A1505', border: '#3D2B2D', input: '#3D2B2D', ring: '#FFC24B', 'chart-1': '#FFC24B', 'chart-2': '#FF7A5C', 'chart-3': '#3FE0B4', 'chart-4': '#FFD98A', 'chart-5': '#FFA0B8', 'sidebar-background': '#171113', 'sidebar-foreground': '#FFFFFF', 'sidebar-primary': '#FFC24B', 'sidebar-primary-foreground': '#2A1B06', 'sidebar-accent': '#33201F', 'sidebar-accent-foreground': '#FFFFFF', 'sidebar-border': '#3D2B2D', 'sidebar-ring': '#FFC24B' }
typography:
  body: { family: [Geist], size: 15px, weight: 400, lineHeight: 1.5 }
  heading: { family: [Geist], size: 28px, weight: 600, lineHeight: 1.15 }
radius: { sm: 8px, md: 12px, lg: 20px, full: 9999px }
spacing: { control: 8px, panel: 16px, section: 32px }
layout: { contentMaxWidth: 480px }
---

# Latino Live

Salas de voz nocturnas para una comunidad hispanohablante. La app se usa de
noche, con el teléfono en la mano: fondo casi negro con una brasa cálida dentro,
superficies de ciruela tostada y un acento ámbar encendido que marca la acción,
la presencia en vivo y los brillos de la sala.

La primera pantalla es una cartelera de salas en vivo: marca, saldo, eventos y
una rejilla de salas con su anfitrión. La segunda es la sala: asientos
circulares, chat continuo y controles del dueño en hojas que suben desde abajo.

El ámbar encendido (`#FFC24B`) se usa con moderación —el botón principal, el
número del saldo, el anillo de quien está hablando— y nunca como texto largo. A
su lado trabaja un coral vivo (`#FF7A5C`) en los avisos y los destellos. Las
tarjetas se separan con una línea cálida de un paso, no con sombras fuertes. Las
animaciones son cortas (150–250 ms) y responden a la mano.

## Dos modos, una misma estructura

Los dos modos comparten la misma rejilla, los mismos altos de tarjeta, los mismos
bordes y la misma jerarquía de texto. Lo único que cambia es la luz.

- **Modo oscuro.** Fondo negro profundo (`#080607`), tarjetas de ciruela tostada
  (`#171113`), texto blanco puro (`#FFFFFF`) y el oro encendido (`#FFC24B`) como
  único acento. El texto secundario es blanco al 78 %, nunca gris apagado.
- **Modo claro.** Fondo gris muy suave (`#F1EFEA`), tarjetas blancas (`#FFFFFF`),
  texto casi negro (`#121110`) y oro viejo (`#8A5B08`). El gris del fondo evita
  el deslumbramiento de una pantalla blanca y deja que las tarjetas se separen
  solas; el texto secundario es `#5A5348`.

En los dos modos cada tarjeta lleva un borde visible de un paso (`#3D2B2D` de
noche, `#DCD7CC` de día): la separación se lee por la línea, no por la sombra.

## El modo claro en detalle

- Oro viejo (`#8A5B08`): la acción principal, el botón de abrir sala y la marca.
  Va con texto crema encima, para que el botón siga leyéndose como oro y no como
  un marrón apagado.
- Oro pulido (`#B9913B`): bordes finos, medallas, marcos y destellos sobre el
  blanco.
- Ámbar quemado (`#A8620C`): los avisos y el campanario.

El negro se queda para el texto y los iconos; el oro nunca se usa como texto
corrido. Las fotos de las salas llevan una capa de papel en lugar del negro
cálido. La sala en vivo conserva su fondo oscuro en los dos modos: la imagen y
la cámara mandan ahí.
