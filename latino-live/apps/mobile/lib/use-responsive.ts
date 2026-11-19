import { useWindowDimensions } from 'react-native';
import { capped } from '@/lib/responsive';

/**
 * Cómo se ve la pantalla: el ancho real, el ancho de la columna y si el
 * teléfono es pequeño o grande. Todo lo que dibuja a mano su tamaño lo pide
 * aquí en vez de usar el ancho de la ventana tal cual.
 */
export function useResponsive() {
  const { width, height } = useWindowDimensions();
  return {
    width,
    height,
    /** Un teléfono angosto: hay que apretar los espacios, no las letras. */
    compact: width < 360,
    /** Una pantalla grande: tablet, plegable abierto o escritorio. */
    wide: width >= 600,
    /** El ancho que ocupa el contenido, ya topado. */
    contentWidth: capped(width),
  };
}
