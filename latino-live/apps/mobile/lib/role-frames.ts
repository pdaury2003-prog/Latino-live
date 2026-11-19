import type { BadgeKind } from '@/lib/badges';
import { ROLE_FRAME_FIT, type RoleFrameFit } from '@/lib/role-frame-fit';

export { frameCameraSpot, frameFace, ROLE_FRAME_FIT } from '@/lib/role-frame-fit';

/**
 * El marco de cada rol, con el arte de la casa y las medidas de su ventana.
 * La foto se coloca en la abertura y el metal se dibuja encima, así que la
 * cara queda entera y el marco nunca la recorta.
 */
export type RoleFrameArt = {
  source: number;
  /** La ventana de la foto: ancho, alto y centro, medidos sobre el arte. */
  fit: RoleFrameFit;
  /** Colores del rol: borde, brillo y destello. */
  colors: [string, string, string];
  /** El nombre de la placa que trae el arte, para el lector de pantalla. */
  label: string;
  /**
   * Dibuja la foto sobre el arte. El marco de CS trae una «S» de luz cruzando
   * la ventana, y encima taparía la cara.
   */
  photoOnTop?: boolean;
};

export const ROLE_FRAME_ART: Record<BadgeKind, RoleFrameArt> = {
  owner: {
    source: require('@/assets/roles/frames/owner.webp'),
    fit: ROLE_FRAME_FIT.owner,
    colors: ['#FFB347', '#D44A1E', '#FFF0C4'],
    label: 'Marco de Manager',
  },
  'super-admin': {
    source: require('@/assets/roles/frames/super-admin.webp'),
    fit: ROLE_FRAME_FIT['super-admin'],
    colors: ['#FF5A78', '#B3122F', '#FFE6B0'],
    label: 'Marco de Super Admin',
  },
  agency: {
    source: require('@/assets/roles/frames/agency.webp'),
    fit: ROLE_FRAME_FIT.agency,
    colors: ['#7CC6FF', '#1F4FB8', '#EAF6FF'],
    label: 'Marco de Agencia',
  },
  official: {
    source: require('@/assets/roles/frames/official.webp'),
    fit: ROLE_FRAME_FIT.official,
    colors: ['#6FE3A8', '#1C7A4E', '#E9FFF2'],
    label: 'Marco de Oficial',
  },
  host: {
    source: require('@/assets/roles/frames/host.webp'),
    fit: ROLE_FRAME_FIT.host,
    colors: ['#9BE86A', '#2F8A3C', '#FFF6C9'],
    label: 'Marco de Host',
  },
  cs: {
    source: require('@/assets/roles/frames/cs.webp'),
    fit: ROLE_FRAME_FIT.cs,
    colors: ['#FF8A5C', '#C01B2B', '#FFE9B8'],
    label: 'Marco de Atención al cliente',
    photoOnTop: true,
  },
};
