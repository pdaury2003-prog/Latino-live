import { config } from '@/lib/config';
import { normalizeHost, withAssetHost } from '@/lib/asset-url';

/**
 * El domicilio desde el que viajan las fotos.
 *
 * Hoy las imágenes se sirven desde el almacenamiento del proyecto, que ya
 * entrega desde su red de borde. Si mañana se pone un CDN propio delante (por
 * ejemplo un dominio de Cloudflare), basta con guardar ese dominio en
 * `EXPO_PUBLIC_ASSET_HOST`: todas las fotos cambian de casa a la vez, sin
 * tocar una sola pantalla, y la app sigue funcionando igual si no se define.
 */
export function assetHost(): string {
  return normalizeHost(config.assetHost ?? '');
}

/**
 * La misma foto, servida desde el CDN propio cuando existe. Un enlace que no
 * es http(s) —un archivo del teléfono, por ejemplo— se queda tal cual.
 */
export function assetUrl(url: string, host = assetHost()): string {
  return withAssetHost(url, host);
}
