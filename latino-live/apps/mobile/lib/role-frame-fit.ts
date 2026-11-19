import type { BadgeKind } from '@/lib/badges';

/**
 * La ventana de cada marco, medida sobre el arte que entregó la casa. No es un
 * círculo: el arte la dibuja algo más ancha que alta, y con una medida redonda
 * la cara quedaba pequeña y flotando dentro del metal.
 */
export type RoleFrameFit = {
  /** Ancho del hueco: es el diámetro de la foto, que siempre es redonda. */
  openingWidth: number;
  /** Alto del hueco; sirve para saber cuánto metal tapa la foto. */
  openingHeight: number;
  /** Centro de la ventana, como parte del ancho y del alto del arte. */
  cx: number;
  cy: number;
};

export const ROLE_FRAME_FIT: Record<BadgeKind, RoleFrameFit> = {
  owner: { openingWidth: 0.7, openingHeight: 0.559, cx: 0.4975, cy: 0.485 },
  'super-admin': { openingWidth: 0.435, openingHeight: 0.425, cx: 0.5025, cy: 0.49 },
  agency: { openingWidth: 0.68, openingHeight: 0.583, cx: 0.4975, cy: 0.5025 },
  official: { openingWidth: 0.66, openingHeight: 0.515, cx: 0.5, cy: 0.4675 },
  host: { openingWidth: 0.665, openingHeight: 0.467, cx: 0.5, cy: 0.49 },
  cs: { openingWidth: 0.45, openingHeight: 0.45, cx: 0.49, cy: 0.465 },
};


/** El centro y el tamaño de la ventana de la foto, en puntos. */
export function frameFace(kind: BadgeKind, size: number) {
  const fit = ROLE_FRAME_FIT[kind];
  const width = size * fit.openingWidth;
  return {
    cx: size * fit.cx,
    cy: size * fit.cy,
    radius: width / 2,
    width,
    /** La foto es redonda; el alto solo dice cuánto metal la cubre. */
    height: width,
  };
}

/**
 * Dónde va el botón de la cámara: sobre el borde de la cara, abajo a la
 * derecha, nunca sobre las alas del marco ni fuera de la foto.
 */
export function frameCameraSpot(kind: BadgeKind, size: number, badge = 24) {
  const face = frameFace(kind, size);
  const angle = Math.PI / 4;
  return {
    x: face.cx + Math.cos(angle) * face.radius - badge / 2,
    y: face.cy + Math.sin(angle) * face.radius - badge / 2,
  };
}
