import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import {
  ArrowLeft,
  BatteryMedium,
  BellRing,
  Building2,
  Check,
  ChevronRight,
  Globe,
  LogOut,
  Moon,
  Radio,
  ShieldCheck,
  Sun,
  WifiOff,
  ShieldOff,
  Trash2,
  UserX,
} from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { useDesignTheme } from '@/features/design-theme';
import { getProfile, saveProfile, type ProfileRow } from '@/lib/rooms';
import { listBlocked, unblockUser, type BlockedPerson } from '@/lib/blocks';
import { requireSupabase } from '@/lib/supabase';
import { GOLD_TRIO } from '@/lib/accents';
import { setBatterySaver, setDataSaver, usePowerSettings } from '@/lib/power';
import { checkRelay, type RelayCheck } from '@/lib/ice';
import { readRelay } from '@/lib/relay';
import { config } from '@/lib/config';
import { myStaffRole, ROLE_LABEL, type StaffRole } from '@/lib/admin';

/**
 * Ajustes, drawn with plain React Native styles so it opens on every phone.
 * Account choices are saved to the account; the two saving modes stay on this
 * phone, because they describe the phone and not the person.
 */

type Palette = {
  bg: string; card: string; border: string; text: string; muted: string;
  gold: string; danger: string; field: string; faint: string; label: string;
  /** El acento del modo, ya mezclado con el fondo, para marcar sin gritar. */
  wash: string; soft: string;
};

/** Both themes use the same readable colours, so Ajustes follows the choice. */
const PALETTES: Record<'dark' | 'light', Palette> = {
  dark: {
    bg: '#080607', card: '#171113', border: '#3D2B2D', text: '#FFFFFF',
    muted: '#D8C9BE', gold: '#FFC24B', danger: '#FF6B6B',
    field: '#120D10', faint: '#9E8C82', label: '#9E8C82',
    wash: 'rgba(255,194,75,0.14)', soft: 'rgba(255,194,75,0.24)',
  },
  light: {
    bg: '#F1EFEA', card: '#FFFFFF', border: '#DCD7CC', text: '#121110',
    muted: '#5A5348', gold: '#8A5B08', danger: '#B3261E',
    field: '#FFFFFF', faint: '#6E675C', label: '#6E675C',
    wash: 'rgba(185,145,59,0.14)', soft: 'rgba(185,145,59,0.24)',
  },
};

const COUNTRIES: { code: string; label: string }[] = [
  { code: 'US', label: 'Estados Unidos' },
  { code: 'ES', label: 'España' },
  { code: 'MX', label: 'México' },
  { code: 'AR', label: 'Argentina' },
  { code: 'CO', label: 'Colombia' },
];

