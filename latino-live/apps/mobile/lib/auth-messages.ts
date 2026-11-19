/**
 * Supabase answers its own errors in English. These are the ones a person can
 * actually meet while entering, translated once so every screen says the same
 * thing instead of showing "Invalid login credentials" in the middle of Spanish.
 */
export function authErrorText(message: string | null | undefined): string {
  const text = (message ?? '').trim();
  if (!text) return 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.';
  if (/invalid login credentials/i.test(text)) return 'El correo o la contraseña no coinciden.';
  if (/email not confirmed/i.test(text)) return 'Tu cuenta todavía no está confirmada. Revisa el correo que te enviamos.';
  if (/already registered|already exists|user already/i.test(text)) return 'Ese correo ya tiene cuenta. Entra con tu contraseña.';
  if (/password should be at least|password is too short/i.test(text)) return 'La contraseña necesita al menos 6 caracteres.';
  if (/unable to validate email|invalid email|email address .* invalid/i.test(text)) return 'Escribe un correo válido.';
  if (/token has expired|expired|invalid token|otp/i.test(text)) return 'Ese código ya no sirve. Pide uno nuevo e inténtalo otra vez.';
  if (/rate limit|too many requests|for security purposes/i.test(text)) return 'Demasiados intentos seguidos. Espera un momento y vuelve a probar.';
  if (/network|fetch|failed to fetch|timeout/i.test(text)) return 'No pudimos conectar. Revisa tu conexión e inténtalo de nuevo.';
  if (/signups? not allowed|signup is disabled/i.test(text)) return 'Las cuentas nuevas están cerradas por ahora.';
  // A message already written in Spanish is shown as it came.
  if (/[áéíóúñ¿¡]|\b(correo|contraseña|cuenta|sesión|código)\b/i.test(text)) return text;
  return 'No se pudo completar. Revisa tu conexión e inténtalo de nuevo.';
}
