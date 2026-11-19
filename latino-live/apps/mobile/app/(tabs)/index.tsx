import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Bell, Gift, Headphones, Megaphone, Radio, Search, Sparkles, Trophy, Users, Video } from 'lucide-react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { acceptRoomInvite, getProfile, getRoom, getSeatsForRooms, listRoomInvites, listRooms, openRoom, useRoomsLive, type ProfileRow, type RoomInviteRow, type RoomRow, type SeatRow } from '@/lib/rooms';
import { roomPhotoUrl } from '@/lib/rooms';
import { COUNTRY_LABEL, coverSource, type CoverKey } from '@/lib/covers';
import { CreateRoomSheet } from '@/components/create-room-sheet';
import { AnimatedHouse } from '@/components/animated-house';
import { RankFrame } from '@/components/rank-frame';
import { compactDiamonds } from '@/components/room-seat';
import { getRoomRanking, useRankingLive, type RankedRoom } from '@/lib/pk';
import { useRoomSession } from '@/features/room-session';
import { Modal } from 'react-native';
import { cn } from '@/lib/utils';
import { useDataSaver } from '@/lib/power';
import { getFollowedRoomOpens, useFollowedRoomLive, type FollowedRoomOpen } from '@/lib/notices-data';
import { loadNoticesSeen } from '@/lib/preferences';
import { showSystemNotice } from '@/lib/notices';
import { readBillboard, writeBillboard } from '@/lib/billboard-cache';
import { useAccent } from '@/lib/theme-accent';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import { BillboardCarousel } from '@/components/billboard-carousel';
import { mergeCards, type BillboardCard } from '@/lib/billboard-merge';
import { CATALOG_MAX, catalogColumns } from '@/lib/responsive';
import { useResponsive } from '@/lib/use-responsive';
import { Notice } from '@/components/state-views';
import { RoomCardSkeleton } from '@/components/ui/skeleton';

/**
 * One row of filters. The first three talk about the kind of hall, which is
 * what the person choosing a room cares about; the last three about where it
 * is. A room without a mode is a voice hall, the way older rooms were made.
 */
const FILTERS = ['Todo', 'Hot', 'Audio', 'Cámara', 'USA', 'España', 'México'];
const MODE_FILTERS = new Set(['Audio', 'Cámara']);
const SEEN_NOTICES_KEY = 'sahar:notices:seen';

// Some phones ship without Spanish number data; plain digits always work.
function seatCount(value: number) {
  try {
    return new Intl.NumberFormat('es-US').format(value);
  } catch {
    return String(value);
  }
}

type Card = BillboardCard;