export default function Ajustes() {
  const { session } = useAuth();
  const { colorScheme, setColorScheme } = useDesignTheme();
  const power = usePowerSettings();
  const c = PALETTES[colorScheme === 'light' ? 'light' : 'dark'];
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  // The worldwide relay: unknown until asked, then exactly what the server said.
  const [relay, setRelay] = useState<{ state: 'unknown' | 'checking' | RelayCheck['state']; detail?: string }>({ state: 'unknown' });
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);

  const userId = session?.user.id;

  /**
   * Asks the project's server whether it holds a relay. This is what lets two
   * people in different countries hear each other when their networks block a
   * direct path; without one the room still works between most networks.
   */
  const testRelay = useCallback(async () => {
    setRelay({ state: 'checking' });
    try {
      // The relay may live in the backend or in the project's site; the reader
      // asks both, so this check tells the truth about the room either way.
      const result = await checkRelay(readRelay);
      setRelay(result);
    } catch {
      setRelay({ state: 'unreachable' });
    }
  }, []);

  /** One sentence per answer, so the fix is obvious without reading code. */
  const relayMessage = (() => {
    if (relay.state === 'checking') return 'Comprobando la conexión de voz…';
    if (relay.state === 'active') return 'Activa: tu voz cruza países y redes que bloquean la conexión directa.';
    if (relay.state === 'unknown-key') {
      return 'El Token ID no existe en esa cuenta de Cloudflare. Crea una llave TURN nueva y guarda su Token ID y su API token juntos.';
    }
    if (relay.state === 'auth') return 'Cloudflare rechazó el API token. Copia de nuevo el API token de la misma llave TURN.';
    if (relay.state === 'rejected') return 'Cloudflare no entregó el relay. Revisa TURN_KEY_ID y TURN_KEY_API_TOKEN en Cloud → Keys.';
    if (relay.state === 'unreachable') return 'No pudimos comprobar el relay ahora. Toca para volver a intentarlo.';
    if (relay.state === 'missing') return 'Conexión directa. En algunas redes la voz puede no pasar; toca para volver a comprobar.';
    return 'Toca para comprobar si tu voz llega a otros países.';
  })();

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const [row, people, role] = await Promise.all([
        getProfile(userId).catch(() => null),
        listBlocked().catch(() => [] as BlockedPerson[]),
        myStaffRole().catch(() => null),
      ]);
      setProfile(row);
      setBlocked(people);
      setStaffRole(role);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  async function act(name: string, action: () => Promise<void>, done: string) {
    if (busy) return;
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo completar.';
      setError(/network|fetch/i.test(message) ? 'No hay conexión. Inténtalo otra vez.' : message);
    } finally {
      setBusy(null);
    }
  }

  async function changeCountry(code: string) {
    if (!userId) return;
    setCountryOpen(false);
    await act('country', async () => {
      await saveProfile(userId, { country: code });
      setProfile(current => (current ? { ...current, country: code } : current));
    }, 'País actualizado.');
  }

  function confirmSignOut() {
    Alert.alert('Cerrar sesión', '¿Quieres salir de tu cuenta en este teléfono?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar sesión',
        style: 'destructive',
        onPress: () => void act('signout', async () => {
          const result = await requireSupabase().auth.signOut();
          if (result.error) throw result.error;
        }, 'Sesión cerrada.'),
      },
    ]);
  }

  function confirmDelete() {
    Alert.alert(
      'Eliminar tu cuenta',
      'Se borran tu perfil, tus salas, tus mensajes y tus regalos para siempre. No se puede deshacer.',
      [
        { text: 'Conservar cuenta', style: 'cancel' },
        {
          text: 'Eliminar cuenta',
          style: 'destructive',
          onPress: () => void act('delete', async () => {
            const client = requireSupabase();
            const result = await client.functions.invoke('delete-account');
            if (result.error) throw result.error;
            await client.auth.signOut({ scope: 'local' });
          }, 'Cuenta eliminada.'),
        },
      ],
    );
  }

  const currentCountry = COUNTRIES.find(item => item.code === profile?.country) ?? COUNTRIES[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver al perfil"
          onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/perfil' as Href); }}
          style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border, backgroundColor: c.card }}>
          <ArrowLeft color={c.text} size={18} />
        </Pressable>
        <Text style={{ color: c.text, fontSize: 19, fontWeight: '700' }}>Ajustes</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40, gap: 18 }} showsVerticalScrollIndicator={false}>
        {colorScheme === 'light' ? (
          <View style={{ flexDirection: 'row', gap: 6, paddingTop: 2 }}>
            {GOLD_TRIO.map(color => (
              <View key={color} style={{ height: 3, flex: 1, borderRadius: 2, backgroundColor: color, opacity: 0.85 }} />
            ))}
          </View>
        ) : null}
        {notice ? <Text style={{ color: c.gold, fontSize: 13, textAlign: 'center' }}>{notice}</Text> : null}
        {error ? <Text style={{ color: c.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text> : null}
        {loading ? <ActivityIndicator color={c.gold} style={{ marginTop: 20 }} /> : null}

        <Section c={c} title="APARIENCIA">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[
              { key: 'dark' as const, label: 'Modo noche', icon: Moon },
              { key: 'light' as const, label: 'Modo claro', icon: Sun },
            ].map(option => {
              const active = colorScheme === option.key;
              const IconPart = option.icon;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={option.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => { setColorScheme(option.key); setNotice(active ? null : `Listo: ${option.label.toLowerCase()}.`); }}
                  style={{
                    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
                    height: 50, borderRadius: 14, borderWidth: 1,
                    borderColor: active ? c.gold : c.border,
                    backgroundColor: active ? c.wash : c.field,
                  }}>
                  <IconPart color={active ? c.gold : c.muted} size={17} />
                  <Text style={{ color: active ? c.gold : c.text, fontSize: 13, fontWeight: '600' }}>{option.label}</Text>
                  {active ? <Check color={c.gold} size={14} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section c={c} title="AHORRO Y RENDIMIENTO">
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Ahorro de batería"
            accessibilityState={{ checked: power.battery }}
            onPress={() => {
              setBatterySaver(!power.battery);
              setNotice(power.battery ? 'Animaciones completas otra vez.' : 'Ahorro de batería activado.');
            }}
            style={rowStyle(c)}>
            <View style={iconBubble}><BatteryMedium color={bubbleAccent(c, colorScheme, 1)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Ahorro de batería</Text>
              <Text style={rowHint(c)}>Quita los brillos y las animaciones que corren sin parar</Text>
            </View>
            <Toggle c={c} on={power.battery} />
          </Pressable>

          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Ahorro de datos móviles"
            accessibilityState={{ checked: power.data }}
            onPress={() => {
              setDataSaver(!power.data);
              setNotice(power.data ? 'Datos completos otra vez.' : 'Ahorro de datos activado.');
            }}
            style={[rowStyle(c), { marginTop: 8 }]}>
            <View style={iconBubble}><WifiOff color={bubbleAccent(c, colorScheme, 2)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Ahorro de datos móviles</Text>
              <Text style={rowHint(c)}>El video de YouTube espera a que lo toques y se cargan fotos más livianas</Text>
            </View>
            <Toggle c={c} on={power.data} />
          </Pressable>

          <Text style={{ color: c.label, fontSize: 11.5, lineHeight: 17, marginLeft: 4 }}>
            Se guarda en este teléfono. Al activar el ahorro, la sala, los marcos y la entrada siguen completos; solo se
            detiene el movimiento.
          </Text>
        </Section>

        <Section c={c} title="VOZ Y CONEXIÓN">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comprobar la retransmisión mundial de voz"
            disabled={relay.state === 'checking'}
            onPress={() => void testRelay()}
            style={rowStyle(c)}>
            <View style={iconBubble}><Radio color={bubbleAccent(c, colorScheme, 1)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Retransmisión mundial</Text>
              <Text style={rowHint(c)}>{relayMessage}</Text>
            </View>
            {relay.state === 'checking'
              ? <ActivityIndicator color={c.gold} size="small" />
              : <View style={{
                width: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: relay.state === 'active'
                  ? '#34D399'
                  : relay.state === 'rejected' || relay.state === 'unknown-key' || relay.state === 'auth'
                    ? c.danger
                    : relay.state === 'missing' || relay.state === 'unreachable' ? '#F0A868' : c.faint,
              }} />}
          </Pressable>
          <Text style={{ color: c.label, fontSize: 11.5, lineHeight: 17, marginLeft: 4 }}>
            La retransmisión mundial se activa en la nube de la app. Con ella, dos personas en países distintos se
            escuchan aunque sus operadoras no dejen conectar los teléfonos directamente.
          </Text>
        </Section>

        {staffRole ? (
          <Section c={c} title="ADMINISTRACIÓN">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir el Panel Owner"
              onPress={() => router.push('/admin' as Href)}
              style={rowStyle(c)}>
              <View style={[iconBubble, { backgroundColor: c.soft }]}>
                <ShieldCheck color={c.gold} size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rowTitle(c)}>Panel Owner</Text>
                <Text style={rowHint(c)}>{ROLE_LABEL[staffRole]} · Roles, suspensión y auditoría</Text>
              </View>
              <ChevronRight color={c.muted} size={16} />
            </Pressable>
            <Text style={{ color: c.label, fontSize: 11.5, lineHeight: 17, marginLeft: 4 }}>
              Pide la contraseña de tu cuenta antes de abrir. Cada acción del equipo queda registrada.
            </Text>
          </Section>
        ) : null}

        {profile?.badge === 'agency' || profile?.agency_name ? (
          <Section c={c} title="MI AGENCIA">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir el panel de mi agencia"
              onPress={() => router.push('/agencia' as Href)}
              style={rowStyle(c)}>
              <View style={[iconBubble, { backgroundColor: 'rgba(96,165,250,0.18)' }]}>
                <Building2 color="#7CC6FF" size={16} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={rowTitle(c)}>Mi agencia</Text>
                <Text style={rowHint(c)}>
                  {profile?.badge === 'agency'
                    ? 'Nombre, logo y la meta de tu gente'
                    : `Estás en ${profile?.agency_name}`}
                </Text>
              </View>
              <ChevronRight color={c.muted} size={16} />
            </Pressable>
            <Text style={{ color: c.label, fontSize: 11.5, lineHeight: 17, marginLeft: 4 }}>
              {profile?.badge === 'agency'
                ? 'El dueño te dio la insignia de Agencia. Aquí pones el nombre y el logo de tu agencia, sumas a tu gente y ves en qué meta va cada uno.'
                : 'Aquí ves la agencia a la que perteneces y cómo va la meta de cada persona.'}
            </Text>
          </Section>
        ) : null}

        <Section c={c} title="TU CUENTA">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cambiar de país"
            onPress={() => setCountryOpen(open => !open)}
            style={rowStyle(c)}>
            <View style={iconBubble}><Globe color={bubbleAccent(c, colorScheme, 0)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Cambiar de país</Text>
              <Text style={rowHint(c)}>{currentCountry.label}</Text>
            </View>
            <ChevronRight color={c.muted} size={16} />
          </Pressable>

          {countryOpen ? (
            <View style={{ gap: 6, marginTop: 8 }}>
              {COUNTRIES.map(item => {
                const active = item.code === profile?.country;
                return (
                  <Pressable
                    key={item.code}
                    accessibilityRole="button"
                    accessibilityLabel={`Elegir ${item.label}`}
                    accessibilityState={{ selected: active }}
                    disabled={busy === 'country'}
                    onPress={() => void changeCountry(item.code)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 12,
                      borderRadius: 12, borderWidth: 1, borderColor: active ? c.gold : c.border,
                      backgroundColor: active ? c.wash : 'transparent',
                    }}>
                    <Text style={{ flex: 1, color: active ? c.gold : c.text, fontSize: 13.5 }}>{item.label}</Text>
                    {active ? <Check color={c.gold} size={15} /> : null}
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Permisos y avisos"
            onPress={() => router.push('/perfil/permisos' as Href)}
            style={[rowStyle(c), { marginTop: 8 }]}>
            <View style={iconBubble}><BellRing color={bubbleAccent(c, colorScheme, 1)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Permisos y avisos</Text>
              <Text style={rowHint(c)}>Micrófono, cámara, fotos y notificaciones</Text>
            </View>
            <ChevronRight color={c.muted} size={16} />
          </Pressable>

          {/* The policy opens in the browser: the same page the store links to. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Política de privacidad"
            onPress={() => { void Linking.openURL(`${config.site}/privacidad`).catch(() => undefined); }}
            style={[rowStyle(c), { marginTop: 8 }]}>
            <View style={iconBubble}><ShieldCheck color={bubbleAccent(c, colorScheme, 0)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Política de privacidad</Text>
              <Text style={rowHint(c)}>Qué datos usamos y cómo borrar tu cuenta</Text>
            </View>
            <ChevronRight color={c.muted} size={16} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar sesión"
            disabled={busy === 'signout'}
            onPress={confirmSignOut}
            style={[rowStyle(c), { marginTop: 8 }]}>
            <View style={iconBubble}><LogOut color={bubbleAccent(c, colorScheme, 2)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Cerrar sesión</Text>
              <Text style={rowHint(c)}>Salir de tu cuenta en este teléfono</Text>
            </View>
            {busy === 'signout' ? <ActivityIndicator color={c.gold} size="small" /> : null}
          </Pressable>
        </Section>

        <Section c={c} title="CUENTAS BLOQUEADAS">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <View style={iconBubble}><UserX color={bubbleAccent(c, colorScheme, 0)} size={16} /></View>
            <View style={{ flex: 1 }}>
              <Text style={rowTitle(c)}>Quiénes están bloqueados</Text>
              <Text style={rowHint(c)}>
                {blocked.length === 0
                  ? 'No has bloqueado a nadie.'
                  : `${blocked.length} ${blocked.length === 1 ? 'persona bloqueada' : 'personas bloqueadas'}`}
              </Text>
            </View>
          </View>

          {blocked.map(person => (
            <View key={person.user_id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.field }}>
                <Text style={{ color: c.text, fontSize: 13, fontWeight: '700' }}>{person.display_name.slice(0, 1).toUpperCase()}</Text>
              </View>
              <Text numberOfLines={1} style={{ flex: 1, color: c.text, fontSize: 13.5 }}>{person.display_name}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Desbloquear a ${person.display_name}`}
                disabled={busy === person.user_id}
                onPress={() => void act(person.user_id, async () => {
                  await unblockUser(person.user_id);
                  setBlocked(current => current.filter(item => item.user_id !== person.user_id));
                }, `${person.display_name} ya no está bloqueado.`)}
                style={{ paddingHorizontal: 12, height: 34, justifyContent: 'center', borderRadius: 999, borderWidth: 1, borderColor: c.border }}>
                <Text style={{ color: c.text, fontSize: 12, fontWeight: '600' }}>
                  {busy === person.user_id ? 'Un momento…' : 'Desbloquear'}
                </Text>
              </Pressable>
            </View>
          ))}

          <Text style={{ color: '#7C7367', fontSize: 11.5, lineHeight: 17, marginTop: 6 }}>
            Un bloqueo corta los mensajes privados y la amistad en ambos sentidos. Puedes deshacerlo cuando quieras.
          </Text>
        </Section>

        <Section c={c} title="ELIMINAR CUENTA">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Eliminar mi cuenta"
            disabled={busy === 'delete'}
            onPress={confirmDelete}
            style={[rowStyle(c), { borderColor: 'rgba(240,132,124,0.35)' }]}>
            <View style={[iconBubble, { backgroundColor: 'rgba(240,132,124,0.12)' }]}>
              <Trash2 color={c.danger} size={16} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.danger, fontSize: 13.5, fontWeight: '600' }}>Eliminar cuenta</Text>
              <Text style={rowHint(c)}>Borra tu perfil, salas y mensajes para siempre</Text>
            </View>
            {busy === 'delete' ? <ActivityIndicator color={c.danger} size="small" /> : null}
          </Pressable>
        </Section>

        <View style={{ alignItems: 'center', gap: 6, marginTop: 4 }}>
          <ShieldOff color="#4E463D" size={16} />
          <Text style={{ color: '#6B6156', fontSize: 11 }}>Latino Live · Salas de voz</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const rowStyle = (c: Palette) => ({
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 10,
  padding: 12,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: c.border,
  backgroundColor: c.field,
});

function bubbleAccent(c: Palette, scheme: 'light' | 'dark', index: number) {
  return scheme === 'light' ? GOLD_TRIO[index % GOLD_TRIO.length] : c.gold;
}

const iconBubble = {
  width: 34,
  height: 34,
  borderRadius: 17,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
  // A quiet surface that reads the same on both nights; each row adds its own
  // hint of colour on top when it has one.
  backgroundColor: 'rgba(255,255,255,0.07)',
};

const rowTitle = (c: Palette) => ({ color: c.text, fontSize: 13.5, fontWeight: '600' as const });
const rowHint = (c: Palette) => ({ color: c.muted, fontSize: 11.5, marginTop: 2 });

/** The switch of a saving mode: it moves at once, without waiting for anything. */
function Toggle({ c, on }: { c: Palette; on: boolean }) {
  return (
    <View
      style={{
        width: 46, height: 27, borderRadius: 999, padding: 3,
        justifyContent: 'center', borderWidth: 1,
        borderColor: on ? c.gold : c.border,
        backgroundColor: on ? c.soft : c.card,
      }}>
      <View
        style={{
          width: 19, height: 19, borderRadius: 10,
          backgroundColor: on ? c.gold : c.muted,
          marginLeft: on ? 19 : 0,
        }}
      />
    </View>
  );
}

function Section({ title, children, c }: { title: string; children: React.ReactNode; c: Palette }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ color: c.muted, fontSize: 12, letterSpacing: 1.6, marginLeft: 4 }}>{title}</Text>
      {children}
    </View>
  );
}
