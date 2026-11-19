/**
 * El sexo que la persona elige en su perfil. Se guarda en la cuenta para que
 * la sala y la ficha de perfil lo muestren sin preguntarlo otra vez.
 *
 * Vacío es «sin decir»: nadie está obligado a elegirlo, y una cuenta nueva
 * empieza así.
 */
export type Gender = '' | 'mujer' | 'hombre' | 'otro';

export type GenderOption = { key: Exclude<Gender, ''>; label: string };

export const GENDERS: GenderOption[] = [
  { key: 'mujer', label: 'Mujer' },
  { key: 'hombre', label: 'Hombre' },
  { key: 'otro', label: 'Otro' },
];

/** Mantiene lo que llegue del servidor dentro de los tres valores. */
export function asGender(value: string | null | undefined): Gender {
  return value === 'mujer' || value === 'hombre' || value === 'otro' ? value : '';
}

/** La etiqueta que se lee en el perfil, o null si no lo dijo. */
export function genderOf(value: string | null | undefined): GenderOption | null {
  const key = asGender(value);
  if (!key) return null;
  return GENDERS.find(item => item.key === key) ?? null;
}

/** El nombre visible nunca pasa de quince letras, en toda la app. */
export const NAME_MAX = 15;

/**
 * Lo que viaja con el alta de la cuenta. Solo salen los tres valores válidos:
 * el servidor copia este dato al perfil en cuanto la cuenta nace, y un texto
 * libre nunca llega a la base de datos.
 */
export function genderPayload(value: string | null | undefined): { gender: Gender } | null {
  const key = asGender(value);
  return key ? { gender: key } : null;
}