const RoomCard = memo(function RoomCard({ card, mine, onEnter, lite, width, height }: { card: Card; mine: boolean; onEnter: (room: RoomRow) => void; lite?: boolean; width?: number; height?: number }) {
  const accent = useAccent();
  const occupied = card.seats.length;
  const host = card.seats.find(seat => seat.seat_no === 1);
  // Data saving shows the house's own painted cover, which ships with the app,
  // instead of downloading every host's photo for the billboard.
  const cover = lite || !card.room.background_path
    ? coverSource(card.room.cover)
    : { uri: roomPhotoUrl(card.room.background_path) };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Entrar a la sala ${card.room.title}, ${occupied} personas sentadas`}
      onPress={() => onEnter(card.room)}
      className={cn(
        'overflow-hidden rounded-[20px] border active:opacity-85',
        Platform.select({ web: 'outline-none transition-transform hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring' }),
      )}
      style={{
        borderColor: accent.edge,
        backgroundColor: accent.raised,
        // Una sola altura para todas: la rejilla se lee como una tabla y no
        // como una colección de tarjetas de tamaños distintos.
        width: width ?? '48.5%',
        height: height ?? 200,
      }}>
      <ImageBackground
        // The room's own photo when the host set one, its cover otherwise.
        source={cover}
        resizeMode="cover"
        // Una foto de cámara llega enorme y se dibuja en una tarjeta: Android
        // la reduce al leerla y la tarjeta no se come la memoria de una foto.
        resizeMethod="resize"
        fadeDuration={0}
        className="flex-1 justify-between p-2.5">

        <LinearGradient
          colors={['rgba(9,10,26,0.10)', 'rgba(9,10,26,0.42)', 'rgba(9,10,26,0.96)']}
          locations={[0, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View className="flex-row items-start justify-between">
          <View
            className="rounded-full px-2 py-0.5"
            style={mine
              ? { backgroundColor: '#7C3AED' }
              : card.room.is_official
                ? { backgroundColor: 'rgba(9,10,26,0.66)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' }
                : { backgroundColor: accent.main }}>
            <Text className={cn('text-[11px] font-bold', !mine && !card.room.is_official ? '' : 'text-white')} style={!mine && !card.room.is_official ? { color: accent.ink } : undefined}>
              {mine ? 'TU SALA' : card.room.is_official ? 'OFICIAL' : 'EN VIVO'}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            {/* A camera room says so before anyone walks in. */}
            {card.room.room_mode === 'camera' ? (
              <View className="flex-row items-center gap-1 rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(9,10,26,0.66)' }}>
                <Icon as={Video} size={10} className="text-white/85" />
                <Text className="text-[11px] font-semibold tracking-wide text-white/85">CÁMARA</Text>
              </View>
            ) : null}
            <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(9,10,26,0.66)' }}>
              <Text className="text-[11px] font-semibold tracking-wide text-white/85">{card.room.country}</Text>
            </View>
          </View>
        </View>

        <View className="gap-1">
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '600', lineHeight: 18 }} numberOfLines={2}>
            {card.room.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Avatar alt={host?.display_name ?? card.room.host_name} className="size-5 border" style={{ borderColor: accent.main }}>
              {host?.avatar_url ? <AvatarImage source={{ uri: host.avatar_url }} /> : null}
              <AvatarFallback style={{ backgroundColor: accent.wash }}>
                <Text className="text-[11px] font-semibold" style={{ color: accent.main }}>{(host?.display_name ?? card.room.host_name).slice(0, 1)}</Text>
              </AvatarFallback>
            </Avatar>
            <Text style={{ color: 'rgba(255,255,255,0.86)', flex: 1, fontSize: 11 }} numberOfLines={1}>
              {card.room.host_name}
            </Text>
            <Icon as={occupied > 0 ? Users : Headphones} size={12} className="text-white/65" />
            <Text style={{ color: 'rgba(255,255,255,0.86)', fontSize: 11 }}>{occupied}/{card.room.max_seats}</Text>
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
});

export default function Salas() {
  const { session } = useAuth();
  const accent = useAccent();
  const day = accent.light;
  const dataSaver = useDataSaver();
  const [filter, setFilter] = useState('Todo');
  const [cards, setCards] = useState<Card[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  // Pulling to refresh is its own state: the first load must not look like a
  // gesture the person did not make.
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const roomSession = useRoomSession();
  const [switchTarget, setSwitchTarget] = useState<RoomRow | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  // Today's best rooms: diamonds received and battles won.
  const [ranking, setRanking] = useState<RankedRoom[]>([]);
  /** The width the three TOP frames share, measured once they are drawn. */
  const [rankRowWidth, setRankRowWidth] = useState(0);
  const { width: windowWidth } = useResponsive();
  // The rooms other people invited this person to.
  const [invites, setInvites] = useState<RoomInviteRow[]>([]);
  // The rooms the people this person follows opened, newest first.
  const [followedOpens, setFollowedOpens] = useState<FollowedRoomOpen[]>([]);
  /** A dot on the bell: openings this person has not opened Avisos for yet. */
  const [unread, setUnread] = useState(0);
  // Read once: the person's own card does not change while browsing rooms.
  const myProfile = useRef<ProfileRow | null>(null);

  const busy = useRef(false);
  const queued = useRef(false);
  const alive = useRef(true);
  const loadRef = useRef<(mode?: 'initial' | 'refresh' | 'live') => Promise<void>>(async () => undefined);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'live' = 'initial') => {
    // A live event that lands while the billboard is already loading waits for
    // that load instead of starting a second one on top of it.
    if (busy.current) {
      if (mode !== 'initial') queued.current = true;
      return;
    }
    busy.current = true;
    if (mode === 'refresh') setRefreshing(true);
    try {
      if (mode !== 'live') setError(null);
      const rooms = await listRooms();
      // The billboard is the rooms and who is sitting: that is all that has to
      // arrive before the screen is useful. Everything else is read after, so
      // a slow invitation or notice never holds the cards on a blank screen.
      const [seats, nextRanking] = await Promise.all([
        getSeatsForRooms(rooms.map(room => room.id)),
        getRoomRanking(5).catch(() => []),
      ]);
      // Solo la sala que cambió reemplaza su tarjeta; las demás se quedan.
      setCards(current => mergeCards(current, rooms, seats));
      setRanking(nextRanking);
      // A copy stays on the phone so the next launch shows the rooms at once.
      writeBillboard(rooms, seats);
      setLoading(false);
      if (mode === 'live') return;

      // The personal parts: the person's card, invitations, the rooms their
      // friends opened and the dot on the bell. None of them blocks the list.
      const [mine, pending, opens, seenRemote, seenLocal] = await Promise.all([
        session?.user.id && !myProfile.current ? getProfile(session.user.id).catch(() => null) : Promise.resolve(null),
        session?.user.id ? listRoomInvites(session.user.id).catch(() => []) : Promise.resolve([]),
        session?.user.id ? getFollowedRoomOpens(4).catch(() => []) : Promise.resolve([]),
        session?.user.id ? loadNoticesSeen() : Promise.resolve(null),
        AsyncStorage.getItem(SEEN_NOTICES_KEY).catch(() => null),
      ]);
      if (mine) {
        myProfile.current = mine;
        setProfile(mine);
      }
      setInvites(pending);
      setFollowedOpens(opens);
      const seen = [seenRemote, seenLocal].filter(Boolean).sort().pop() ?? null;
      setUnread(seen ? opens.filter(open => open.opened_at > seen).length : opens.length);
    } catch {
      // A quiet refresh that fails leaves the billboard as it is; only a screen
      // with nothing to show needs the message.
      if (mode !== 'live') setError('No pudimos cargar las salas. Desliza hacia abajo para reintentar.');
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
      if (queued.current && alive.current) {
        queued.current = false;
        setTimeout(() => { void loadRef.current('live'); }, 250);
      }
    }
  }, [session?.user.id]);
  loadRef.current = load;

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => { alive.current = false; }, []);
  useRoomsLive(() => { void loadRef.current('live'); });

  // The last billboard this phone saw appears immediately, before the network
  // answers: opening the app never starts from a blank screen.
  useEffect(() => {
    let live = true;
    void readBillboard().then(cached => {
      if (!live || !cached || cached.rooms.length === 0) return;
      // A live answer that already landed is fresher than the copy.
      setCards(current => (current.length > 0 ? current : cached.rooms.map(room => ({
        room,
        seats: cached.seats[room.id] ?? [],
      }))));
      setLoading(false);
    });
    return () => { live = false; };
  }, []);

  // A gift in any room moves the podium. Only the ranking is read again, so the
  // places change in place: the cards, the chat and the photos stay untouched.
  const refreshRanking = useCallback(async () => {
    try {
      setRanking(await getRoomRanking(5));
    } catch {
      // The next gift or the pull to refresh corrects it.
    }
  }, []);
  useRankingLive(() => { void refreshRanking(); });

  // Una sala que abre alguien a quien sigues avisa en el teléfono y deja su
  // punto en la campana. La tarjeta bajo las invitaciones se quitó: la sala ya
  // aparece en la cartelera con las demás.
  useFollowedRoomLive(session?.user.id ?? null, useCallback((event: FollowedRoomOpen) => {
    setFollowedOpens(current => [event, ...current.filter(item => item.id !== event.id)].slice(0, 4));
    setUnread(value => value + 1);
    void showSystemNotice(`${event.host_name} abrió una sala`, `${event.room_title} · toca para entrar`);
  }, []));

  const goToRoom = useCallback((target: RoomRow) => {
    if (roomSession.room && roomSession.room.slug !== target.slug) {
      setSwitchTarget(target);
      return;
    }
    router.push(`/room/${target.slug}` as Href);
  }, [roomSession.room]);

  const shown = useMemo(() => {
    if (filter === 'Todo') return cards;
    if (filter === 'Hot') return cards.filter(card => card.seats.length >= 2);
    // The hall's mode: a room that never chose one is a voice hall.
    if (filter === 'Audio') return cards.filter(card => card.room.room_mode !== 'camera');
    if (filter === 'Cámara') return cards.filter(card => card.room.room_mode === 'camera');
    return cards.filter(card => COUNTRY_LABEL[card.room.country] === filter);
  }, [cards, filter]);

  const myRoom = cards.find(card => session?.user.id && card.room.host_id === session.user.id);

  // La rejilla de salas se mide sola: dos columnas en el teléfono y tres en
  // una pantalla grande, con la tarjeta en la misma proporción en las dos.
  const [gridWidth, setGridWidth] = useState(0);
  const gridColumns = catalogColumns(gridWidth || windowWidth);
  const cardGap = 10;
  const cardWidth = gridWidth > 0
    ? Math.floor((gridWidth - cardGap * (gridColumns - 1)) / gridColumns)
    : undefined;
  const cardHeight = cardWidth
    ? Math.round(Math.min(248, Math.max(186, cardWidth * 1.16)))
    : 200;

  /**
   * La cartelera de arriba: un anuncio, el evento de la casa y la promoción de
   * la billetera. Cada aviso dura dos segundos y pasa solo al siguiente, sin
   * que nadie tenga que deslizar. Al tocar el aviso se hace lo que propone.
   */
  const billboard = useMemo(
    () => [
      {
        key: 'anuncio',
        tag: 'ANUNCIO',
        meta: 'Latino Live',
        title: 'La sala te espera',
        body: 'Entra, siéntate y habla con la gente en vivo.',
        cta: 'Ver salas',
        icon: Megaphone,
        // La primera cartelera es la voz de la casa: lleva el acento del modo,
        // no un violeta fijo que desentonaría con el papel del modo claro.
        tint: accent.main,
        edge: accent.edge,
        wash: accent.wash,
        action: () => {
          const first = shown[0];
          if (first) goToRoom(first.room);
        },
        busy: false,
      },
      {
        key: 'evento',
        tag: 'EVENTO',
        meta: 'Torneo Ahlan · semanal',
        title: 'La sala que más brilla gana 50.000 de oro.',
        body: '',
        cta: myRoom ? 'Mi sala' : 'Abrir sala',
        icon: Trophy,
        tint: accent.main,
        edge: accent.edge,
        wash: accent.wash,
        action: () => (myRoom ? goToRoom(myRoom.room) : session ? setCreateOpen(true) : router.push('/entrar' as Href)),
        busy: creating,
      },
      {
        key: 'promo',
        tag: 'PROMOCIÓN',
        meta: 'Billetera',
        title: 'Recarga tus diamantes',
        body: 'Hazte notar: compra diamantes y regala en las salas.',
        cta: 'Billetera',
        icon: Gift,
        tint: accent.warm,
        edge: day ? 'rgba(168,98,12,0.34)' : 'rgba(255,122,92,0.42)',
        wash: day ? 'rgba(168,98,12,0.10)' : 'rgba(255,122,92,0.16)',
        action: () => router.push('/billetera' as Href),
        busy: false,
      },
    ],
    [accent, creating, day, goToRoom, myRoom, session, shown],
  );
  async function createMyRoom(
    title: string,
    cover: CoverKey,
    shape: { layout: string | null; seats: number; mode: 'audio' | 'camera' },
  ) {
    if (!session) {
      router.push('/entrar' as Href);
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const id = await openRoom(title || `Sala de ${profile?.display_name ?? 'Latino Live'}`, cover, profile?.country ?? 'US', shape);
      const created = await getRoom(id);
      setCreateOpen(false);
      if (created) {
        router.push(`/room/${created.slug}?created=1` as Href);
      } else {
        setCreateError('La sala se abrió, pero no pudimos entrar. Búscala en la cartelera.');
        await load();
      }
    } catch {
      setCreateError('No pudimos abrir tu sala. Inténtalo otra vez.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: accent.surface }}>
      {/* La casa de noche, y la misma casa de día: papel cálido, oro en las
          luces y la tinta que sostiene las tarjetas. */}
      <LinearGradient
        colors={day
          ? ['#F8F6F1', '#F1EFEA', '#EAE6DE', '#F1EFEA']
          : ['#16100E', '#110C0C', '#0C0808', '#080607']}
        locations={[0, 0.34, 0.68, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 460 }}
      />
      {/* De día el papel no lleva manchas: el oro se queda en una línea tenue
          arriba. De noche las brasas siguen encendidas tras el encabezado. */}
      {day ? (
        <View pointerEvents="none" style={{ position: 'absolute', top: 96, left: 20, right: 20, height: 1, backgroundColor: 'rgba(138,91,8,0.14)' }} />
      ) : (
        <>
          <View pointerEvents="none" style={{ position: 'absolute', top: 30, right: 18, width: 116, height: 116, borderRadius: 58, backgroundColor: 'rgba(255,194,75,0.12)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 168, left: -34, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,194,75,0.07)' }} />
          <View pointerEvents="none" style={{ position: 'absolute', top: 104, right: 128, width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(255,122,92,0.07)' }} />
        </>
      )}
      <ScrollView
        // La cartelera se centra y no pasa de su ancho: en una tablet las
        // tarjetas se quedan del tamaño de un teléfono en vez de estirarse.
        contentContainerStyle={{ paddingBottom: 112, width: '100%', maxWidth: CATALOG_MAX, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadRef.current('refresh')} tintColor={accent.main} />}>
        <View className="flex-row items-center gap-2 px-5 pb-4 pt-3">
          {/* The app's emblem, drawn from its transparent PNG. */}
          <Image
            source={require('@/assets/brand-mark.webp')}
            resizeMode="contain"
            style={{ width: 44, height: 44 }}
            accessibilityIgnoresInvertColors
          />
          <View className="flex-1">
            <Text className="text-[16px] font-semibold tracking-[0.04em]" style={{ color: accent.text }} numberOfLines={1}>LATINO LIVE</Text>
            <Text className="text-[11px] tracking-[0.1em]" style={{ color: day ? 'rgba(142,95,11,0.85)' : 'rgba(255,194,75,0.75)' }} numberOfLines={1}>SALAS DE VOZ</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tu monedero de diamantes"
            onPress={() => router.push('/perfil' as Href)}
            className="h-9 flex-row items-center gap-1 rounded-full px-2.5 active:opacity-70"
            style={day
              ? { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: accent.hairline }
              : { backgroundColor: 'rgba(124,58,237,0.55)', borderWidth: 1, borderColor: 'rgba(233,213,255,0.22)' }}>
            <SparklingDiamond size={16} animated={false} />
            <Text className="text-sm font-semibold tabular-nums" style={{ color: day ? accent.text : '#FFFFFF' }}>{compactDiamonds(profile?.diamonds ?? 0)}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={unread > 0 ? `Notificaciones, ${unread} nuevas` : 'Notificaciones'}
            onPress={() => router.push(session ? '/notificaciones' : '/entrar')}
            className="size-9 items-center justify-center rounded-full active:opacity-70"
            style={day
              ? { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: accent.hairline }
              : { backgroundColor: 'rgba(255,255,255,0.09)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}>
            <Icon as={Bell} size={16} color={day ? accent.text : 'rgba(255,255,255,0.85)'} />
            {unread > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 6,
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: accent.main,
                  borderWidth: 1.5,
                  borderColor: accent.surface,
                }}
              />
            ) : null}
          </Pressable>
        </View>

        <View className="px-5">
          {/* Somebody invited this person to a room: it comes before anything else. */}
          {invites.map(invite => (
            <Pressable
              key={invite.id}
              accessibilityRole="button"
              accessibilityLabel={`Entrar a ${invite.room_title}, invitación de ${invite.from_name}`}
              onPress={() => {
                void acceptRoomInvite(invite.id);
                router.push(`/room/${invite.room_slug}${invite.join_code ? `?code=${invite.join_code}` : ''}` as Href);
              }}
              className="mb-3 flex-row items-center gap-3 rounded-2xl p-3 active:opacity-85"
              style={{ backgroundColor: day ? '#FFFFFF' : 'rgba(124,58,237,0.16)', borderWidth: 1, borderColor: day ? accent.hairline : 'rgba(196,181,253,0.32)' }}>
              <View className="size-10 items-center justify-center rounded-full" style={{ backgroundColor: day ? accent.wash : 'rgba(196,181,253,0.18)' }}>
                <Icon as={Sparkles} size={16} color={day ? accent.main : '#E9D5FF'} />
              </View>
              <View className="flex-1">
                <Text className="text-[13px] font-semibold" style={{ color: day ? accent.text : '#FFFFFF' }} numberOfLines={1}>
                  {invite.from_name} te invitó a {invite.room_title}
                </Text>
                <Text className="mt-0.5 text-[11px]" style={{ color: day ? accent.muted : 'rgba(255,255,255,0.6)' }} numberOfLines={1}>
                  {invite.join_code ? 'Sala privada · el código ya viene' : 'Toca para entrar y ocupar un asiento'}
                </Text>
              </View>
              <View className="h-8 items-center justify-center rounded-full px-3" style={{ backgroundColor: accent.main }}>
                <Text className="text-[12px] font-semibold" style={{ color: accent.ink }}>Entrar</Text>
              </View>
            </Pressable>
          ))}

          {/* Cartelera: anuncio, evento y promoción se turnan solos cada dos
              segundos, dentro de su propio recuadro: el turno no redibuja la
              cartelera de salas ni el podio. */}
          <BillboardCarousel
            items={billboard}
            day={day}
            text={day ? accent.text : '#FFFFFF'}
            muted={accent.muted}
            ink={accent.ink}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 px-5 py-5">
          {FILTERS.map(item => {
            const active = item === filter;
            const ModeIcon = item === 'Audio' ? Headphones : item === 'Cámara' ? Video : null;
            return (
              <Pressable
                key={item}
                accessibilityLabel={item === 'Audio' ? 'Salas de audio' : item === 'Cámara' ? 'Salas de cámara' : item}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setFilter(item)}
                style={active
                  ? { backgroundColor: accent.main, borderColor: accent.main }
                  : day
                    ? { backgroundColor: '#FFFFFF', borderColor: accent.hairline }
                    : { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.12)' }}
                className={cn('h-9 flex-row items-center justify-center gap-1 rounded-full border active:opacity-80', ModeIcon ? 'px-3.5' : 'px-4')}>
                {ModeIcon ? <Icon as={ModeIcon} size={12} color={active ? accent.ink : day ? '#4A4338' : 'rgba(255,255,255,0.85)'} /> : null}
                <Text className="text-[13px] font-medium" style={{ color: active ? accent.ink : day ? '#4A4338' : 'rgba(255,255,255,0.85)' }}>{item}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {ranking.some(item => Number(item.score) > 0) ? (
          <>
            <View className="flex-row items-center justify-between px-5 pb-2">
              <View className="flex-row items-center gap-1.5">
                <Icon as={Trophy} size={16} color={accent.main} />
                <Text className="text-base font-semibold" style={{ color: accent.text }}>Ranking de hoy</Text>
              </View>
              <Text className="text-xs" style={{ color: accent.muted }}>Diamantes + PK</Text>
            </View>
            {/* The three TOP frames the owner supplied, the winner in the middle
                where a podium puts it, and the rest of the list below. The three
                share the width of the screen: there is nothing to slide. */}
            <View
              className="flex-row items-end justify-center gap-0.5 px-3 pb-1"
              onLayout={event => setRankRowWidth(event.nativeEvent.layout.width)}>
              {[1, 0, 2].map(position => {
                const top = ranking.filter(item => Number(item.score) > 0);
                const item = top[position];
                if (!item) return null;
                const card = cards.find(entry => entry.room.id === item.room_id);
                const host = card?.seats.find(seat => seat.seat_no === 1);
                const isFirst = position === 0;
                // The middle frame takes the biggest share; the sides fill what
                // is left, so all three always fit between the screen's edges.
                const width = rankRowWidth > 0
                  ? Math.round(rankRowWidth * (isFirst ? 0.4 : 0.295))
                  : (isFirst ? 150 : 110);
                return (
                  <Pressable
                    key={item.room_id}
                    accessibilityRole="button"
                    accessibilityLabel={`Puesto ${position + 1}, ${item.title}, ${seatCount(Number(item.gold))} diamantes en regalos`}
                    disabled={!card}
                    onPress={() => { if (card) goToRoom(card.room); }}
                    className={cn('items-center pb-1 active:opacity-85', isFirst ? 'pt-0' : 'pt-2')}
                    style={{ width }}>
                    <RankFrame
                      rank={position + 1}
                      width={width - 6}
                      // The photo the host put on the room, exactly as it looks
                      // inside the room; the host's face only fills the gap.
                      uri={dataSaver ? null : item.photo_path ? roomPhotoUrl(item.photo_path) : host?.avatar_url ?? null}
                      name={item.title}
                    />
                    <Text className={cn('mt-0 w-full text-center font-semibold', isFirst ? 'text-[12px]' : 'text-[11px]')} style={{ color: accent.text }} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <View className="mt-0 flex-row items-center gap-1">
                      <SparklingDiamond size={14} animated={false} />
                      <Text className="text-[11px] font-semibold" style={{ color: accent.muted }}>{seatCount(Number(item.gold))}</Text>
                      {Number(item.pk_wins) > 0 ? (
                        <View className="ml-1 flex-row items-center gap-0.5 rounded-full px-1.5 py-0.5" style={{ backgroundColor: 'rgba(255,194,75,0.16)' }}>
                          <Icon as={Trophy} size={10} color={accent.main} />
                          <Text className="text-[11px] font-semibold" style={{ color: accent.main }}>{Number(item.pk_wins)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {ranking.filter(item => Number(item.score) > 0).slice(3, 5).map((item, index) => {
              const card = cards.find(entry => entry.room.id === item.room_id);
              return (
                <Pressable
                  key={item.room_id}
                  accessibilityRole="button"
                  accessibilityLabel={`Puesto ${index + 4}, ${item.title}, ${seatCount(Number(item.gold))} diamantes en regalos`}
                  disabled={!card}
                  onPress={() => { if (card) goToRoom(card.room); }}
                  className="mx-5 mb-1.5 flex-row items-center gap-2 rounded-xl px-1 py-1 active:opacity-80">
                  <Text className="w-6 text-center text-[12px] font-bold" style={{ color: accent.muted }}>#{index + 4}</Text>
                  <Text className="flex-1 text-[12px] font-medium" style={{ color: accent.text }} numberOfLines={1}>{item.title}</Text>
                  <SparklingDiamond size={14} animated={false} />
                  <Text className="text-[12px] font-semibold" style={{ color: accent.muted }}>{seatCount(Number(item.gold))}</Text>
                </Pressable>
              );
            })}
          </>
        ) : null}

        <View className="flex-row items-center justify-between px-5 pb-3">
          <View className="flex-row items-center gap-1.5">
            <Icon as={Radio} size={15} color={accent.main} />
            <Text className="text-base font-semibold" style={{ color: accent.text }}>Salas en vivo</Text>
          </View>
          <Text className="text-xs" style={{ color: accent.muted }}>{shown.length} salas</Text>
        </View>

        {error ? (
          <Notice tone="error" text={error} onRetry={() => void loadRef.current('refresh')} />
        ) : null}

        <View className="flex-row flex-wrap justify-between gap-y-3 px-5" onLayout={event => setGridWidth(event.nativeEvent.layout.width - 40)}>
          {shown.map(card => (
            <RoomCard
              key={card.room.id}
              card={card}
              mine={card.room.host_id === session?.user.id}
              lite={dataSaver}
              width={cardWidth}
              height={cardHeight}
              onEnter={goToRoom}
            />
          ))}
        </View>

        {loading && cards.length === 0 ? (
          <View className="flex-row flex-wrap justify-between gap-y-3 px-5 pt-1">
            {[0, 1, 2, 3].map(index => (
              <View key={index} style={{ width: cardWidth ?? '48.5%' }}>
                <RoomCardSkeleton height={cardHeight} />
              </View>
            ))}
          </View>
        ) : null}

        {!loading && shown.length === 0 ? (
          <View className="mx-5 items-center gap-2 rounded-2xl px-6 py-10" style={{ backgroundColor: day ? '#FFFFFF' : 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: day ? accent.hairline : 'rgba(255,255,255,0.09)' }}>
            <Icon as={Search} size={18} color={day ? accent.muted : 'rgba(255,255,255,0.45)'} />
            <Text className="text-sm font-medium" style={{ color: accent.text }}>
              {filter === 'Cámara'
                ? 'No hay salas de cámara ahora'
                : filter === 'Audio'
                  ? 'No hay salas de audio ahora'
                  : filter === 'Hot'
                    ? 'Todavía no hay salas con gente'
                    : 'No hay salas en este país ahora'}
            </Text>
            <Text className="text-center text-xs" style={{ color: accent.muted }}>
              {MODE_FILTERS.has(filter)
                ? 'Prueba con Todo, o abre tu propia sala en ese modo para empezar.'
                : 'Prueba con Todo, o abre tu propia sala para empezar.'}
            </Text>
            {MODE_FILTERS.has(filter) ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver todas las salas"
                onPress={() => setFilter('Todo')}
                className="mt-1 h-9 justify-center rounded-full px-4 active:opacity-85"
                style={{ backgroundColor: accent.wash, borderWidth: 1, borderColor: accent.edge }}>
                <Text className="text-[12px] font-semibold" style={{ color: accent.main }}>Ver todas</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {/* Con más aire abajo: el aviso no se mete bajo la barra ni bajo el
            botón de abrir sala. */}
        <View className="mt-6 mb-16 flex-row items-start gap-2 px-5">
          <Icon as={Sparkles} size={14} color={accent.main} />
          <Text className="flex-1 text-xs" style={{ color: accent.muted }}>Las salas y el chat se actualizan en vivo entre todos los teléfonos.</Text>
          <Text className="shrink-0 text-xs tabular-nums" style={{ color: accent.muted }}>{seatCount(cards.reduce((sum, card) => sum + card.seats.length, 0))} en salas</Text>
        </View>
      </ScrollView>

      {/* A single floating circle: your room when you host, a quick way to open one when you do not. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          myRoom
            ? `Abrir mi sala ${myRoom.room.title}, ${myRoom.seats.length} de ${myRoom.room.max_seats} asientos ocupados`
            : 'Abrir mi sala'
        }
        disabled={creating}
        onPress={() => (myRoom ? goToRoom(myRoom.room) : session ? setCreateOpen(true) : router.push('/entrar' as Href))}
        className="size-[52px] items-center justify-center rounded-full active:opacity-85"
        style={{
          // Dentro de la columna centrada: en una pantalla ancha el boton no
          // se va solo al borde de la ventana.
          position: 'absolute',
          left: Math.max(20, windowWidth / 2 + (Math.min(windowWidth, CATALOG_MAX) / 2) - 20 - 52),
          bottom: 92,
          backgroundColor: accent.main,
          shadowColor: '#000',
          shadowOpacity: 0.45,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 10,
        }}>
        {creating
          ? <ActivityIndicator size="small" color={accent.ink} />
          : <AnimatedHouse size={26} color={accent.ink} />}
        {myRoom ? (
          <View
            className="absolute -right-0.5 -top-0.5 h-[22px] min-w-[22px] items-center justify-center rounded-full px-1"
            style={{ backgroundColor: '#7C3AED', borderWidth: 2, borderColor: '#070A1A' }}>
            <Text className="text-[11px] font-bold tabular-nums" style={{ color: '#FFFFFF' }}>
              {myRoom.seats.length}
            </Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={switchTarget !== null} transparent animationType="fade" onRequestClose={() => setSwitchTarget(null)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setSwitchTarget(null)} accessibilityLabel="Cerrar aviso de sala">
          <Pressable className="border-border bg-card rounded-t-[28px] border px-5 pb-8 pt-3" onPress={() => undefined}>
            <View className="bg-border mx-auto mb-4 h-1 w-10 rounded-full" />
            <Text className="text-foreground text-lg font-semibold">Estás en otra sala</Text>
            <Text className="text-muted-foreground mt-1 text-[13px] leading-5">
              {roomSession.room ? `Sigues en "${roomSession.room.title}".` : 'Sigues en una sala.'} Para entrar en
              {switchTarget ? ` "${switchTarget.title}"` : ' otra sala'} tienes que salir de la actual.
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quedarme en la sala actual"
                onPress={() => setSwitchTarget(null)}
                className="border-border h-12 flex-1 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-sm font-semibold">Quedarme</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Salir de la sala actual y entrar en la otra"
                onPress={() => {
                  const target = switchTarget;
                  roomSession.leave();
                  setSwitchTarget(null);
                  if (target) router.push(`/room/${target.slug}` as Href);
                }}
                className="bg-primary h-12 flex-1 items-center justify-center rounded-full active:bg-primary/80">
                <Text className="text-primary-foreground text-sm font-semibold">Salir y entrar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CreateRoomSheet
        visible={createOpen}
        pending={creating}
        defaultTitle={`Sala de ${profile?.display_name ?? 'Latino Live'}`}
        error={createError}
        onClose={() => { setCreateOpen(false); setCreateError(null); }}
        onCreate={(title, cover, shape) => void createMyRoom(title, cover, shape)}
      />
    </SafeAreaView>
  );
}
