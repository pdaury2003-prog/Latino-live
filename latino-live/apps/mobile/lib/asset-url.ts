/**
 * La misma foto, servida desde otro domicilio.
 *
 * Vive aparte de la configuración para poder probarla sola: recibe el host ya
 * escrito y devuelve el enlace con su mismo camino y sus mismos parámetros.
 */
export function normalizeHost(declared: string): string {
  const value = (declared ?? '').trim();
  if (!value) return '';
  const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withScheme.replace(/\/+$/, '');
}

/**
 * Un enlace que no es http(s) —un archivo del teléfono, por ejemplo— se queda
 * tal cual: el CDN solo sirve lo que viaja por la red.
 */
export function withAssetHost(url: string, host: string): string {
  const base = normalizeHost(host);
  if (!base || !url) return url;
  const match = /^(https?:\/\/[^/]+)(\/.*)?$/i.exec(url);
  if (!match) return url;
  return `${base}${match[2] ?? ''}`;
}
