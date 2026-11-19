import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import {
  BarChart3,
  Building2,
  ChevronLeft,
  DoorClosed,
  Flag,
  KeyRound,
  Lock,
  Mail,
  Radio,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  ShieldOff,
  Users,
} from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { requireSupabase } from '@/lib/supabase';
import { getProfile } from '@/lib/rooms';
import {
  ROLE_LABEL,
  adminAgencyPeople,
  adminAudit,
  adminCloseRoom,
  adminOverview,
  adminReports,
  adminReviewReport,
  adminRooms,
  REPORT_REASON_LABEL,
  myStaffRole,
  onStaffAccessLost,
  staffSignIn,
  staffRequestCode,
  type AdminAuditEntry,
  type AdminOverview,
  type AdminRoomRow,
  type AdminReport,
  type StaffRole,
} from '@/lib/admin';
import { groupAgencies, type AgencyGroup, type AgencyPerson } from '@/lib/agencies';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { AdminPeople } from './admin-people';
import { AdminAgencies } from './admin-agencies';
import { AdminTeam } from './admin-team';
import { Badge, Card, EmptyNote, GOLD, actionLabel, formatDateTime, formatDay, roleTone, Stat } from './shared';
import { ConfirmDialog, type ConfirmRequest } from './confirm';

type Tab = 'resumen' | 'personas' | 'agencias' | 'equipo' | 'auditoria' | 'salas';

/**
 * Panel Owner: entra desde Ajustes, pide la contraseña de la propia cuenta y
 * solo entonces muestra el equipo, las cuentas y la auditoría. El servidor
 * comprueba el rol otra vez en cada llamada, así que esconder un botón nunca
 * es la única defensa.
 */
export function AdminScreen() {
  const { session, loading } = useAuth();
  const [role, setRole] = useState<StaffRole | null | undefined>(undefined);
  const [unlocked, setUnlocked] = useState(false);
  const [unlockAt, setUnlockAt] = useState(0);
  const [name, setName] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!session?.user.id) {
      setRole(null);
      return;
    }
    let live = true;
    setRole(undefined);
    void getProfile(session.user.id)
      .then(row => { if (live) setName(row?.display_name ?? ''); })
      .catch(() => undefined);
    void myStaffRole()
      .then(value => { if (live) setRole(value); })
      .catch(() => { if (live) setRole(null); });
    return () => { live = false; };
  }, [loading, session?.user.id]);

  // A role taken away while the panel is open closes it at once.
  useEffect(() => onStaffAccessLost(() => {
    setUnlocked(false);
    setRole(null);
  }), []);

  // The panel locks itself again after fifteen minutes without re-entering.
  useEffect(() => {
    if (!unlocked) return;
    const timer = setInterval(() => {
      if (Date.now() - unlockAt > 15 * 60_000) setUnlocked(false);
    }, 30_000);
    return () => clearInterval(timer);
  }, [unlockAt, unlocked]);

  if (loading || role === undefined) return <Centered note="Comprobando tu acceso…" />;
  // A phone with no session at all still gets the panel's own door: the user
  // name and the account's password are checked on the server, which refuses
  // anyone without a staff role.
  if (!session) {
    return (
      <Unlock
        role={null}
        name=""
        email=""
        onUnlock={() => {
          setUnlockAt(Date.now());
          setUnlocked(true);
        }}
      />
    );
  }
  if (!role) return <NoAccess />;
  if (!unlocked) {
    return (
      <Unlock
        role={role}
        name={name}
        email={session.user.email ?? ''}
        onUnlock={() => {
          setUnlockAt(Date.now());
          setUnlocked(true);
        }}
      />
    );
  }
  return (
    <AdminPanel
      role={role}
      email={session.user.email ?? ''}
      onLock={() => setUnlocked(false)}
    />
  );
}

function Centered({ note }: { note: string }) {
  return (
    <SafeAreaView className="bg-background flex-1 items-center justify-center gap-3 px-6">
      <ActivityIndicator color={GOLD} />
      <Text className="text-muted-foreground text-center text-[12.5px]">{note}</Text>
    </SafeAreaView>
  );
}

function AdminHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-2 px-3 pb-2 pt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Volver"
        onPress={onBack ?? (() => { if (router.canGoBack()) router.back(); else router.replace('/perfil/ajustes' as Href); })}
        className="bg-card border-border size-10 items-center justify-center rounded-full border active:opacity-70">
        <Icon as={ChevronLeft} className="text-foreground size-5" />
      </Pressable>
      <View className="min-w-0 flex-1">
        <Text className="text-foreground text-[18px] font-semibold" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function NoAccess() {
  const [leaving, setLeaving] = useState(false);
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <AdminHeader title="Panel Owner" />
      <View className="flex-1 items-center justify-center px-6">
        <View className="bg-destructive/10 size-16 items-center justify-center rounded-full">
          <Icon as={ShieldOff} className="text-destructive size-7" />
        </View>
        <Text className="text-foreground mt-4 text-center text-[19px] font-semibold">Esta cuenta no tiene acceso</Text>
        <Text className="text-muted-foreground mt-1 text-center text-[12.5px] leading-5">
          El panel es solo para el dueño y el equipo de moderación. Si crees que es un error, pide al dueño que te asigne un rol.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace('/perfil/ajustes' as Href)}
          className="bg-primary mt-5 h-12 w-full items-center justify-center rounded-full active:opacity-85">
          <Text className="text-primary-foreground text-[13.5px] font-semibold">Volver a Ajustes</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          disabled={leaving}
          onPress={() => {
            setLeaving(true);
            void requireSupabase().auth.signOut().finally(() => {
              setLeaving(false);
              router.replace('/' as Href);
            });
          }}
          className="mt-2 h-10 items-center justify-center">
          <Text className="text-muted-foreground text-[12px]">{leaving ? 'Cerrando…' : 'Cerrar sesión'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Unlock({ role, name, email, onUnlock }: { role: StaffRole | null; name: string; email: string; onUnlock: () => void }) {
  // The name is how the account signs into the panel: it has to be the name on
  // this account (or its email), so a shared password never opens someone
  // else's panel. The password is the account's own password.
  const [user, setUser] = useState(name);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState<'password' | 'code'>('password');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The address the code was sent to: the account in this phone, or the one
  // the typed user name resolved to on the server.
  const [codeEmail, setCodeEmail] = useState(email);

  useEffect(() => { setUser(current => current || name); }, [name]);

  async function confirmPassword() {
    if (busy) return;
    const typed = user.trim().toLowerCase();
    const known = [name.trim().toLowerCase(), email.trim().toLowerCase()].filter(Boolean);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (typed && known.includes(typed)) {
        // The account already in this phone: its own password is enough.
        const { error: authError } = await requireSupabase().auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      } else {
        // A teammate's account, named by its user: the server turns the name
        // into its email, checks the password and requires a staff role.
        await staffSignIn(user, password);
      }
      onUnlock();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No pudimos comprobar tu contraseña.';
      setError(/invalid login credentials/i.test(message) ? 'La contraseña no es correcta.' : message);
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (email) {
        const { error: authError } = await requireSupabase().auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (authError) throw authError;
        setCodeEmail(email);
      } else {
        // No session yet: the server finds the account behind the user name,
        // refuses anyone without a staff role and sends the code itself.
        setCodeEmail(await staffRequestCode(user));
      }
      setStage('code');
      setNotice('Te enviamos un código a tu correo.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar el código.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: authError } = await requireSupabase().auth.verifyOtp({ email: codeEmail, token: code.trim(), type: 'email' });
      if (authError) throw authError;
      onUnlock();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Ese código no sirve.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <AdminHeader title="Panel Owner" onBack={() => router.replace('/perfil/ajustes' as Href)} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1">
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          <View className="items-center gap-3 pt-4">
            <View className="border-primary/35 bg-primary/15 size-16 items-center justify-center rounded-full border">
              <Icon as={Lock} className="text-primary size-7" />
            </View>
            <Text className="text-foreground text-center text-[21px] font-semibold">Acceso protegido</Text>
            <Text className="text-muted-foreground text-center text-[12.5px] leading-5">
              Confirma que eres tú antes de abrir la moderación, los roles y la auditoría.
            </Text>
            <View className="flex-row items-center gap-1.5">
              {role ? <Badge label={ROLE_LABEL[role]} tone={roleTone(role)} /> : null}
              {email ? <Text className="text-muted-foreground text-[11.5px]" numberOfLines={1}>{email}</Text> : null}
            </View>
          </View>

          {notice ? <Text className="text-primary text-center text-[12px]">{notice}</Text> : null}
          {error ? <Text className="text-destructive text-center text-[12px]">{error}</Text> : null}

          <Card className="gap-3">
            {stage === 'password' ? (
              <>
                <Text className="text-foreground text-[13px] font-semibold">Usuario</Text>
                <TextInput
                  value={user}
                  onChangeText={setUser}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Tu usuario de la app"
                  placeholderTextColor="#8C8276"
                  className="border-border bg-background text-foreground h-12 rounded-full border px-4 text-[14px]"
                />
                <Text className="text-foreground text-[13px] font-semibold">Contraseña</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                  autoComplete="current-password"
                  placeholder="La contraseña de esa cuenta"
                  placeholderTextColor="#8C8276"
                  onSubmitEditing={() => void confirmPassword()}
                  className="border-border bg-background text-foreground h-12 rounded-full border px-4 text-[14px]"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Abrir el panel"
                  disabled={busy || password.length === 0}
                  onPress={() => void confirmPassword()}
                  className="bg-primary h-12 flex-row items-center justify-center gap-2 rounded-full active:opacity-85 disabled:opacity-40">
                  {busy ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={KeyRound} size={15} className="text-primary-foreground" />}
                  <Text className="text-primary-foreground text-[13.5px] font-semibold">Abrir el panel</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Entrar con un código a mi correo"
                  disabled={busy || user.trim().length === 0}
                  onPress={() => void sendCode()}
                  className="h-10 items-center justify-center disabled:opacity-40">
                  <Text className="text-muted-foreground text-[11.5px]">No tengo contraseña: entrar con un código a mi correo</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text className="text-foreground text-[13px] font-semibold">Código del correo</Text>
                <Text className="text-muted-foreground text-[11.5px] leading-4">
                  Escribe el código que enviamos a {codeEmail}. Si no llega, pide otro.
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  placeholder="Código"
                  placeholderTextColor="#8C8276"
                  onSubmitEditing={() => void confirmCode()}
                  className="border-border bg-background text-foreground h-12 rounded-full border px-4 text-center text-[17px] tracking-[6px]"
                />
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || code.trim().length < 4}
                  onPress={() => void confirmCode()}
                  className="bg-primary h-12 flex-row items-center justify-center gap-2 rounded-full active:opacity-85 disabled:opacity-40">
                  {busy ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={Mail} size={15} className="text-primary-foreground" />}
                  <Text className="text-primary-foreground text-[13.5px] font-semibold">Entrar al panel</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={() => void sendCode()} disabled={busy} className="h-9 items-center justify-center">
                  <Text className="text-muted-foreground text-[11.5px]">Enviar otro código</Text>
                </Pressable>
              </>
            )}
          </Card>

          <View className="border-border bg-card flex-row items-start gap-2.5 rounded-[16px] border px-3.5 py-3">
            <Icon as={ShieldCheck} className="text-primary mt-0.5 size-4" />
            <Text className="text-muted-foreground flex-1 text-[11px] leading-4">
              No hay una segunda contraseña guardada en la app. Se usa la contraseña real de tu cuenta, y el servidor comprueba tu rol en cada acción.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function AdminPanel({ role, email, onLock }: { role: StaffRole; email: string; onLock: () => void }) {
  const [tab, setTab] = useState<Tab>('resumen');
  const tabs: { key: Tab; label: string; icon: typeof BarChart3 }[] = [
    { key: 'resumen', label: 'Resumen', icon: BarChart3 },
    { key: 'personas', label: 'Personas', icon: Users },
    { key: 'agencias', label: 'Agencias', icon: Building2 },
    { key: 'equipo', label: 'Equipo', icon: ShieldCheck },
    { key: 'auditoria', label: 'Auditoría', icon: ScrollText },
    { key: 'salas', label: 'Salas', icon: Radio },
  ];
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <AdminHeader
        title="Panel Owner"
        subtitle={email}
        right={
          <View className="flex-row items-center gap-1.5">
            <Badge label={ROLE_LABEL[role]} tone={roleTone(role)} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Bloquear el panel"
              onPress={onLock}
              className="bg-card border-border size-10 items-center justify-center rounded-full border active:opacity-70">
              <Icon as={Lock} className="text-muted-foreground size-4" />
            </Pressable>
          </View>
        }
      />

      {/* Five sections never fit one phone row; the row scrolls instead of
          squeezing every label into an unreadable pill. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{ gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
        {tabs.map(item => {
          const active = tab === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => setTab(item.key)}
              className={`h-10 flex-row items-center justify-center gap-1 rounded-full px-3.5 ${active ? 'bg-primary' : 'bg-card border border-border'}`}>
              <Icon as={item.icon} size={13} className={active ? 'text-primary-foreground' : 'text-muted-foreground'} />
              <Text className={`text-[12px] font-semibold ${active ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{item.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {tab === 'resumen' ? <OverviewTab onOpenAgencies={() => setTab('agencias')} /> : null}
      {tab === 'personas' ? <AdminPeople role={role} /> : null}
      {tab === 'agencias' ? <AdminAgencies /> : null}
      {tab === 'equipo' ? <AdminTeam role={role} /> : null}
      {tab === 'auditoria' ? <AuditTab /> : null}
      {tab === 'salas' ? <RoomsTab role={role} /> : null}

      <Text className="text-muted-foreground/70 px-5 pb-1 text-center text-[11.5px]">
        Cada acción del equipo queda registrada en la auditoría.
      </Text>
    </SafeAreaView>
  );
}

function useLoader<T>(load: () => Promise<T>, autoMs?: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [at, setAt] = useState(0);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      setData(await load());
      setError(null);
      setAt(Date.now());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cargar los datos.');
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!autoMs) return;
    const timer = setInterval(() => { void refresh(true); }, autoMs);
    return () => clearInterval(timer);
  }, [autoMs, refresh]);

  return { data, error, loading, at, refresh };
}

function OverviewTab({ onOpenAgencies }: { onOpenAgencies: () => void }) {
  const load = useCallback(() => adminOverview(), []);
  const { data, error, loading, at, refresh } = useLoader<AdminOverview>(load, 30_000);
  // Las agencias viven en su propia pestaña; aquí solo se asoman las que más
  // diamantes reciben, para que el dueño vea el pulso de la casa de un vistazo.
  const loadAgencies = useCallback(() => adminAgencyPeople(), []);
  const { data: agencyPeople } = useLoader<AgencyPerson[]>(loadAgencies, 60_000);
  const topAgencies = groupAgencies(agencyPeople ?? []).filter(group => group.name !== null).slice(0, 3);
  // Las denuncias de hoy: lo que la gente marco y el equipo aun no reviso.
  const loadReports = useCallback(() => adminReports(20), []);
  const { data: reports, refresh: refreshReports } = useLoader<AdminReport[]>(loadReports, 120_000);
  const openReports = (reports ?? []).filter(report => !report.reviewed_at).slice(0, 3);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-muted-foreground text-[11.5px]">
          {at ? `Actualizado ${formatClock(at)}` : 'Cargando la comunidad…'}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualizar resumen" onPress={() => void refresh(true)} className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 active:opacity-70">
          <Icon as={RefreshCw} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-[11px] font-semibold">Actualizar</Text>
        </Pressable>
      </View>

      {error ? <Text className="text-destructive px-1 text-[12px]">{error}</Text> : null}
      {loading && !data ? <ActivityIndicator color={GOLD} className="mt-8" /> : null}

      {data ? (
        <>
          <View className="flex-row gap-2">
            <Stat label="Cuentas" value={data.users_total} hint={`${data.users_new_7d} nuevas en 7 días`} />
            <Stat label="En salas" value={data.seated_now} hint={`${data.rooms_open} salas abiertas`} />
          </View>
          <View className="flex-row gap-2">
            <Stat label="Mensajes 24 h" value={data.messages_24h} />
            <Stat label="Regalos 24 h" value={data.gifts_24h} hint={`${data.diamonds_24h.toLocaleString('es-US')} diamantes`} tone="gold" />
          </View>
          <View className="flex-row gap-2">
            <Stat label="Suspendidas" value={data.banned_total} tone={data.banned_total > 0 ? 'red' : 'default'} hint={`${data.staff_total} en el equipo`} />
            <Stat label="Dominó" value={data.domino_playing} hint="mesas en juego" />
          </View>

          <Card className="gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-[13.5px] font-semibold">Cuentas nuevas</Text>
              <Text className="text-muted-foreground text-[11px]">últimos 7 días</Text>
            </View>
            <SignupBars days={data.signups} />
          </Card>

          <Card className="gap-2">
            <Text className="text-foreground text-[13.5px] font-semibold">Salas con más regalos hoy</Text>
            {data.top_rooms.length === 0 ? (
              <Text className="text-muted-foreground text-[11.5px]">Todavía no hay regalos en las últimas 24 horas.</Text>
            ) : (
              data.top_rooms.map((room, index) => (
                <View key={room.id} className="flex-row items-center gap-2 py-1">
                  <View className="bg-primary/15 size-6 items-center justify-center rounded-full">
                    <Text className="text-primary text-[11px] font-bold">{index + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground text-[12.5px] font-semibold" numberOfLines={1}>{room.title}</Text>
                    <Text className="text-muted-foreground text-[11.5px]" numberOfLines={1}>{room.host}</Text>
                  </View>
                  <Text className="text-primary text-[12px] font-semibold tabular-nums">{room.gifts.toLocaleString('es-US')}</Text>
                </View>
              ))
            )}
          </Card>

          <AgencyDigest top={topAgencies} onOpen={onOpenAgencies} />

          {openReports.length > 0 ? (
            <Card className="gap-2.5">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Flag} size={14} className="text-destructive" />
                <Text className="text-foreground flex-1 text-[13.5px] font-semibold">Denuncias por revisar</Text>
                <Text className="text-muted-foreground text-[11px]">{openReports.length}</Text>
              </View>
              {openReports.map(report => (
                <View key={report.id} className="border-border gap-1 rounded-[12px] border px-2.5 py-2">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground flex-1 text-[12.5px] font-semibold" numberOfLines={1}>
                      {report.target_name ?? 'Cuenta'}
                    </Text>
                    <Badge label={report.reports_open > 1 ? `${report.reports_open} denuncias` : '1 denuncia'} tone="red" />
                  </View>
                  <Text className="text-muted-foreground text-[11.5px]" numberOfLines={2}>
                    {REPORT_REASON_LABEL[report.reason] ?? report.reason}
                    {report.detail ? ` · ${report.detail}` : ''}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <Text className="text-muted-foreground flex-1 text-[11px]" numberOfLines={1}>
                      por {report.reporter_name} · {formatDateTime(report.created_at)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Marcar como revisada la denuncia de ${report.target_name ?? 'esta cuenta'}`}
                      onPress={() => { void adminReviewReport(report.id).then(() => refreshReports(true)).catch(() => undefined); }}
                      className="border-primary/40 bg-primary/10 h-7 items-center justify-center rounded-full border px-2.5 active:opacity-75">
                      <Text className="text-primary text-[11px] font-semibold">Revisada</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </Card>
          ) : null}

          <Card className="gap-2">
            <Text className="text-foreground text-[13.5px] font-semibold">Últimos movimientos</Text>
            {data.latest_audit.length === 0 ? (
              <Text className="text-muted-foreground text-[11.5px]">El equipo todavía no ha hecho cambios.</Text>
            ) : (
              data.latest_audit.slice(0, 4).map(entry => (
                <View key={entry.id} className="flex-row items-center gap-2 py-1">
                  <Icon as={ShieldCheck} size={13} className="text-primary" />
                  <Text className="text-foreground flex-1 text-[11.5px]" numberOfLines={1}>
                    {entry.actor_name} · {actionLabel(entry.action)}
                    {entry.target_name ? `: ${entry.target_name}` : ''}
                  </Text>
                  <Text className="text-muted-foreground text-[11px]">{formatDateTime(entry.created_at)}</Text>
                </View>
              ))
            )}
          </Card>

        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * El pulso de las agencias en el resumen: las tres que más diamantes reciben,
 * con su gente y el corte de 30 días. Tocar una fila abre la pestaña entera.
 */
function AgencyDigest({ top, onOpen }: { top: AgencyGroup[]; onOpen: () => void }) {
  return (
    <Card className="gap-2.5">
      <View className="flex-row items-center justify-between">
        <View className="flex-1 flex-row items-center gap-1.5">
          <Icon as={Building2} size={14} className="text-primary" />
          <Text className="text-foreground text-[13.5px] font-semibold">Agencias que más reciben</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ver todas las agencias"
          hitSlop={8}
          onPress={onOpen}
          className="active:opacity-70">
          <Text className="text-primary text-[11.5px] font-semibold">Ver todas</Text>
        </Pressable>
      </View>
      {top.length === 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Abrir la pestaña de agencias"
          onPress={onOpen}
          className="active:opacity-80">
          <Text className="text-muted-foreground text-[11.5px] leading-4">
            Todavía no hay agencias con nombre. En Personas pon la insignia de Agencia y escribe su nombre.
          </Text>
        </Pressable>
      ) : (
        top.map((group, index) => (
          <Pressable
            key={group.name ?? index}
            accessibilityRole="button"
            accessibilityLabel={`Agencia ${group.name}, ${group.members.length} personas y ${group.diamonds} diamantes recibidos. Ver todas las agencias.`}
            onPress={onOpen}
            className="flex-row items-center gap-2 py-1 active:opacity-75">
            <View className="bg-primary/15 size-6 items-center justify-center rounded-full">
              <Text className="text-primary text-[11px] font-bold">{index + 1}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[12.5px] font-semibold" numberOfLines={1}>{group.name}</Text>
              <Text className="text-muted-foreground text-[11.5px]" numberOfLines={1}>
                {group.members.length} {group.members.length === 1 ? 'persona' : 'personas'} · {group.diamonds30d.toLocaleString('es-US')} en 30 días
              </Text>
            </View>
            <Text className="text-primary text-[12px] font-semibold tabular-nums">{group.diamonds.toLocaleString('es-US')}</Text>
          </Pressable>
        ))
      )}
    </Card>
  );
}

function SignupBars({ days }: { days: { day: string; count: number }[] }) {
  const max = Math.max(1, ...days.map(day => day.count));
  return (
    <View className="flex-row items-end justify-between gap-1.5" style={{ height: 96 }}>
      {days.map(day => {
        const height = Math.max(4, Math.round((day.count / max) * 68));
        return (
          <View key={day.day} className="flex-1 items-center justify-end gap-1">
            <Text className="text-muted-foreground text-[11px] tabular-nums">{day.count}</Text>
            <View style={{ height, width: '100%', maxWidth: 26, borderRadius: 6 }} className={day.count > 0 ? 'bg-primary' : 'bg-muted'} />
            <Text className="text-muted-foreground text-[11px]">{formatDay(day.day)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function AuditTab() {
  const load = useCallback(() => adminAudit(80), []);
  const { data, error, loading, refresh } = useLoader<AdminAuditEntry[]>(load);
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between px-1 pb-1">
        <Text className="text-muted-foreground text-[11.5px]">Quién hizo qué y cuándo.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualizar auditoría" onPress={() => void refresh()} className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 active:opacity-70">
          <Icon as={RefreshCw} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-[11px] font-semibold">Actualizar</Text>
        </Pressable>
      </View>
      {error ? <Text className="text-destructive text-[12px]">{error}</Text> : null}
      {loading && !data ? <ActivityIndicator color={GOLD} className="mt-8" /> : null}
      {data && data.length === 0 ? (
        <EmptyNote icon={ScrollText} title="Sin movimientos" body="Cuando el equipo asigne un rol, suspenda una cuenta o cierre una sala, aparecerá aquí." />
      ) : null}
      {(data ?? []).map(entry => (
        <View key={entry.id} className="border-border bg-card flex-row items-start gap-2.5 rounded-[16px] border px-3.5 py-3">
          <View className={`mt-0.5 size-8 items-center justify-center rounded-full ${toneForAction(entry.action)}`}>
            <Icon as={iconForAction(entry.action)} size={14} className="text-foreground" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-foreground text-[12.5px] font-semibold">{actionLabel(entry.action)}</Text>
            <Text className="text-foreground/80 text-[11.5px]" numberOfLines={2}>
              {entry.actor_name}{entry.target_name ? ` → ${entry.target_name}` : ''}
            </Text>
            {entry.detail ? <Text className="text-muted-foreground text-[11px] leading-4">{entry.detail}</Text> : null}
          </View>
          <Text className="text-muted-foreground text-[11px]">{formatDateTime(entry.created_at)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function RoomsTab({ role }: { role: StaffRole }) {
  const load = useCallback(() => adminRooms(), []);
  const { data, error, loading, refresh } = useLoader<AdminRoomRow[]>(load, 30_000);
  const canClose = role === 'owner' || role === 'admin';
  const [closing, setClosing] = useState<AdminRoomRow | null>(null);
  const [closeBusy, setCloseBusy] = useState(false);

  function confirmClose(room: AdminRoomRow) {
    setClosing(room);
  }

  return (
    <View className="flex-1">
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between px-1 pb-1">
        <Text className="text-muted-foreground text-[11.5px]">Monitoreo de las salas abiertas.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Actualizar salas" onPress={() => void refresh(true)} className="flex-row items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 active:opacity-70">
          <Icon as={RefreshCw} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-[11px] font-semibold">Actualizar</Text>
        </Pressable>
      </View>
      {error ? <Text className="text-destructive text-[12px]">{error}</Text> : null}
      {loading && !data ? <ActivityIndicator color={GOLD} className="mt-8" /> : null}
      {data && data.length === 0 ? <EmptyNote icon={Radio} title="Sin salas abiertas" body="Cuando alguien abra una sala, aparecerá aquí con su ocupación." /> : null}
      {(data ?? []).map(room => (
        <View key={room.id} className="border-border bg-card gap-2 rounded-[16px] border px-3.5 py-3">
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{room.title}</Text>
              <Text className="text-muted-foreground text-[11px]" numberOfLines={1}>
                {room.host_name} · {room.occupied} de {room.max_seats} asientos
              </Text>
            </View>
            <Badge label={room.room_mode === 'camera' ? 'Video' : 'Voz'} tone={room.room_mode === 'camera' ? 'blue' : 'muted'} />
            {room.is_private ? <Badge label="Privada" tone="gold" /> : null}
          </View>
          <View className="bg-muted h-1.5 overflow-hidden rounded-full">
            <View className="bg-primary h-full rounded-full" style={{ width: `${Math.min(100, Math.round((room.occupied / Math.max(1, room.max_seats)) * 100))}%` }} />
          </View>
          {canClose ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Cerrar la sala ${room.title}`}
              onPress={() => confirmClose(room)}
              className="bg-destructive/10 h-9 flex-row items-center justify-center gap-1.5 self-start rounded-full px-3 active:opacity-80">
              <Icon as={DoorClosed} size={13} className="text-destructive" />
              <Text className="text-destructive text-[11.5px] font-semibold">Cerrar sala</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
    <ConfirmDialog
      request={closing ? {
        title: 'Cerrar sala',
        body: `Se saca a todos de “${closing.title}” y la sala deja de aparecer. Queda registrado en la auditoría.`,
        action: 'Cerrar sala',
        destructive: true,
        run: async () => undefined,
      } satisfies ConfirmRequest : null}
      busy={closeBusy}
      onCancel={() => { if (!closeBusy) setClosing(null); }}
      onConfirm={() => {
        if (!closing) return;
        const room = closing;
        setClosing(null);
        setCloseBusy(true);
        void adminCloseRoom(room.id)
          .then(() => refresh())
          .catch(() => undefined)
          .finally(() => setCloseBusy(false));
      }}
    />
    </View>
  );
}

function formatClock(at: number): string {
  try {
    return new Intl.DateTimeFormat('es-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(at));
  } catch {
    return 'ahora';
  }
}

function toneForAction(action: string): string {
  if (action === 'account_ban') return 'bg-destructive/15';
  if (action === 'account_unban') return 'bg-[#34D399]/15';
  if (action === 'role_grant' || action === 'role_revoke') return 'bg-primary/15';
  return 'bg-muted';
}

function iconForAction(action: string) {
  if (action === 'account_ban') return ShieldOff;
  if (action === 'account_unban') return ShieldCheck;
  if (action === 'role_grant' || action === 'role_revoke') return Users;
  return DoorClosed;
}
