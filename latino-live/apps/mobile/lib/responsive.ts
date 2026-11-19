/**
 * El ancho de una columna de teléfono.
 *
 * La app se pensó para el teléfono, donde ocupa todo el ancho. En una tablet,
 * un plegable abierto o una ventana de escritorio, dejar que todo crezca de
 * borde a borde estira los asientos y deja el chat como una franja: la sala
 * deja de leerse. Pasado este ancho, la columna se centra y el fondo sigue
 * llegando a los bordes.
 */
export const CONTENT_MAX = 480;

/** La cartelera de salas: dos tarjetas por fila piden algo más de aire. */
export const CATALOG_MAX = 560;

/** Un ancho que nunca pasa de [max]. */
export function capped(width: number, max = CONTENT_MAX) {
  return Math.max(0, Math.min(width, max));
}

/**
 * Cuántas tarjetas de sala caben en una fila. Dos es lo que mantiene la foto
 * legible; una pantalla enorme añade una tercera antes que estirar las dos.
 */
export function catalogColumns(width: number) {
  if (width >= 900) return 3;
  return 2;
}

/** El estilo de una columna centrada que nunca pasa de [max]. */
export function columnStyle(max = CONTENT_MAX) {
  return { width: '100%' as const, maxWidth: max, alignSelf: 'center' as const };
}
