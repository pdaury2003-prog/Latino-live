import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { pickPhotoFromLibrary } from '@/lib/pick-photo';
import { Building2, ChevronRight, Clapperboard, Crown, Heart, MapPin, Medal, Save, Search, Settings, ShieldCheck, Shirt, Sparkles, Store, UserPlus, Wallet } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '@/features/auth';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAccent } from '@/lib/theme-accent';
import { getProfile, getProfileStats, saveProfile, uploadProfileImage, type ProfileRow, type ProfileStats } from '@/lib/rooms';
import { COUNTRY_LABEL } from '@/lib/covers';
import { liveSvipLevel, svipDaysLeft, svipShows, svipStyleName, svipTheme } from '@/lib/svip';
import { wearsImperial } from '@/lib/svip-imperial';
import { svipKit } from '@/lib/svip-kit';
import { SvipChip } from '@/components/svip-frame';
import { SvipKitEmblem } from '@/components/svip-kit';
import { LevelPlaque } from '@/components/level-badge';
import { levelBand, xpProgress } from '@/lib/levels';
import { AvatarPhoto } from '@/components/avatar-photo';
import { ProfilePodium } from '@/components/profile-podium';
import { ProfileHero } from '@/components/profile-hero';
import { RoleFrame } from '@/components/role-frame';
import { FramedAvatar } from '@/components/framed-avatar';
import { SvipAvatarFrame } from '@/components/svip-frame';
import { SvipShield, UserPlate } from '@/components/gold-plate';
import { getUserPodium, type UserPodium } from '@/lib/pk';
import { answerCouple, endCouple, readCouple, type Couple } from '@/lib/couples';
import { isBadgeKind } from '@/lib/badges';
import { GENDERS, NAME_MAX, asGender, genderOf } from '@/lib/gender';
import { GENDER_ICONS } from '@/lib/gender-icons';
import { cn } from '@/lib/utils';
import { CATALOG_MAX } from '@/lib/responsive';
import { Notice } from '@/components/state-views';
import { cachedProfile } from '@/lib/profile-cache';
import { Skeleton } from '@/components/ui/skeleton';

type Kind = 'avatar' | 'cover';

