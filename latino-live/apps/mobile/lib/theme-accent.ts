import { useDesignTheme } from '@/features/design-theme';

/**
 * Los dos modos comparten la misma estructura: mismos altos, mismos bordes y la
 * misma jerarquía de texto. Cada uno aporta su luz, y las pantallas que dibujan
 * su color a mano lo piden aquí en vez de fijar un dorado o un blanco.
 */
export type Accent = {
  /** La acción principal: botones, saldo, anillo de quien habla. */
  main: string;
  /** El texto o icono que va encima de [main]. */
  ink: string;
  /** Un segundo tono vivo para avisos y destellos. */
  warm: string;
  /** El mismo acento rebajado, para fondos suaves. */
  wash: string;
  /** El acento como borde fino, para marcos y carteles. */
  edge: string;
  /** El día usa papel y tinta; la noche, su fondo oscuro. */
  light: boolean;
  /** El fondo de la pantalla que dibuja su propio color. */
  surface: string;
  /** El texto corrido sobre [surface]. */
  text: string;
  /** El texto secundario sobre [surface]. */
  muted: string;
  /** Una tarjeta o pastilla sobre [surface]. */
  raised: string;
  /** La línea fina que separa tarjetas sobre [surface]. */
  hairline: string;
  /** El borde visible de una tarjeta: la separación se lee por la línea. */
  line: string;
};

export const NIGHT_ACCENT: Accent = {
  main: '#FFC24B',
  ink: '#2A1B06',
  warm: '#FF7A5C',
  wash: 'rgba(255,194,75,0.16)',
  edge: 'rgba(255,194,75,0.42)',
  light: false,
  surface: '#080607',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.78)',
  raised: '#171113',
  hairline: 'rgba(255,255,255,0.18)',
  line: '#3D2B2D',
};

/** El modo de día: gris muy suave, tarjetas blancas, tinta negra y oro. */
export const DAY_ACCENT: Accent = {
  main: '#8A5B08',
  ink: '#FFF9EC',
  warm: '#A8620C',
  wash: 'rgba(185,145,59,0.16)',
  edge: 'rgba(138,91,8,0.34)',
  light: true,
  surface: '#F1EFEA',
  text: '#121110',
  muted: '#5A5348',
  raised: '#FFFFFF',
  hairline: '#DCD7CC',
  line: '#DCD7CC',
};

export function useAccent(): Accent {
  const { colorScheme } = useDesignTheme();
  return colorScheme === 'light' ? DAY_ACCENT : NIGHT_ACCENT;
}
