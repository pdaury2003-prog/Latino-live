import { getSupabase } from './supabase';
import type { AgencyPerson } from './agencies';

/**
 * Panel Owner: el equipo se define en la base de datos, no con una segunda
 * contraseña. Cada llamada vuelve a comprobar el rol en el servidor.
 */

export type StaffRole = 'owner' | 'admin' | 'moderator';

export const ROLE_LABEL: Record<StaffRole, string> = {
  owner: 'Dueño',
  admin: 'Administrador',
  moderator: 'Moderador',
};

export function roleRank(role: StaffRole | null | undefined): number {
  if (role === 'owner') return 3;
  if (role === 'admin') return 2;
  if (role === 'moderator') return 1;
  return 0;
}

export type AdminOverview = {
  users_total: number;
  users_new_7d: number;
  staff_total: number;
  banned_total: number;
  rooms_open: number;
  rooms_private: number;
  seated_now: number;
  messages_24h: number;
  gifts_24h: number;
  diamonds_24h: number;
  domino_playing: number;
  signups: { day: string; count: number }[];
  top_rooms: { id: string; title: string; host: string; gifts: number }[];
  latest_audit: AdminAuditEntry[];
};

export type AdminPersonRow = {
  id: string;
  display_name: string;
  user_number: number | null;
  avatar_url: string | null;
  level: number;
  diamonds: number;
  gold: number;
  role: StaffRole | null;
  /** Insignia de rol activa (dueño, agencia, oficial, host, CS). */
  badge?: string | null;
  banned: boolean;
  ban_reason: string | null;
  ban_until: string | null;
  created_at: string;
};

export type AdminPerson = AdminPersonRow & {
  messages_30d: number;
  gifts_30d: number;
  rooms_hosted: number;
  followers: number;
  following: number;
  domino_games: number;
  /** La insignia vigente y la que el dueño asignó a mano. */
  badge: string | null;
  assigned_badge: string | null;
  /** El nombre de la agencia, cuando representa a una. */
  agency_name: string | null;
  /** El logo que la agencia puso en su panel. */
  agency_photo_url?: string | null;
};

export type AdminAuditEntry = {
  id: number;
  actor_id: string | null;
  actor_name: string;
  action: string;
  target_id: string | null;
  target_name: string | null;
  detail: string | null;
  created_at: string;
};

export type AdminRoomRow = {
  id: string;
  title: string;
  host_id: string | null;
  host_name: string;
  room_mode: string;
  is_private: boolean;
  max_seats: number;
  occupied: number;
  created_at: string;
};

export type AccountBan = { reason: string; banned_at: string; until: string | null };

/** Una denuncia de una persona contra otra, con el nombre de las dos. */
export type AdminReport = {
  id: number;
  target_id: string;
  target_name: string;
  target_avatar: string | null;
  reporter_name: string;
  reason: string;
  detail: string | null;
  created_at: string;
  reviewed_at: string | null;
  reports_open: number;
};

export const REPORT_REASON_LABEL: Record<string, string> = {
  adult: 'Contenido para adultos',
  harass: 'Acoso o insultos',
  spam: 'Spam o publicidad',
  impersonate: 'Se hace pasar por otra persona',
  fraud: 'Estafa o pedir dinero',
  other: 'Otra cosa',
};

function client() {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Cuentas no disponibles');
  return supabase;
}

/**
 * Si el servidor dice que esta cuenta ya no tiene acceso (un rol quitado, una
 * sesión vieja), el panel se cierra solo en vez de mostrar el error crudo.
 */
const accessLost = new Set<() => void>();

export function onStaffAccessLost(listener: () => void): () => void {
  accessLost.add(listener);
  return () => { accessLost.delete(listener); };
}

function fail(error: { message: string }): never {
  if (/no tienes acceso al panel/i.test(error.message)) accessLost.forEach(listener => listener());
  throw new Error(error.message);
}

export async function myStaffRole(): Promise<StaffRole | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_staff_role');
  if (error) return null;
  return (data as StaffRole | null) ?? null;
}

/** The suspension on this account, if there is one right now. */
export async function myAccountBan(): Promise<AccountBan | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('my_account_ban');
  if (error) return null;
  const row = (Array.isArray(data) ? data[0] : data) as AccountBan | undefined;
  return row?.reason ? row : null;
}

export async function adminOverview(): Promise<AdminOverview> {
  const { data, error } = await client().rpc('admin_overview');
  if (error) fail(error);
  return data as AdminOverview;
}

export async function adminPeople(query: string): Promise<AdminPersonRow[]> {
  const { data, error } = await client().rpc('admin_people', { p_query: query.trim() || null, p_limit: 40 });
  if (error) fail(error);
  return (data ?? []) as AdminPersonRow[];
}

export async function adminPerson(userId: string): Promise<AdminPerson | null> {
  const { data, error } = await client().rpc('admin_person', { p_user: userId });
  if (error) fail(error);
  return (data as AdminPerson | null) ?? null;
}

