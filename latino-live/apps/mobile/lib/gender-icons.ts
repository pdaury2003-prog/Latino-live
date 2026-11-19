import type { LucideIcon } from 'lucide-react-native';
import { Mars, Venus, VenusAndMars } from 'lucide-react-native';
import type { Gender } from '@/lib/gender';

/**
 * El dibujo de cada sexo, aparte de sus nombres: así las etiquetas se pueden
 * probar sin cargar la biblioteca de iconos.
 */
export const GENDER_ICONS: Record<Exclude<Gender, ''>, LucideIcon> = {
  mujer: Venus,
  hombre: Mars,
  otro: VenusAndMars,
};