export default function Perfil() {
  const { session, loading: authLoading } = useAuth();
  const accent = useAccent();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [levelHelp, setLevelHelp] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [bioDraft, setBioDraft] = useState('');
  const [genderDraft, setGenderDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [copiada, setCopiada] = useState(false);
  const [podium, setPodium] = useState<UserPodium | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    // La ficha guardada se dibuja al instante; la red solo la pone al día.
    const saved = cachedProfile(session.user.id);
    if (saved) {
      setProfile(saved);
      setNameDraft(saved.display_name);
      setBioDraft(saved.bio);
      setGenderDraft(asGender(saved.gender));
      setLoading(false);
    }
    try {
      const row = await getProfile(session.user.id);
      setProfile(row);
      setNameDraft(row?.display_name ?? '');
      setBioDraft(row?.bio ?? '');
      setGenderDraft(asGender(row?.gender));
      setCouple(await readCouple().catch(() => null));
    } catch {
      // Con una copia guardada, tu perfil sigue ahí y no hay error que enseñar.
      if (!saved) setError('No pudimos cargar tu perfil. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  // The podium moves all day with every gift, so the card asks again each time
  // the person comes back to their profile.
  const refreshPodium = useCallback(async () => {
    if (!session?.user.id) { setPodium(null); return; }
    try {
      setPodium(await getUserPodium(session.user.id));
    } catch {
      // A profile without the podium is still a profile.
    }
  }, [session?.user.id]);

  const refreshStats = useCallback(async () => {
    if (!session?.user.id) { setStats(null); return; }
    try {
      setStats(await getProfileStats(session.user.id));
    } catch {
      // The counts are a courtesy; the profile opens without them.
    }
  }, [session?.user.id]);

  useFocusEffect(useCallback(() => {
    void refreshPodium();
    void refreshStats();
  }, [refreshPodium, refreshStats]));

  async function pick(kind: Kind) {
    if (!session?.user.id) return;
    setError(null);
    setNotice(null);
    setBusy(kind);
    try {
      const picked = await pickPhotoFromLibrary({
        aspect: kind === 'avatar' ? [1, 1] : [16, 9],
        quality: 0.8,
      });
      if (picked.status === 'unavailable') {
        setError('La galería no está disponible en esta versión. Instala la más reciente.');
        return;
      }
      if (picked.status === 'failed') {
        setError('No pudimos abrir la galería. Inténtalo otra vez.');
        return;
      }
      if (picked.status !== 'picked') return;
      const url = await uploadProfileImage(session.user.id, kind, picked.photo);
      await saveProfile(session.user.id, kind === 'avatar' ? { avatar_url: url } : { cover_url: url });
      setNotice(kind === 'avatar' ? 'Foto de perfil actualizada.' : 'Portada actualizada.');
      await load();
    } catch {
      setError('No pudimos subir la imagen. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  }

  async function save() {
    if (!session?.user.id) return;
    // Quince letras es lo que cabe bajo un asiento: se corta aquí y en el
    // servidor, para que la sala nunca recorte el nombre a la mitad.
    const name = nameDraft.trim().slice(0, NAME_MAX);
    if (!name) { setError('Tu nombre no puede quedar vacío.'); return; }
    setPending(true);
    setError(null);
    try {
      await saveProfile(session.user.id, { display_name: name, bio: bioDraft.trim(), gender: asGender(genderDraft) });
      setEditing(false);
      setNotice('Perfil guardado.');
      await load();
    } catch {
      setError('No pudimos guardar tu perfil. Inténtalo otra vez.');
    } finally {
      setPending(false);
    }
  }

  async function copiarId(userNumber: number) {
    try {
      await Clipboard.setStringAsync(String(userNumber));
      setCopiada(true);
      setNotice(`Tu ID ${userNumber} está copiado.`);
      setTimeout(() => setCopiada(false), 2200);
    } catch {
      setError('No pudimos copiar tu ID. Anótalo a mano.');
    }
  }


  if (authLoading || loading) {
    return (
      // La forma del perfil mientras llega: la espera se siente más corta que
      // una rueda sobre un fondo vacío.
      <SafeAreaView edges={['top']} className="bg-background flex-1" accessibilityLabel="Cargando tu perfil">
        <View className="gap-3 px-5 pt-3">
          <View className="flex-row items-center gap-3">
            <Skeleton className="rounded-full" style={{ width: 84, height: 84 }} />
            <View className="flex-1 gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/5" />
            </View>
          </View>
          <Skeleton className="mt-2 h-14 w-full rounded-[14px]" />
          <Skeleton className="mt-1 h-24 w-full rounded-[20px]" />
          <Skeleton className="h-14 w-full rounded-2xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView edges={['top']} className="bg-background flex-1">
        <ScrollView contentContainerClassName="px-5 pb-10 pt-2">
          <View className="flex-row items-center gap-2 pb-5">
            <Icon as={Sparkles} className="text-primary size-4" />
            <Text className="text-foreground text-[15px] font-semibold tracking-[0.22em]">MI PERFIL</Text>
          </View>
          <View className="border-border bg-card items-center gap-3 rounded-[24px] border px-6 py-10">
            <View className="bg-primary/15 size-16 items-center justify-center rounded-full">
              <Icon as={Sparkles} className="text-primary size-7" />
            </View>
            <Text className="text-foreground text-center text-lg font-semibold">Tu perfil vive en la nube</Text>
            <Text className="text-muted-foreground text-center text-[13px] leading-5">
              Entra con tu correo para tener tu nombre, tu foto de perfil y tu portada en todos tus teléfonos, y para sentarte y chatear en las salas.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/entrar' as Href)} className="bg-primary mt-1 h-12 w-full flex-row items-center justify-center rounded-full active:bg-primary/80">
              <Text className="text-primary-foreground text-sm font-semibold">Entrar o crear cuenta</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const name = profile?.display_name ?? 'Invitado';
  const country = COUNTRY_LABEL[profile?.country ?? 'US'] ?? 'USA';
  const gender = genderOf(profile?.gender);
  const counts = stats ?? { followers: 0, following: 0, friends: 0, visitors: 0, is_following: false };
  const daysInApp = profile?.created_at
    ? Math.max(1, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86400000) + 1)
    : 1;
  // Account level: experience earned in the rooms, shown with its own progress.
  const progress = xpProgress(profile?.xp, profile?.level);
  const band = levelBand(profile?.level);
  const svip = svipTheme(liveSvipLevel(profile));
  const svipDays = svipDaysLeft(profile);
  const wearSvipFrame = svipShows(profile, 'frame');
  const wearSvipEmblem = svipShows(profile, 'emblem');
  const wearSvipBanner = svipShows(profile, 'banner');
  const wearSvipRoom = svipShows(profile, 'room');
  // The levels that came with a sheet of their own wear that art.
  const kit = svipKit(svip?.level);
  // One rank mark per person: the emblem when they wear it, otherwise the level
  // in a small pill. Never both, and never a second badge for the same pack.
  const mark = svip && !wearSvipEmblem
    ? { label: `SVIP ${svip.level}`, background: svip.accent, ink: svip.onAccent }
    : null;
  // The photo fills whatever circle draws it, and is never cropped by a frame.
  const avatarNode = <AvatarPhoto uri={profile?.avatar_url} name={name} textClassName="text-[30px]" />;
  // The portrait wears the role's own frame first, then the SVIP frame, a
  // bought frame, or the plain gold ring the house gives everyone.
  const roleBadge = isBadgeKind(profile?.badge) ? profile.badge : null;
  const wearFrameArt = Boolean(roleBadge) || (svip && wearSvipFrame) || Boolean(profile?.equipped_frame);
  const heroAvatar = roleBadge ? (
    <RoleFrame kind={roleBadge} size={112}>{avatarNode}</RoleFrame>
  ) : svip && wearSvipFrame ? (
    <SvipAvatarFrame level={svip.level} size={100}>{avatarNode}</SvipAvatarFrame>
  ) : profile?.equipped_frame ? (
    <FramedAvatar frame={profile.equipped_frame} size={100}>{avatarNode}</FramedAvatar>
  ) : avatarNode;

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: accent.surface }}>
      <ScrollView
        contentContainerClassName="pb-28"
        // En una pantalla ancha el perfil se queda como una columna de
        // teléfono, centrada, en vez de estirarse de borde a borde.
        contentContainerStyle={{ width: '100%', maxWidth: CATALOG_MAX, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}>
        <ProfileHero
          name={name}
          badge={roleBadge}
          agency={profile?.agency_name ?? null}
          avatarSize={roleBadge ? 112 : 84}
          userNumber={profile?.user_number ?? null}
          copied={copiada}
          onCopyId={() => { if (profile?.user_number) void copiarId(profile.user_number); }}
          avatar={heroAvatar}
          framed={wearFrameArt}
          avatarBusy={busy === 'avatar'}
          onAvatar={() => void pick('avatar')}
          onCover={() => void pick('cover')}
          coverBusy={busy === 'cover'}
          coverUrl={profile?.cover_url ?? null}
          editing={editing}
          onToggleEdit={() => {
            if (editing) { setEditing(false); setNameDraft(profile?.display_name ?? ''); setBioDraft(profile?.bio ?? ''); setGenderDraft(asGender(profile?.gender)); }
            else setEditing(true);
          }}
          gender={gender}
          emblem={
            svip && wearSvipEmblem && kit ? (
              <SvipKitEmblem level={kit.level} size={36} />
            ) : svip && wearSvipEmblem ? (
              wearsImperial(svip.level) ? <SvipChip level={svip.level} /> : <UserPlate level={svip.level} width={132} />
            ) : (
              <View className="flex-row items-center gap-1.5">
                <LevelPlaque level={profile?.level ?? 1} height={18} />
                <View className="flex-row items-center gap-1">
                  <Icon as={MapPin} size={11} color="rgba(240,232,255,0.55)" />
                  <Text className="text-[11px]" style={{ color: 'rgba(240,232,255,0.65)' }}>{country}</Text>
                </View>
              </View>
            )
          }
          mark={mark}
          couple={couple}
          onCoupleAnswer={async accept => {
            if (!couple) return;
            try {
              const next = await answerCouple(couple.partnerId, accept);
              setCouple(next);
              setNotice(accept ? `Ahora estás en pareja con ${couple.partnerName}.` : 'Rechazaste la solicitud.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'No pudimos responder.');
            }
          }}
          onCoupleEnd={async () => {
            try {
              await endCouple();
              setCouple(null);
              setNotice('La pareja terminó.');
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : 'No pudimos terminar la pareja.');
            }
          }}
          stats={[
            { key: 'friends', label: 'Amigos', value: counts.friends },
            { key: 'following', label: 'Siguiendo', value: counts.following },
            { key: 'followers', label: 'Seguidores', value: counts.followers },
            { key: 'visitors', label: 'Visitas', value: counts.visitors },
          ]}
          influence={Number(podium?.gold ?? 0)}
          rank={podium?.place ? `#${podium.place}` : '100+'}
          onOpenConnections={tab => router.push(`/perfil/conexiones?tab=${tab}` as Href)}
        />

        {/* Las tarjetas de la casa: la tienda SVIP y el monedero. */}
        <View className="mt-1 flex-row gap-2.5 px-4">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir la tienda SVIP y sus privilegios"
            onPress={() => router.push('/tienda/svip' as Href)}
            className="h-[86px] flex-1 overflow-hidden rounded-[16px] active:opacity-90">
            <LinearGradient
              colors={['#F0A81F', '#D9531C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 14, paddingRight: 40 }}>
              <Icon as={Crown} size={34} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', right: 8, bottom: 8 }} />
              <Text className="text-[16px] font-bold" style={{ color: '#FFFFFF' }}>Tienda SVIP</Text>
              <Text className="mt-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.85)' }}>
                Marcos, medallas y niveles
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir tu billetera de oro y diamantes"
            onPress={() => router.push('/billetera' as Href)}
            className="h-[86px] flex-1 overflow-hidden rounded-[16px] active:opacity-90">
            <LinearGradient
              colors={['#E4566F', '#E08A0C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 14, paddingRight: 40 }}>
              <Icon as={Wallet} size={32} color="rgba(255,255,255,0.35)" style={{ position: 'absolute', right: 8, bottom: 8 }} />
              <Text className="text-[16px] font-bold" style={{ color: '#FFFFFF' }}>Billetera</Text>
              <Text className="mt-0.5 text-[11px] tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {(profile?.diamonds ?? 0).toLocaleString('es-US')} diamantes
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* La agencia se abre desde el propio perfil: quien la representa entra
            a poner su nombre, su logo y a seguir la meta de su gente. */}
        {roleBadge === 'agency' || profile?.agency_name ? (
          <View className="mt-3 px-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={roleBadge === 'agency' ? 'Abrir el panel de mi agencia' : `Abrir la agencia ${profile?.agency_name ?? ''}`}
              onPress={() => router.push('/agencia' as Href)}
              className="overflow-hidden rounded-2xl active:opacity-90">
              <LinearGradient
                colors={['#1F4FB8', '#123A86']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
                {profile?.agency_photo_url ? (
                  <Image source={{ uri: profile.agency_photo_url }} resizeMode="cover" style={{ width: 42, height: 42, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }} />
                ) : (
                  <View className="size-10 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
                    <Icon as={Building2} size={18} color="#BBDCFF" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-[13px] font-semibold" style={{ color: '#FFFFFF' }} numberOfLines={1}>
                    {profile?.agency_name ?? 'Mi agencia'}
                  </Text>
                  <Text className="mt-0.5 text-[11px]" style={{ color: 'rgba(219,236,255,0.75)' }}>
                    {roleBadge === 'agency' ? 'Nombre, logo y la meta de tu gente' : 'Tu agencia y la meta de cada persona'}
                  </Text>
                </View>
                <Icon as={ChevronRight} size={16} color="#BBDCFF" />
              </LinearGradient>
            </Pressable>
          </View>
        ) : null}

        {/* La única ficha de la membresía: aquí vive su nombre, y en ningún otro sitio. */}
        <View className="mt-3 px-4">
          <Text className="mb-2 ml-1 text-[11px] tracking-[0.18em]" style={{ color: accent.muted }}>MI SVIP</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={svip ? `${svip.name}, abrir la tienda SVIP` : 'Ver los estilos SVIP en la tienda'}
            onPress={() => router.push('/tienda/svip' as Href)}
            className="overflow-hidden rounded-2xl active:opacity-90">
            <LinearGradient
              colors={svip
                ? [svip.background[0], svip.background[1]]
                : accent.light ? ['#FFF7E6', '#FFFFFF'] : ['#241A33', '#171021']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
              {svip ? (
                <SvipShield level={svip.level} width={52} />
              ) : (
                <View className="size-10 items-center justify-center rounded-full" style={{ backgroundColor: accent.wash }}>
                  <Icon as={Sparkles} size={16} color={accent.main} />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-[13px] font-semibold" style={{ color: svip ? '#FFFFFF' : accent.text }}>
                  {svip ? svipStyleName(svip) : 'Sin membresía'}
                </Text>
                <Text className="mt-0.5 text-[11px]" style={{ color: svip ? 'rgba(255,255,255,0.82)' : accent.muted }}>
                  {svip
                    ? `${svipDays > 0 ? `Quedan ${svipDays} días` : 'Activa'} · marco, medalla, burbuja y fondo`
                    : 'Marco animado, medalla, burbuja y fondo de perfil'}
                </Text>
              </View>
              <Icon as={ChevronRight} size={16} color={svip?.accent ?? '#B3A897'} />
            </LinearGradient>
          </Pressable>

          {/* Experience sits with the membership, where the person's rank lives. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Nivel ${profile?.level ?? 1}, banda ${band.name}, ${progress.current} de ${progress.current + progress.left} de experiencia`}
            onPress={() => setLevelHelp(true)}
            className="mt-2.5 rounded-2xl px-3 py-2.5 active:opacity-85"
            style={{ backgroundColor: accent.wash, borderWidth: 1, borderColor: accent.line }}>
            <View className="flex-row items-center gap-1.5">
              <View className="rounded-full px-1.5 py-px" style={{ backgroundColor: band.colors[0] }}>
                <Text className="text-[11px] font-semibold" style={{ color: band.ink }}>{band.name}</Text>
              </View>
              <Text className="text-[11px]" style={{ color: accent.muted }}>Experiencia</Text>
              <View className="flex-1" />
              <Text className="text-[11px] tabular-nums" style={{ color: accent.muted }}>
                {progress.top ? 'Nivel máximo' : `${progress.done.toLocaleString('es-US')} / ${progress.target.toLocaleString('es-US')} XP`}
              </Text>
            </View>
            <View className="mt-1.5 h-2 overflow-hidden rounded-full" style={{ backgroundColor: accent.hairline }}>
              <View
                style={{
                  width: `${Math.round(progress.share * 100)}%`,
                  height: '100%',
                  borderRadius: 999,
                  backgroundColor: band.colors[1],
                }}
              />
            </View>
          </Pressable>
        </View>

        {/* Los accesos, en dos grupos: primero la gente y luego lo que es tuyo.
            Antes eran ocho filas seguidas y costaba encontrar una. */}
        {[
          {
            title: 'TU GENTE',
            rows: [
              { icon: Heart, tint: '#FB7185', label: 'Relación', hint: 'Pareja y conexiones', href: '/perfil/conexiones?tab=friends' },
              { icon: UserPlus, tint: '#F472B6', label: 'Invitar amigos', hint: 'Comparte tu sala', href: '/perfil/conexiones?tab=following&buscar=1' },
              { icon: Search, tint: '#60A5FA', label: 'Buscar por ID', hint: 'Con su número de 7 cifras', href: '/perfil/conexiones?tab=following&buscar=1' },
            ],
          },
          {
            title: 'TU ESTILO',
            rows: [
              { icon: Medal, tint: '#FBBF24', label: 'Medalla', hint: 'Tu insignia de perfil', href: '/tienda/svip' },
              { icon: Store, tint: '#F87171', label: 'Tienda', hint: 'Marcos, medallas y SVIP', href: '/tienda' },
              { icon: Shirt, tint: '#A78BFA', label: 'Mis artículos', hint: 'Lo que ya es tuyo', href: '/tienda/svip' },
              { icon: Clapperboard, tint: '#E879F9', label: 'Entrada con video', hint: 'Tu clip al entrar a una sala', href: '/perfil/entrada' },
            ],
          },
          {
            title: 'TU APP',
            rows: [
              { icon: ShieldCheck, tint: '#2DD4BF', label: 'Permisos y avisos', hint: 'Micrófono, cámara y fotos', href: '/perfil/permisos' },
            ],
          },
        ].map(group => (
          <View key={group.title} className="mx-4 mt-4">
            <Text className="mb-2 ml-1 text-[11px] tracking-[0.18em]" style={{ color: accent.muted }}>{group.title}</Text>
            <View className="overflow-hidden rounded-[20px]" style={{ backgroundColor: accent.raised, borderWidth: 1, borderColor: accent.line }}>
              {group.rows.map((row, index) => (
                <Pressable
                  key={row.label}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.label}. ${row.hint}`}
                  onPress={() => router.push(row.href as Href)}
                  className="flex-row items-center gap-3 px-4 active:opacity-70"
                  style={{ height: 54, borderBottomWidth: index === group.rows.length - 1 ? 0 : 1, borderBottomColor: accent.hairline }}>
                  <View className="size-7 items-center justify-center rounded-lg" style={{ backgroundColor: `${row.tint}22` }}>
                    <Icon as={row.icon} size={15} color={row.tint} />
                  </View>
                  <Text className="flex-1 text-[14px] font-semibold" style={{ color: accent.text }}>{row.label}</Text>
                  <Text className="text-[11px]" style={{ color: accent.muted }} numberOfLines={1}>{row.hint}</Text>
                  <Icon as={ChevronRight} size={15} color={accent.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View className="mx-4 mt-1 rounded-[20px] px-4 pb-4 pt-3" style={{ backgroundColor: accent.raised, borderWidth: 1, borderColor: accent.line }}>
            <Text className="text-[12px] font-semibold tracking-[0.18em]" style={{ color: accent.muted }}>TU PERFIL</Text>
            <ProfilePodium
              podium={podium}
              avatarUrl={profile?.avatar_url}
              onOpenRoom={roomId => router.push(`/room/${roomId}` as Href)}
            />

            {editing ? (
              <View className="mt-4 gap-2">
                <View className="border-border bg-background rounded-xl border px-3 py-2">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-muted-foreground text-[11px]">Nombre</Text>
                    <Text className="text-muted-foreground text-[11px] tabular-nums">{nameDraft.length}/{NAME_MAX}</Text>
                  </View>
                  <ProfileInput value={nameDraft} onChangeText={setNameDraft} placeholder="Tu nombre" label="Nombre del perfil" />
                </View>
                <View className="border-border bg-background rounded-xl border px-3 py-2">
                  <Text className="text-muted-foreground text-[11px]">Bio</Text>
                  <ProfileInput value={bioDraft} onChangeText={setBioDraft} placeholder="Cuéntale a la sala quién eres" label="Biografía del perfil" />
                </View>
                <View className="border-border bg-background rounded-xl border px-3 py-2">
                  <Text className="text-muted-foreground text-[11px]">Sexo</Text>
                  <View accessibilityRole="radiogroup" className="mt-1.5 flex-row gap-2">
                    {GENDERS.map(option => {
                      const active = genderDraft === option.key;
                      return (
                        <Pressable
                          key={option.key}
                          accessibilityRole="radio"
                          accessibilityLabel={`Sexo: ${option.label}`}
                          accessibilityState={{ selected: active }}
                          onPress={() => setGenderDraft(active ? '' : option.key)}
                          className={cn(
                            'h-9 flex-1 flex-row items-center justify-center gap-1.5 rounded-full border active:opacity-80',
                            active ? 'border-primary bg-primary/15' : 'border-border',
                          )}>
                          <Icon as={GENDER_ICONS[option.key]} size={14} className={active ? 'text-primary' : 'text-muted-foreground'} />
                          <Text className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-foreground')}>
                            {option.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text className="text-muted-foreground mt-1.5 text-[11px]">
                    Se ve en tu perfil. Toca otra vez para no decirlo.
                  </Text>
                </View>
                <Pressable accessibilityRole="button" disabled={pending} onPress={() => void save()} className="bg-primary h-11 flex-row items-center justify-center gap-1.5 rounded-full active:bg-primary/80">
                  {pending ? <ActivityIndicator size="small" color="#1A1409" /> : <Icon as={Save} className="text-primary-foreground size-4" />}
                  <Text className="text-primary-foreground text-sm font-semibold">Guardar perfil</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {gender ? (
                  <View
                    className="mt-3 flex-row items-center gap-1.5 self-start rounded-full px-2.5 py-1"
                    style={{ backgroundColor: accent.wash, borderWidth: 1, borderColor: accent.edge }}>
                    <Icon as={GENDER_ICONS[gender.key]} size={12} className="text-primary" />
                    <Text className="text-[11px] font-semibold" style={{ color: accent.main }}>{gender.label}</Text>
                  </View>
                ) : null}
                <Text className={cn('mt-2 text-[13px] leading-5', profile?.bio ? 'text-foreground' : 'text-muted-foreground')}>
                  {profile?.bio || 'Todavía no hay una bio. Cuéntale a la sala quién eres.'}
                </Text>
              </>
            )}

            {error ? <Notice tone="error" text={error} className="mx-0 mt-2" /> : null}
            {notice ? <Notice tone="success" text={notice} className="mx-0 mt-2" /> : null}

            <View className="mt-3 flex-row gap-2">
              {[
                { value: 0, label: 'MOMENTOS' },
                { value: daysInApp, label: daysInApp === 1 ? 'DÍA EN LA CASA' : 'DÍAS EN LA CASA' },
              ].map(stat => (
                <View key={stat.label} className="flex-1 items-center rounded-2xl py-3" style={{ backgroundColor: accent.wash }}>
                  <Text className="text-foreground text-base font-semibold tabular-nums">{stat.value}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-[11px] tracking-wide">{stat.label}</Text>
                </View>
              ))}
            </View>

            <Text className="mt-2 text-[11px] leading-4" style={{ color: accent.muted }}>
              {progress.top
                ? 'Llegaste al último nivel de la cuenta.'
                : `Te faltan ${progress.left.toLocaleString('es-US')} XP para el nivel ${(profile?.level ?? 1) + 1}.`}
            </Text>
        </View>

        <View className="mx-5 mt-6">
          <Text className="text-muted-foreground mb-2.5 ml-1 text-[11px] tracking-[0.18em]">TU CUENTA</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir mis ajustes"
            onPress={() => router.push('/perfil/ajustes' as Href)}
            className="border-primary/35 bg-primary/10 flex-row items-center gap-3 rounded-2xl border px-4 py-3.5 active:bg-muted">
            <View className="bg-primary/20 size-10 items-center justify-center rounded-full">
              <Icon as={Settings} className="text-primary size-[18px]" />
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[14px] font-semibold">Ajustes</Text>
              <Text className="text-muted-foreground mt-0.5 text-[11px]">
                Cuenta, país, modo oscuro o claro, permisos y bloqueos
              </Text>
            </View>
            <Icon as={ChevronRight} className="text-primary size-4" />
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={levelHelp} transparent animationType="fade" onRequestClose={() => setLevelHelp(false)}>
        <Pressable
          className="flex-1 justify-end bg-black/60"
          onPress={() => setLevelHelp(false)}
          accessibilityLabel="Cerrar la explicación del nivel">
          <Pressable className="border-border bg-card rounded-t-[26px] border px-5 pb-7 pt-3" onPress={() => undefined}>
            <View className="bg-border mx-auto mb-3 h-1 w-10 rounded-full" />
            <View className="flex-row items-center gap-2">
              <LevelPlaque level={profile?.level ?? 1} height={22} />
              <View className="flex-1">
                <Text className="text-foreground text-[15px] font-semibold">Nivel de tu cuenta</Text>
                <Text className="text-muted-foreground text-[11px]">{band.name} · {progress.current.toLocaleString('es-US')} XP en total</Text>
              </View>
            </View>

            <View className="bg-muted mt-3 h-2 overflow-hidden rounded-full">
              <View style={{ width: `${Math.round(progress.share * 100)}%`, height: '100%', borderRadius: 999, backgroundColor: band.colors[1] }} />
            </View>
            <Text className="text-muted-foreground mt-1.5 text-[11px]">
              {progress.top
                ? 'Estás en el nivel más alto.'
                : `${progress.done.toLocaleString('es-US')} de ${progress.target.toLocaleString('es-US')} XP para el nivel ${(profile?.level ?? 1) + 1}.`}
            </Text>

            <Text className="text-foreground mt-4 text-[12px] font-semibold">Cómo ganas experiencia</Text>
            {[
              { label: 'Escribir en el chat de una sala', xp: '+5 XP' },
              { label: 'Enviar un regalo', xp: '+1 XP por cada 10 diamantes' },
              { label: 'Recibir un regalo', xp: '+1 XP por cada 5 diamantes' },
            ].map(row => (
              <View key={row.label} className="mt-1.5 flex-row items-center gap-2">
                <View className="bg-primary/20 size-1.5 rounded-full" />
                <Text className="text-muted-foreground flex-1 text-[11px]">{row.label}</Text>
                <Text className="text-primary text-[11px] font-semibold">{row.xp}</Text>
              </View>
            ))}

            <Text className="text-muted-foreground mt-3 text-[11px] leading-4">
              El nivel no caduca y no se pierde. Los SVIP sí son aparte: duran 30 días y se renuevan con diamantes.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

    </SafeAreaView>
  );
}

function ProfileInput({ value, onChangeText, placeholder, label }: { value: string; onChangeText: (text: string) => void; placeholder: string; label: string }) {
  const limit = label.startsWith('Biografía') ? 200 : NAME_MAX;
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#8A8073"
      maxLength={limit}
      accessibilityLabel={label}
      className="text-foreground mt-0.5 text-[13px]"
      style={{ paddingVertical: 2 }}
    />
  );
}