export async function adminAudit(limit = 60): Promise<AdminAuditEntry[]> {
  const { data, error } = await client().rpc('admin_audit_log', { p_limit: limit });
  if (error) fail(error);
  return (data ?? []) as AdminAuditEntry[];
}

export async function adminRooms(): Promise<AdminRoomRow[]> {
  const { data, error } = await client().rpc('admin_rooms');
  if (error) fail(error);
  return (data ?? []) as AdminRoomRow[];
}

/** Una fila por persona de agencia, con lo que ha recibido en regalos. */
export async function adminAgencyPeople(): Promise<AgencyPerson[]> {
  const { data, error } = await client().rpc('admin_agency_people');
  if (error) fail(error);
  return (data ?? []) as AgencyPerson[];
}

/** Las denuncias de las personas, las nuevas primero. */
export async function adminReports(limit = 40): Promise<AdminReport[]> {
  const { data, error } = await client().rpc('admin_reports', { p_limit: limit });
  if (error) fail(error);
  return (data ?? []) as AdminReport[];
}

/** El equipo da una denuncia por revisada. */
export async function adminReviewReport(id: number): Promise<void> {
  const { error } = await client().rpc('admin_review_report', { p_report: id });
  if (error) fail(error);
}

export async function adminSetRole(userId: string, role: StaffRole | null): Promise<void> {
  const { error } = await client().rpc('admin_set_role', { p_user: userId, p_role: role });
  if (error) throw new Error(error.message);
}

export async function adminBan(userId: string, reason: string, days: number | null = null): Promise<void> {
  const { error } = await client().rpc('admin_ban', { p_user: userId, p_reason: reason, p_days: days });
  if (error) throw new Error(error.message);
}

export async function adminUnban(userId: string): Promise<void> {
  const { error } = await client().rpc('admin_unban', { p_user: userId });
  if (error) throw new Error(error.message);
}

export async function adminCloseRoom(roomId: string): Promise<void> {
  const { error } = await client().rpc('admin_close_room', { p_room: roomId });
  if (error) throw new Error(error.message);
}

export type StaffMember = {
  user_id: string;
  display_name: string;
  user_number: number | null;
  avatar_url: string | null;
  role: StaffRole;
  granted_by_name: string | null;
  since: string;
  banned: boolean;
};

/** Everyone who can open the panel, with their role and who gave it. */
export async function adminStaff(): Promise<StaffMember[]> {
  const { data, error } = await client().rpc('admin_staff');
  if (error) fail(error);
  return (data ?? []) as StaffMember[];
}

/** El dueño da o quita una insignia (agencia, oficial o atención al cliente). */
export async function adminSetBadge(userId: string, badge: 'agency' | 'official' | 'cs' | null): Promise<void> {
  const { error } = await client().rpc('admin_set_badge', { p_user: userId, p_badge: badge });
  if (error) fail(error);
}

/** El dueño escribe a qué agencia representa la persona. */
export async function adminSetAgency(userId: string, name: string | null): Promise<void> {
  const { error } = await client().rpc('admin_set_agency', { p_user: userId, p_name: name });
  if (error) fail(error);
}

/**
 * Entra al panel con el usuario de la cuenta (o su correo) y su contraseña.
 * El servidor traduce el usuario a su correo, comprueba la contraseña real y
 * exige un rol de equipo antes de devolver la sesión.
 */
export async function staffSignIn(identifier: string, password: string): Promise<StaffRole> {
  const supabase = client();
  const { data, error } = await supabase.functions.invoke('staff-login', {
    body: { identifier: identifier.trim(), password },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = (await response?.json?.().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? error.message);
  }
  const result = data as { access_token?: string; refresh_token?: string; role?: StaffRole; error?: string } | null;
  if (result?.error) throw new Error(result.error);
  if (!result?.access_token || !result.refresh_token) throw new Error('No pudimos abrir tu sesión.');
  const { error: sessionError } = await supabase.auth.setSession({
    access_token: result.access_token,
    refresh_token: result.refresh_token,
  });
  if (sessionError) throw new Error(sessionError.message);
  return result.role ?? 'moderator';
}

/**
 * Pide el código al correo de una cuenta del equipo, sin sesión previa. El
 * servidor solo lo envía si esa cuenta tiene rol y devuelve su correo para
 * completar la verificación; una cuenta sin rol no recibe nada.
 */
export async function staffRequestCode(identifier: string): Promise<string> {
  const supabase = client();
  const { data, error } = await supabase.functions.invoke('staff-login', {
    body: { identifier: identifier.trim(), action: 'code' },
  });
  if (error) {
    const response = (error as { context?: Response }).context;
    const detail = (await response?.json?.().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? error.message);
  }
  const result = data as { email?: string; error?: string } | null;
  if (result?.error) throw new Error(result.error);
  if (!result?.email) throw new Error('No pudimos enviar el código.');
  return result.email;
}
