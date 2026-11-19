/**
 * El aviso que ve la persona cuando un cambio de asiento no se pudo hacer.
 *
 * La base responde en español para los casos que conoce (ocupado, con candado,
 * sala cerrada). Pero una carrera entre dos teléfonos puede devolver un error
 * técnico de Postgres ("duplicate key value violates unique constraint…"), y
 * eso no se le enseña a nadie: se convierte en una frase clara.
 */
export function seatErrorText(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : '';
  if (!raw) return 'No pudimos moverte de asiento';
  if (/ocupad|unique|duplicate|conflict|constraint/i.test(raw)) {
    return 'Ese asiento acaba de ocuparse. Elige otro.';
  }
  if (/candado/i.test(raw)) return 'El anfitrión cerró ese asiento.';
  if (/sesi[oó]n/i.test(raw)) return 'Vuelve a entrar para sentarte.';
  if (/sala ya no existe|sala se cerr/i.test(raw)) return 'La sala se cerró.';
  return raw;
}
