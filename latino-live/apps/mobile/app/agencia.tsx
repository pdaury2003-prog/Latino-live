import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  LogOut,
  Search,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react-native';
import { pickPhotoFromLibrary } from '@/lib/pick-photo';
import { useAuth } from '@/features/auth';
import {
  addAgencyMember,
  agencyDashboard,
  leaveAgency,
  lookUpPeople,
  metaBreakdown,
  metaProgress,
  removeAgencyMember,
  saveAgency,
  uploadAgencyPhoto,
  type AgencyCandidate,
  type AgencyDashboard,
  type AgencyMember,
} from '@/lib/agency';
import { AvatarPhoto } from '@/components/avatar-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * El panel de la agencia: la persona que el dueno marco con la insignia de
 * Agencia pone aquí su nombre y su logo, suma a su gente y sigue la meta del
 * mes de cada miembro. Su gente entra en modo lectura.
 */

const C = {
  bg: '#0A0908',
  card: '#14110E',
  border: '#2B251E',
  text: '#F6F0E4',
  muted: '#B3A897',
  gold: '#FFC24B',
  ink: '#2A1B46',
  danger: '#F0847C',
  field: '#12100D',
};

export default function Agencia() {
  const { session } = useAuth();
  const [data, setData] = useState<AgencyDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<AgencyCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  /** La confirmación de salir o sacar a alguien, dibujada en la propia app. */
  const [asking, setAsking] = useState<{ title: string; body: string; action: string; run: () => Promise<void> } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const next = await agencyDashboard();
      setData(next);
      setNameDraft(next.agency?.name ?? '');
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos abrir tu agencia.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    void load();
  }, [load, session]);

  const agency = data?.agency ?? null;
  const canManage = data?.role === 'manager';
  const members = data?.members ?? [];
  const breakdown = useMemo(() => metaBreakdown(members), [members]);

  async function save() {
    const clean = nameDraft.trim();
    if (clean.length < 2) {
      setError('Escribe el nombre de tu agencia.');
      return;
    }
    setBusy('save');
    setError(null);
    setNotice(null);
    try {
      await saveAgency(clean, agency?.photo_url ?? null);
      setEditing(false);
      setNotice(agency ? 'Nombre de la agencia guardado.' : 'Tu agencia ya está creada. Ahora ponle su logo.');
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar la agencia.');
    } finally {
      setBusy(null);
    }
  }

  async function pickLogo(remove = false) {
    if (!agency) return;
    if (remove) {
      setBusy('logo');
      setError(null);
      try {
        await saveAgency(agency.name, null);
        setNotice('Logo quitado.');
        await load(true);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No pudimos quitar el logo.');
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy('logo');
    setError(null);
    setNotice(null);
    try {
      const picked = await pickPhotoFromLibrary({ aspect: [1, 1], quality: 0.85 });
      if (picked.status === 'unavailable') {
        setError('La galería no está disponible en esta versión. Instala la más reciente.');
        return;
      }
      if (picked.status === 'failed') {
        setError('No pudimos abrir la galería. Inténtalo otra vez.');
        return;
      }
      if (picked.status !== 'picked') return;
      const url = await uploadAgencyPhoto(agency.id, picked.photo);
      await saveAgency(agency.name, url);
      setNotice('Logo de la agencia actualizado.');
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos subir el logo.');
    } finally {
      setBusy(null);
    }
  }

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    try {
      setCandidates(await lookUpPeople(text));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos buscar cuentas.');
    } finally {
      setSearching(false);
    }
  }

  async function add(person: AgencyCandidate) {
    setBusy(person.id);
    setError(null);
    try {
      await addAgencyMember(person.id);
      setNotice(`${person.display_name} ya está en tu agencia.`);
      setQuery('');
      setCandidates([]);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos sumar a esa persona.');
    } finally {
      setBusy(null);
    }
  }

  function confirmRemove(member: AgencyMember) {
    setAsking({
      title: 'Sacar de la agencia',
      body: `${member.display_name} dejará de aparecer en tu agencia. Puedes volver a sumarlo cuando quieras.`,
      action: 'Sacar',
      run: async () => {
        setBusy(member.id);
        setError(null);
        try {
          await removeAgencyMember(member.id);
          setNotice(`${member.display_name} salió de tu agencia.`);
          await load(true);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No pudimos sacar a esa persona.');
        } finally {
          setBusy(null);
        }
      },
    });
  }

  function confirmLeave() {
    setAsking({
      title: 'Salir de la agencia',
      body: 'Dejarás de aparecer en esta agencia. Tu perfil y tus diamantes no cambian.',
      action: 'Salir',
      run: async () => {
        setBusy('leave');
        try {
          await leaveAgency();
          setNotice('Saliste de la agencia.');
          await load(true);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : 'No pudimos sacarte de la agencia.');
        } finally {
          setBusy(null);
        }
      },
    });
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingTop: 6, paddingBottom: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Volver"
          onPress={() => (router.canGoBack() ? router.back() : router.push('/perfil' as Href))}
          style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border }}>
          <Icon as={ArrowLeft} size={18} color={C.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }}>Mi agencia</Text>
          <Text style={{ color: C.muted, fontSize: 11.5 }} numberOfLines={1}>
            {agency ? agency.name : 'Tu panel de agencia'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: 'rgba(96,165,250,0.15)', borderWidth: 1, borderColor: 'rgba(96,165,250,0.35)' }}>
          <Icon as={Building2} size={12} color="#7CC6FF" />
          <Text style={{ color: '#BBDCFF', fontSize: 11, fontWeight: '700' }}>Agencia</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 28, gap: 12 }} showsVerticalScrollIndicator={false}>
        {loading && !data ? <ActivityIndicator color={C.gold} style={{ marginTop: 30 }} /> : null}

        {error ? (
          <View style={{ backgroundColor: 'rgba(240,132,124,0.12)', borderWidth: 1, borderColor: 'rgba(240,132,124,0.35)', borderRadius: 14, padding: 10 }}>
            <Text style={{ color: C.danger, fontSize: 12, lineHeight: 17 }}>{error}</Text>
          </View>
        ) : null}
        {notice ? (
          <View style={{ backgroundColor: 'rgba(52,211,153,0.12)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.35)', borderRadius: 14, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            <Icon as={Check} size={14} color="#34D399" />
            <Text style={{ color: '#8FE9C6', fontSize: 12, flex: 1, lineHeight: 17 }}>{notice}</Text>
          </View>
        ) : null}

        {!loading && !session ? (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 18, alignItems: 'center', gap: 10 }}>
            <Icon as={Building2} size={26} color={C.gold} />
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>Entra para ver tu agencia</Text>
            <Text style={{ color: C.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' }}>
              El panel de agencia guarda tu nombre, tu logo y la meta de tu gente en tu cuenta.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entrar a mi cuenta"
              onPress={() => router.push('/entrar' as Href)}
              style={{ height: 42, paddingHorizontal: 20, borderRadius: 999, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: '700' }}>Entrar</Text>
            </Pressable>
          </View>
        ) : null}

        {!loading && session && data && !data.role ? (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 18, alignItems: 'center', gap: 8 }}>
            <Icon as={Building2} size={26} color={C.gold} />
            <Text style={{ color: C.text, fontSize: 15, fontWeight: '700', textAlign: 'center' }}>Esta pantalla es para agencias</Text>
            <Text style={{ color: C.muted, fontSize: 12.5, lineHeight: 18, textAlign: 'center' }}>
              Cuando el dueño de la app te dé la insignia de Agencia, aquí podrás poner el nombre y el logo de tu agencia y seguir la meta de tu gente.
            </Text>
          </View>
        ) : null}

        {data?.role ? (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: 'rgba(255,194,75,0.28)', borderRadius: 20, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={agency?.photo_url ? 'Cambiar el logo de la agencia' : 'Poner el logo de la agencia'}
                disabled={!canManage || !agency || busy === 'logo'}
                onPress={() => void pickLogo()}
                style={{ width: 74, height: 74, borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,194,75,0.45)', backgroundColor: '#1B1712', alignItems: 'center', justifyContent: 'center' }}>
                {agency?.photo_url ? (
                  <Image source={{ uri: agency.photo_url }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                ) : (
                  <Building2 size={26} color={C.gold} />
                )}
                {busy === 'logo' ? (
                  <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)' }}>
                    <ActivityIndicator color={C.gold} size="small" />
                  </View>
                ) : null}
              </Pressable>

              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: C.text, fontSize: 17, fontWeight: '700' }} numberOfLines={1}>
                  {agency?.name ?? 'Tu agencia sin nombre'}
                </Text>
                <Text style={{ color: C.muted, fontSize: 11.5 }}>
                  {canManage ? 'Tú representas esta agencia' : 'Representada por la agencia'}
                </Text>
                {canManage && agency ? (
                  <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Cambiar el logo de la agencia"
                      disabled={busy === 'logo'}
                      onPress={() => void pickLogo()}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,194,75,0.16)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.35)' }}>
                      <Icon as={Camera} size={12} color={C.gold} />
                      <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>{agency.photo_url ? 'Cambiar logo' : 'Poner logo'}</Text>
                    </Pressable>
                    {agency.photo_url ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Quitar el logo de la agencia"
                        disabled={busy === 'logo'}
                        onPress={() => void pickLogo(true)}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <Icon as={Trash2} size={12} color={C.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            </View>

            {canManage ? (
              editing || !agency ? (
                <View style={{ gap: 8 }}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="Nombre de tu agencia"
                    placeholderTextColor="#8C8276"
                    maxLength={40}
                    autoCapitalize="words"
                    style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: C.border, backgroundColor: C.field, color: C.text, paddingHorizontal: 12, fontSize: 13 }}
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Guardar el nombre de la agencia"
                      disabled={busy === 'save'}
                      onPress={() => void save()}
                      style={{ flex: 1, height: 42, borderRadius: 999, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
                      {busy === 'save' ? <ActivityIndicator size="small" color={C.ink} /> : <Icon as={Check} size={14} color={C.ink} />}
                      <Text style={{ color: C.ink, fontSize: 12.5, fontWeight: '700' }}>{agency ? 'Guardar nombre' : 'Crear mi agencia'}</Text>
                    </Pressable>
                    {agency ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Cancelar el cambio de nombre"
                        onPress={() => { setEditing(false); setNameDraft(agency.name); setError(null); }}
                        style={{ width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <Icon as={X} size={15} color={C.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cambiar el nombre de la agencia"
                  onPress={() => setEditing(true)}
                  style={{ alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' }}>
                  <Text style={{ color: C.muted, fontSize: 11.5, fontWeight: '600' }}>Cambiar nombre</Text>
                </Pressable>
              )
            ) : null}

            {agency ? (
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Mini label="Personas" value={String(data.totals.members)} />
                <Mini label="Diamantes del mes" value={data.totals.month_diamonds.toLocaleString('es-US')} gold />
              </View>
            ) : null}
          </View>
        ) : null}

        {agency && members.length > 0 ? (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon as={Trophy} size={14} color={C.gold} />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', flex: 1 }}>En qué meta va tu gente</Text>
              <Text style={{ color: C.muted, fontSize: 11 }}>este mes</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {breakdown.map(item => (
                <View key={item.level} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,194,75,0.12)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.28)' }}>
                  <Text style={{ color: C.gold, fontSize: 11, fontWeight: '700' }}>Meta {item.level}</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }}>{item.people}</Text>
                </View>
              ))}
            </View>
            <Text style={{ color: C.muted, fontSize: 11, lineHeight: 16 }}>
              La meta se cuenta con los diamantes que cada persona recibe en regalos desde el día 1 del mes.
            </Text>
          </View>
        ) : null}

        {canManage && agency ? (
          <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon as={UserPlus} size={14} color={C.gold} />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700' }}>Sumar a tu agencia</Text>
            </View>
            <View style={{ height: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, borderWidth: 1, borderColor: C.border, backgroundColor: C.field, paddingHorizontal: 12 }}>
              <Icon as={Search} size={14} color={C.muted} />
              <TextInput
                value={query}
                onChangeText={text => void search(text)}
                placeholder="Nombre o número de cuenta"
                placeholderTextColor="#8C8276"
                autoCapitalize="none"
                style={{ flex: 1, color: C.text, fontSize: 13 }}
              />
              {searching ? <ActivityIndicator size="small" color={C.gold} /> : null}
            </View>
            {candidates.map(person => (
              <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 9, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)', paddingTop: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
                  <AvatarPhoto uri={person.avatar_url} name={person.display_name} textClassName="text-[12px]" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '600' }} numberOfLines={1}>{person.display_name}</Text>
                  <Text style={{ color: C.muted, fontSize: 11 }} numberOfLines={1}>
                    #{person.user_number ?? '—'} · Nivel {person.level}{person.agency_name ? ` · Agencia ${person.agency_name}` : ''}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Sumar a ${person.display_name} a mi agencia`}
                  disabled={busy === person.id}
                  onPress={() => void add(person)}
                  style={{ paddingHorizontal: 12, height: 32, borderRadius: 999, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center' }}>
                  {busy === person.id ? <ActivityIndicator size="small" color={C.ink} /> : <Text style={{ color: C.ink, fontSize: 11.5, fontWeight: '700' }}>Sumar</Text>}
                </Pressable>
              </View>
            ))}
            {query.trim().length >= 2 && !searching && candidates.length === 0 ? (
              <Text style={{ color: C.muted, fontSize: 11.5 }}>Nadie con ese nombre o número, o ya tiene su propia agencia.</Text>
            ) : null}
          </View>
        ) : null}

        {agency ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 2 }}>
              <Icon as={Users} size={14} color={C.muted} />
              <Text style={{ color: C.text, fontSize: 13.5, fontWeight: '700', flex: 1 }}>Tu gente</Text>
              <Text style={{ color: C.muted, fontSize: 11.5 }}>{members.length} de 50</Text>
            </View>
            {members.length === 0 ? (
              <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 18, padding: 16 }}>
                <Text style={{ color: C.muted, fontSize: 12, lineHeight: 18 }}>
                  Todavía no hay nadie en tu agencia. Busca a una persona por su nombre o su número de cuenta y súmala.
                </Text>
              </View>
            ) : (
              members.map(member => (
                <MemberRow
                  key={member.id}
                  member={member}
                  canManage={canManage}
                  busy={busy === member.id}
                  onRemove={() => confirmRemove(member)}
                />
              ))
            )}
          </View>
        ) : null}

        {agency && !canManage ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Salir de la agencia"
            disabled={busy === 'leave'}
            onPress={confirmLeave}
            style={{ height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6, backgroundColor: 'rgba(240,132,124,0.12)', borderWidth: 1, borderColor: 'rgba(240,132,124,0.3)' }}>
            {busy === 'leave' ? <ActivityIndicator size="small" color={C.danger} /> : <Icon as={LogOut} size={14} color={C.danger} />}
            <Text style={{ color: C.danger, fontSize: 12, fontWeight: '700' }}>Salir de la agencia</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal visible={Boolean(asking)} transparent animationType="fade" onRequestClose={() => setAsking(null)}>
        <Pressable
          style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(3,4,3,0.72)' }}
          onPress={() => { if (!busy) setAsking(null); }}>
          <Pressable
            style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 22, padding: 18, gap: 10 }}
            onPress={() => undefined}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: '700' }}>{asking?.title}</Text>
            <Text style={{ color: C.muted, fontSize: 12.5, lineHeight: 18 }}>{asking?.body}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancelar"
                disabled={Boolean(busy)}
                onPress={() => setAsking(null)}
                style={{ flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: C.border }}>
                <Text style={{ color: C.text, fontSize: 12.5, fontWeight: '600' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={asking?.action ?? 'Confirmar'}
                disabled={Boolean(busy)}
                onPress={() => {
                  const step = asking;
                  if (!step) return;
                  setAsking(null);
                  void step.run();
                }}
                style={{ flex: 1, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(240,132,124,0.16)', borderWidth: 1, borderColor: 'rgba(240,132,124,0.4)' }}>
                {busy ? <ActivityIndicator size="small" color={C.danger} /> : <Text style={{ color: C.danger, fontSize: 12.5, fontWeight: '700' }}>{asking?.action}</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function Mini({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#0F0D0B', borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
      <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</Text>
      <Text style={{ color: gold ? C.gold : C.text, fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{value}</Text>
    </View>
  );
}

function MemberRow({ member, canManage, busy, onRemove }: { member: AgencyMember; canManage: boolean; busy: boolean; onRemove: () => void }) {
  const progress = metaProgress(member);
  const done = progress >= 1;
  return (
    <View style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 16, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: C.border }}>
          <AvatarPhoto uri={member.avatar_url} name={member.display_name} textClassName="text-[13px]" />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: '700', flexShrink: 1 }} numberOfLines={1}>{member.display_name}</Text>
            {member.is_manager ? (
              <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: 'rgba(255,194,75,0.16)' }}>
                <Text style={{ color: C.gold, fontSize: 11, fontWeight: '800' }}>AGENCIA</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: C.muted, fontSize: 11 }}>
            Nivel {member.level} · {member.diamonds.toLocaleString('es-US')} diamantes
          </Text>
        </View>
        {canManage && !member.is_manager ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sacar a ${member.display_name} de la agencia`}
            disabled={busy}
            onPress={onRemove}
            hitSlop={6}
            style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)' }}>
            {busy ? <ActivityIndicator size="small" color={C.danger} /> : <Icon as={Trash2} size={13} color={C.muted} />}
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ color: done ? '#8FE9C6' : C.gold, fontSize: 11, fontWeight: '700' }}>
            Meta {member.meta_level}{done ? ' cumplida' : ''}
          </Text>
          <Text style={{ color: C.muted, fontSize: 11, flex: 1, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
            {member.month_diamonds.toLocaleString('es-US')} / {member.meta_target.toLocaleString('es-US')}
          </Text>
        </View>
        <View style={{ height: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${Math.round(progress * 100)}%`, borderRadius: 999, backgroundColor: done ? '#34D399' : C.gold }} />
        </View>
        <Text style={{ color: C.muted, fontSize: 11 }}>
          {done
            ? 'Ya pasó su meta de este mes.'
            : `Le faltan ${Math.max(0, member.meta_target - member.month_diamonds).toLocaleString('es-US')} diamantes para cumplirla.`}
        </Text>
      </View>
    </View>
  );
}
