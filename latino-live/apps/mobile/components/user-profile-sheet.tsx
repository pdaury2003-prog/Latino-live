import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ban, Building2, Check, ChevronLeft, Copy, Disc3, Flag, Heart, HelpCircle, MessageCircle, Shield, Sparkles } from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { AvatarPhoto } from '@/components/avatar-photo';
import { SvipAvatarFrame, SvipChip } from '@/components/svip-frame';
import { FramedAvatar } from '@/components/framed-avatar';
import { ProfileBanner, profileBannerBox } from '@/components/profile-banner';
import { SvipShieldSmall } from '@/components/gold-plate';
import { ACTION_ICONS } from '@/lib/gold';
import { LevelPlaque } from '@/components/level-badge';
import { RoleBadge } from '@/components/role-badge';
import { RoleFrame } from '@/components/role-frame';
import { isBadgeKind } from '@/lib/badges';
import { Text } from '@/components/ui/text';
import {
  getProfile,
  getProfileStats,
  recordProfileVisit,
  toggleFollow,
  type ProfileRow,
  type ProfileStats,
} from '@/lib/rooms';
import { blockUser } from '@/lib/blocks';
import { askCouple } from '@/lib/couples';
import { REPORT_REASONS, reportPerson, type ReportReason } from '@/lib/reports';
import { COUNTRY_LABEL } from '@/lib/covers';
import { genderOf } from '@/lib/gender';
import { cachedProfile } from '@/lib/profile-cache';
import { GENDER_ICONS } from '@/lib/gender-icons';
import { liveSvipLevel, profileCardPalette, svipDaysLeft, svipShows, svipStyleName, svipTheme } from '@/lib/svip';
import { cn } from '@/lib/utils';

type Props = {
  visible: boolean;
  userId: string | null;
  /** The room the card was opened from: its gifts are what the seat counted. */
  roomId?: string | null;
  fallbackName: string;
  fallbackAvatar: string | null;
  isHostSeat: boolean;
  isSelf: boolean;
  onClose: () => void;
  onGift: () => void;
  onModerate?: () => void;
  /** The host names this person as the room DJ. */
  onMakeDj?: () => void;
};

const EMPTY: ProfileStats = { followers: 0, following: 0, friends: 0, visitors: 0, is_following: false };

/**
 * The member card: who this person is, their real counts, and following or
 * sending a gift without leaving the room.
 */
export function UserProfileSheet({ visible, userId, roomId, fallbackName, fallbackAvatar, isHostSeat, isSelf, onClose, onGift, onModerate, onMakeDj }: Props) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [stats, setStats] = useState<ProfileStats>(EMPTY);
  const [loading, setLoading] = useState(false);
  /** La ficha que se ve es la guardada: la red no respondió. */
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);
  /** El menú del «?»: las acciones de moderación, o el motivo de la denuncia. */
  const [menu, setMenu] = useState<'closed' | 'actions' | 'report'>('closed');
  const [reportReason, setReportReason] = useState<ReportReason | null>(null);
  const [reportDetail, setReportDetail] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** Cuánto se ha arrastrado la ficha hacia abajo con el dedo. */
  const dragY = useRef(new Animated.Value(0)).current;
  // Whose card the screen is showing: a slow answer for the last person
  // never lands on the card of the person opened after them.
  const asking = useRef<string | null>(null);

  const load = useCallback(async () => {
    asking.current = userId;
    if (!userId) {
      // A host without an account still has a name to show, and no counts.
      setProfile(null);
      setStats(EMPTY);
      setLoading(false);
      return;
    }
    /**
     * Offline-first: la última ficha guardada en el teléfono se dibuja en el
     * mismo cuadro, y la versión nueva llega por detrás. Con buena conexión la
     * persona no nota el cambio; sin conexión, la ficha sigue ahí.
     */
    const saved = cachedProfile(userId);
    if (saved) {
      setProfile(saved);
      setStale(false);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const [row, counts] = await Promise.all([getProfile(userId), getProfileStats(userId)]);
      if (asking.current !== userId) return;
      // A profile that is no longer there keeps the saved one instead of
      // emptying the card.
      if (row) setProfile(row);
      setStale(false);
      setStats(counts);
      if (!isSelf) await recordProfileVisit(userId).catch(() => undefined);
    } catch {
      if (asking.current !== userId) return;
      // Con una copia guardada no hay error: se avisa que es la última vista.
      if (saved) setStale(true);
      else setError('No pudimos cargar este perfil. Inténtalo otra vez.');
    } finally {
      if (asking.current === userId) setLoading(false);
    }
  }, [userId, isSelf]);

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setNotice(null);
    setMenu('closed');
    setReportReason(null);
    setReportDetail('');
    dragY.setValue(0);
    setCopiada(false);
    setProfile(null);
    setStale(false);
    setStats(EMPTY);
    void load();
  }, [visible, userId, load, dragY]);

  /**
   * La ficha se puede arrastrar hacia abajo para cerrarla, como una hoja de la
   * sala. Solo se mueve la barrita de arriba, para que la lista de dentro siga
   * deslizándose normal.
   */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_event, gesture) => {
          if (gesture.dy > 0) dragY.setValue(gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          if (gesture.dy > 90 || gesture.vy > 1.1) {
            Animated.timing(dragY, { toValue: 700, duration: 170, useNativeDriver: true }).start(() => {
              dragY.setValue(0);
              closeRef.current();
            });
            return;
          }
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        },
      }),
    [dragY],
  );

  async function sendReport() {
    if (!userId || !reportReason || reportBusy) return;
    if (reportReason === 'other' && reportDetail.trim().length < 4) {
      setError('Cuéntanos un poco qué pasó.');
      return;
    }
    setReportBusy(true);
    setError(null);
    try {
      await reportPerson(userId, reportReason, reportDetail, roomId ?? null);
      setMenu('closed');
      setReportReason(null);
      setReportDetail('');
      setNotice('Denuncia enviada. El equipo la va a revisar.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar la denuncia.');
    } finally {
      setReportBusy(false);
    }
  }

  async function follow() {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const following = await toggleFollow(userId);
      setStats(current => ({
        ...current,
        is_following: following,
        followers: Math.max(0, current.followers + (following ? 1 : -1)),
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos seguir a esta persona.');
    } finally {
      setBusy(false);
    }
  }

  /** Sends the request; the other person answers from their own profile. */
  async function askCoupleAction() {
    if (!userId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await askCouple(userId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar la solicitud.');
    } finally {
      setBusy(false);
    }
  }

  function confirmBlock() {
    if (!userId) return;
    Alert.alert(
      `Bloquear a ${name}`,
      'No podrá escribirte en privado ni ser tu amigo. Puedes desbloquearlo en Perfil → Ajustes.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () => {
            if (busy) return;
            setBusy(true);
            setError(null);
            void blockUser(userId)
              .then(() => {
                setStats(current => ({ ...current, is_following: false, friends: 0 }));
                onClose();
              })
              .catch((cause: unknown) => {
                setError(cause instanceof Error ? cause.message : 'No pudimos bloquear a esta persona.');
              })
              .finally(() => setBusy(false));
          },
        },
      ],
    );
  }

  const name = profile?.display_name ?? fallbackName;
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const cardWidth = Math.min(356, windowWidth - 32);
  /**
   * La ficha se mide sola y se coloca un poco menos de la mitad de la
   * pantalla. Si su contenido pide más alto, sube lo justo para que todo se
   * vea de una vez, sin tener que deslizar.
   */
  const [sheetHeader, setSheetHeader] = useState(0);
  const [sheetBody, setSheetBody] = useState(0);
  const sheetBottom = Math.max(12, insets.bottom + 8);
  const sheetHeight = sheetHeader + sheetBody;
  // La ficha se apoya abajo y crece hacia arriba: con su alto real, su borde
  // de arriba cae un poco por encima de la mitad de la pantalla y todo su
  // contenido se ve de una vez, sin deslizar.
  const sheetTop = sheetHeight > 0
    ? Math.max(8, Math.round(windowHeight - sheetBottom - sheetHeight))
    : Math.min(Math.round(windowHeight * 0.5), Math.max(96, windowHeight - 300));
  const avatar = profile?.avatar_url ?? fallbackAvatar;
  const level = profile?.level ?? 1;
  // A lapsed membership loses the whole pack, and each piece can be hidden.
  const svipLevel = liveSvipLevel(profile);
  const svip = svipTheme(svipLevel);
  const svipBanner = svipShows(profile, 'banner') && svip !== null;
  const svipEmblem = Boolean(svip) && svipShows(profile, 'emblem');
  const svipDays = svipDaysLeft(profile);
  // A host of the house has a name in the room but no account to follow,
  // gift or block.
  const canAct = Boolean(userId) && !isSelf;
  // Fills the frame's own opening, so the photo is whole at any frame size.
  const face = <AvatarPhoto uri={avatar} name={name} textClassName="text-[30px]" />;
  // La insignia de la persona: la del servidor o, si está sentada de anfitriona
  // en esta sala, la de host.
  const badgeKind = isBadgeKind(profile?.badge) ? profile.badge : isHostSeat ? 'host' : null;
  const gender = genderOf(profile?.gender);
  const GenderIcon = gender ? GENDER_ICONS[gender.key] : null;

  const palette = profileCardPalette(svipLevel);
  const ink = palette.ink;
  const mutedInk = palette.mutedInk;

  // Geometry of the wide card frame: it stretches corner to corner across the
  // card, and the card body starts at the photo's centre so the panel never
  // shows above or beyond the frame.
  const bannerBox = profileBannerBox(svipBanner ? svipLevel : 0, cardWidth);
  const photoSize = bannerBox?.photo ?? 0;
  const frameCentre = bannerBox?.centre ?? 0;
  // Everything below the frame starts under its lowest metal, never over it.
  const contentTop = bannerBox ? bannerBox.height - 6 : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(8,5,14,0.72)' }}>
        {/* Tocar fuera cierra la ficha; el fondo se oscurece sin apagar la sala. */}
        <Pressable
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          onPress={onClose}
          accessibilityLabel="Cerrar el perfil"
        />
        <View
          pointerEvents="box-none"
          style={{
            flex: 1,
            // La ficha se coloca donde dice sheetTop, un poco menos de la
            // mitad de la pantalla, y no colgada del borde de abajo.
            justifyContent: 'flex-start',
            paddingTop: sheetTop,
            paddingHorizontal: 16,
            paddingBottom: sheetBottom,
          }}>
          <Animated.View
            style={{
              transform: [{ translateY: dragY }],
              // Hasta que la ficha se mide, no se enseña: así aparece ya en su
              // sitio y nunca se ve un salto de abajo hacia arriba.
              opacity: sheetHeight > 0 ? 1 : 0,
            }}
          >
          <Pressable
            onPress={() => undefined}
            accessibilityRole="none"
            accessibilityLabel={`Ficha de ${name}`}
            style={{
              width: '100%', maxWidth: 356, alignSelf: 'center', borderRadius: 22, overflow: 'hidden',
              borderWidth: svip ? 0 : 1.5, borderColor: palette.gold,
              shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 18,
            }}>
          {/* La barrita de arriba: se arrastra hacia abajo para cerrar la ficha. */}
          <View
            onLayout={event => {
              const next = Math.round(event.nativeEvent.layout.height);
              setSheetHeader(current => (current === next ? current : next));
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 2 }}>
            <View style={{ width: 30 }} />
            <View {...drag.panHandlers} style={{ flex: 1, alignItems: 'center', paddingVertical: 5 }}>
              <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.6)' }} />
              <Text style={{ marginTop: 2, color: mutedInk, fontSize: 11 }}>Desliza para cerrar</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Más acciones sobre esta persona"
              accessibilityState={{ expanded: menu !== 'closed' }}
              hitSlop={6}
              onPress={() => { setMenu(current => (current === 'closed' ? 'actions' : 'closed')); setError(null); }}
              style={{
                width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center',
                backgroundColor: menu === 'closed' ? 'rgba(255,255,255,0.28)' : palette.gold,
                borderWidth: 1, borderColor: palette.gold,
              }}>
              <HelpCircle size={16} color={menu === 'closed' ? ink : '#2A1B46'} />
            </Pressable>
          </View>
          {svipBanner ? (
            // The panel begins at the photo's centre: above it there is only the
            // frame's metal and the room behind, never a card edge.
            <View
              pointerEvents="none"
              style={{
                position: 'absolute', top: frameCentre, left: 0, right: 0, bottom: 0,
                borderRadius: 22, borderWidth: 1.5, borderColor: palette.gold, overflow: 'hidden',
              }}>
              <LinearGradient
                colors={[palette.light, palette.mid, palette.deep]}
                locations={[0, 0.55, 1]}
                start={{ x: 0.15, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View style={{ position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' }} />
              {[
                { bottom: 2, left: 2 }, { bottom: 2, right: 2 },
              ].map((corner, index) => (
                <View
                  key={index}
                  style={{
                    position: 'absolute', width: 12, height: 12, borderRadius: 3, transform: [{ rotate: '45deg' }],
                    backgroundColor: palette.gem, borderWidth: 1.5, borderColor: palette.gold,
                    ...corner,
                  }}
                />
              ))}
            </View>
          ) : (
            <LinearGradient
              colors={[palette.light, palette.mid, palette.deep]}
              locations={[0, 0.55, 1]}
              start={{ x: 0.15, y: 0 }}
              end={{ x: 0.9, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 20, overflow: 'hidden' }}
              pointerEvents="none"
            />
          )}

          {/* The thin inner line and the four gems that frame the panel. */}
          {svip ? null : (
            <>
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute', top: 7, left: 7, right: 7, bottom: 7, borderRadius: 16,
                  borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)',
                }}
              />
              {[
                { top: 2, left: 2 }, { top: 2, right: 2 }, { bottom: 2, left: 2 }, { bottom: 2, right: 2 },
              ].map((corner, index) => (
                <View
                  key={index}
                  pointerEvents="none"
                  style={{
                    position: 'absolute', width: 12, height: 12, borderRadius: 3, transform: [{ rotate: '45deg' }],
                    backgroundColor: palette.gem, borderWidth: 1.5, borderColor: palette.gold,
                    ...corner,
                  }}
                />
              ))}
            </>
          )}

          {svip ? (
            // Corner to corner, over the panel, so the metal meets both edges
            // of the card and the photo shows through its opening.
            <ProfileBanner
              level={svip.level}
              width={cardWidth}
              style={{ position: 'absolute', top: 0, left: 0 }}>
              {() => face}
            </ProfileBanner>
          ) : null}

          {/* El menú del «?»: moderación, DJ, bloquear y denunciar en un solo
              sitio. Va encima del contenido, no dentro de la lista. */}
          {menu !== 'closed' ? (
            <>
              <Pressable
                accessibilityLabel="Cerrar el menú de acciones"
                onPress={() => { setMenu('closed'); setReportReason(null); }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <View
                style={{
                  position: 'absolute', top: 52, right: 10, width: 236, zIndex: 30, elevation: 26,
                  borderRadius: 16, backgroundColor: '#FFFDF8', borderWidth: 1.5, borderColor: palette.gold,
                  shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 8 },
                  overflow: 'hidden',
                }}>
                {menu === 'actions' ? (
                  <>
                    {onModerate && !isSelf ? (
                      <MenuItem
                        icon={<Shield size={15} color={ink} />}
                        label="Moderar a esta persona"
                        onPress={() => { setMenu('closed'); onModerate(); }}
                      />
                    ) : null}
                    {onMakeDj && !isSelf ? (
                      <MenuItem
                        icon={<Disc3 size={15} color={ink} />}
                        label="Poner como DJ de la sala"
                        onPress={() => { setMenu('closed'); onMakeDj(); }}
                      />
                    ) : null}
                    {canAct ? (
                      <MenuItem
                        icon={<Ban size={15} color="#8C1D18" />}
                        label="Bloquear a esta persona"
                        tone="danger"
                        onPress={() => { setMenu('closed'); confirmBlock(); }}
                      />
                    ) : null}
                    {canAct ? (
                      <MenuItem
                        icon={<Flag size={15} color="#8C1D18" />}
                        label="Denunciar"
                        tone="danger"
                        last
                        onPress={() => { setError(null); setMenu('report'); }}
                      />
                    ) : null}
                    {!onModerate && !onMakeDj && !canAct ? (
                      <Text style={{ padding: 12, color: mutedInk, fontSize: 12 }}>No hay acciones para esta persona.</Text>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Volver a las acciones"
                      onPress={() => { setMenu('actions'); setReportReason(null); setError(null); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.08)' }}>
                      <ChevronLeft size={14} color={ink} />
                      <Text style={{ color: ink, fontSize: 12, fontWeight: '700' }}>¿Por qué lo denuncias?</Text>
                    </Pressable>
                    <View style={{ maxHeight: 260 }}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {REPORT_REASONS.map((item, index) => {
                          const active = reportReason === item.key;
                          return (
                            <Pressable
                              key={item.key}
                              accessibilityRole="button"
                              accessibilityState={{ selected: active }}
                              accessibilityLabel={`${item.label}. ${item.hint}`}
                              onPress={() => { setReportReason(item.key); setError(null); }}
                              style={{
                                flexDirection: 'row', alignItems: 'center', gap: 8,
                                paddingHorizontal: 11, paddingVertical: 9,
                                borderTopWidth: index > 0 ? 1 : 0, borderTopColor: 'rgba(0,0,0,0.06)',
                                backgroundColor: active ? 'rgba(255,194,75,0.24)' : 'transparent',
                              }}>
                              <View style={{
                                width: 15, height: 15, borderRadius: 8, borderWidth: 1.5,
                                borderColor: active ? palette.gold : 'rgba(0,0,0,0.28)',
                                alignItems: 'center', justifyContent: 'center',
                              }}>
                                {active ? <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#8A5B18' }} /> : null}
                              </View>
                              <View style={{ flex: 1 }}>
                                <Text style={{ color: ink, fontSize: 12, fontWeight: '600' }}>{item.label}</Text>
                                <Text style={{ color: mutedInk, fontSize: 11 }} numberOfLines={1}>{item.hint}</Text>
                              </View>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>
                    {reportReason === 'other' ? (
                      <TextInput
                        value={reportDetail}
                        onChangeText={setReportDetail}
                        placeholder="Cuéntanos qué pasó"
                        placeholderTextColor="#8C8276"
                        maxLength={400}
                        multiline
                        style={{
                          marginHorizontal: 10, marginTop: 8, minHeight: 56, maxHeight: 90,
                          borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)',
                          paddingHorizontal: 9, paddingVertical: 7, color: ink, fontSize: 12,
                        }}
                      />
                    ) : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Enviar la denuncia"
                      disabled={!reportReason || reportBusy}
                      onPress={() => void sendReport()}
                      style={{
                        margin: 10, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6,
                        backgroundColor: reportReason ? '#8C1D18' : 'rgba(0,0,0,0.10)',
                      }}>
                      {reportBusy ? <ActivityIndicator size="small" color="#FFF" /> : <Flag size={13} color={reportReason ? '#FFF' : mutedInk} />}
                      <Text style={{ color: reportReason ? '#FFFFFF' : mutedInk, fontSize: 12, fontWeight: '700' }}>Enviar denuncia</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </>
          ) : null}

          <View
            onLayout={event => {
              const next = Math.round(event.nativeEvent.layout.height);
              setSheetBody(current => (current === next ? current : next));
            }}
            style={{ paddingHorizontal: 16, paddingTop: svipBanner ? contentTop : 12, paddingBottom: 12 }}>
            <View className="items-center">
              {svipBanner ? null : badgeKind ? (
                <RoleFrame kind={badgeKind} size={110}>{face}</RoleFrame>
              ) : svip && svipShows(profile, 'frame') ? (
                <SvipAvatarFrame level={svip.level} size={92}>{face}</SvipAvatarFrame>
              ) : profile?.equipped_frame ? (
                <FramedAvatar frame={profile.equipped_frame} size={92}>{face}</FramedAvatar>
              ) : (
                <View style={{ width: 88, height: 88, borderRadius: 44, overflow: 'hidden', borderWidth: 2, borderColor: palette.gold }}>
                  {face}
                </View>
              )}

              {/* El nombre y sus marcas se centran juntos y bajan de línea si
                  no caben, en vez de salirse por la derecha de la ficha. */}
              <View
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  maxWidth: '100%',
                }}>
                <Text style={{ color: ink, fontSize: 18, fontWeight: '700', flexShrink: 1, textAlign: 'center' }} numberOfLines={1}>{name}</Text>
                {badgeKind ? <RoleBadge kind={badgeKind} height={20} /> : null}
                {/* One rank mark only: the medal when they wear it, the level otherwise. */}
                {svipEmblem && svip ? (
                  <SvipShieldSmall level={svip.level} size={20} />
                ) : svip ? (
                  <View style={{ borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1.5, backgroundColor: svip.accent }}>
                    <Text style={{ color: svip.onAccent, fontSize: 11, fontWeight: '700' }}>SVIP {svip.level}</Text>
                  </View>
                ) : (
                  <LevelPlaque level={level} height={17} />
                )}
              </View>

              {profile?.agency_name ? (
                <View
                  style={{
                    marginTop: 6,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    borderRadius: 999,
                    backgroundColor: 'rgba(60,130,220,0.14)',
                    borderWidth: 1,
                    borderColor: 'rgba(60,130,220,0.32)',
                  }}>
                  <Building2 size={11} color="#2E6FB5" />
                  <Text style={{ color: '#1F4F86', fontSize: 11, fontWeight: '700' }} numberOfLines={1}>Agencia {profile.agency_name}</Text>
                </View>
              ) : null}

              <Text
                numberOfLines={2}
                style={{ marginTop: 6, color: profile?.bio ? ink : mutedInk, textAlign: 'center', fontSize: 13, lineHeight: 18 }}>
                {profile?.bio || (isSelf ? 'Aún no has escrito tu bio. Edítala en Perfil.' : 'Esta persona aún no ha escrito su bio.')}
              </Text>

              {/* Sin conexión la ficha no se vacía: se avisa que es la última
                  versión guardada, con la misma pastilla discreta de siempre. */}
              {stale ? (
                <View
                  style={{
                    marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4,
                    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
                    backgroundColor: 'rgba(0,0,0,0.06)',
                  }}>
                  <Text style={{ color: mutedInk, fontSize: 11 }}>Sin conexión · última versión guardada</Text>
                </View>
              ) : null}

              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: mutedInk, fontSize: 12 }}>
                  {isSelf ? 'Tú' : COUNTRY_LABEL[profile?.country ?? 'US'] ?? 'Latino Live'}
                </Text>
                {gender ? (
                  <View
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999,
                      backgroundColor: 'rgba(255,194,75,0.20)', borderWidth: 1, borderColor: 'rgba(168,120,20,0.35)',
                    }}>
                    {GenderIcon ? <GenderIcon size={11} color="#7A5208" /> : null}
                    <Text style={{ color: '#6A4706', fontSize: 11, fontWeight: '700' }}>{gender.label}</Text>
                  </View>
                ) : null}
                {profile?.user_number ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Copiar el ID ${profile.user_number} de ${name}`}
                    hitSlop={6}
                    onPress={() => {
                      if (profile?.user_number == null) return;
                      void Clipboard.setStringAsync(String(profile.user_number))
                        .then(() => {
                          setCopiada(true);
                          setTimeout(() => setCopiada(false), 2200);
                        })
                        .catch(() => setError('No pudimos copiar el ID.'));
                    }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 3,
                      borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.45)',
                    }}>
                    <Text style={{ color: ink, fontSize: 12, fontWeight: '600' }}>ID {profile.user_number}</Text>
                    {copiada
                      ? <Check size={13} color={palette.gem} />
                      : <Copy size={13} color={mutedInk} />}
                  </Pressable>
                ) : null}
              </View>

              {/* The membership lives here and nowhere else on the card. */}
              {svip ? (
                <View style={{
                  marginTop: 8, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 7,
                  borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6,
                  backgroundColor: 'rgba(255,255,255,0.32)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
                }}>
                  <Sparkles size={13} color={palette.gem} />
                  <Text style={{ flex: 1, color: ink, fontSize: 12, fontWeight: '600' }} numberOfLines={1}>
                    {svipStyleName(svip)}
                  </Text>
                  <Text style={{ color: mutedInk, fontSize: 11 }}>{svipDays > 0 ? `Quedan ${svipDays} días` : 'Activa'}</Text>
                </View>
              ) : null}
            </View>

            <View style={{
              marginTop: 10, flexDirection: 'row', overflow: 'hidden', borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.34)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)',
            }}>
              {[
                { value: stats.friends, label: 'Amigos' },
                { value: stats.following, label: 'Siguiendo' },
                { value: stats.followers, label: 'Seguidores' },
                { value: stats.visitors, label: 'Visitas' },
              ].map((metric, index) => (
                <View
                  key={metric.label}
                  style={{
                    flex: 1, alignItems: 'center', paddingVertical: 8,
                    borderLeftWidth: index > 0 ? 1 : 0, borderLeftColor: 'rgba(0,0,0,0.10)',
                  }}>
                  {loading ? (
                    <View style={{ height: 18, width: 28, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.10)' }} />
                  ) : (
                    <Text style={{ color: ink, fontSize: 16, fontWeight: '700' }}>{metric.value}</Text>
                  )}
                  <Text style={{ color: mutedInk, fontSize: 11, marginTop: 1 }} numberOfLines={1}>{metric.label}</Text>
                </View>
              ))}
            </View>

            {error ? <Text style={{ color: '#8C1D18', marginTop: 6, textAlign: 'center', fontSize: 11 }}>{error}</Text> : null}

            {notice ? (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: 'rgba(52,211,153,0.20)' }}>
                <Check size={13} color="#0F6B4A" />
                <Text style={{ flex: 1, color: '#0F6B4A', fontSize: 11.5, lineHeight: 16 }}>{notice}</Text>
              </View>
            ) : null}

            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              {isSelf ? (
                <View style={{
                  flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                  borderRadius: 999, backgroundColor: 'rgba(38,30,12,0.86)', borderWidth: 1, borderColor: palette.gold,
                }}>
                  <Sparkles size={16} color={palette.gold} />
                  <Text style={{ color: '#FDF4DC', fontSize: 14, fontWeight: '600' }}>Eres tú</Text>
                </View>
              ) : !userId ? (
                <View style={{
                  flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                  borderRadius: 999, backgroundColor: 'rgba(38,30,12,0.86)', borderWidth: 1, borderColor: palette.gold,
                }}>
                  <Shield size={16} color={palette.gold} />
                  <Text style={{ color: '#FDF4DC', fontSize: 14, fontWeight: '600' }}>Anfitrión de la casa</Text>
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={stats.is_following ? `Dejar de seguir a ${name}` : `Seguir a ${name}`}
                  accessibilityState={{ selected: stats.is_following, disabled: busy }}
                  disabled={busy}
                  onPress={() => void follow()}
                  style={{
                    flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    borderRadius: 999, backgroundColor: stats.is_following ? 'rgba(255,255,255,0.42)' : 'rgba(38,30,12,0.86)',
                    borderWidth: 1, borderColor: palette.gold,
                  }}>
                  {busy ? (
                    <ActivityIndicator size="small" color={palette.gold} />
                  ) : (
                    <Image source={ACTION_ICONS.follow} resizeMode="contain" style={{ width: 19, height: 19 }} accessibilityIgnoresInvertColors />
                  )}
                  <Text style={{ color: stats.is_following ? ink : '#FDF4DC', fontSize: 14, fontWeight: '600' }}>
                    {stats.is_following ? 'Siguiendo' : 'Seguir'}
                  </Text>
                </Pressable>
              )}
              {userId ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enviar un regalo a la sala"
                onPress={onGift}
                style={{
                  flex: 1, height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                  borderRadius: 999, backgroundColor: 'rgba(38,30,12,0.86)', borderWidth: 1, borderColor: palette.gold,
                }}>
                <Image source={ACTION_ICONS.gift} resizeMode="contain" style={{ width: 20, height: 20 }} accessibilityIgnoresInvertColors />
                <Text style={{ color: '#FDF4DC', fontSize: 14, fontWeight: '600' }}>Regalar</Text>
              </Pressable>
              ) : null}
            </View>

            {/* Los dos pasos siguientes, uno al lado del otro: la ficha baja
                de alto y las acciones caben sin tener que deslizar. */}
            {canAct ? (
              <View style={{ marginTop: 6, flexDirection: 'row', gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Enviar un mensaje privado a ${name}`}
                  onPress={() => {
                    onClose();
                    router.push(`/mensajes/${userId}` as Href);
                  }}
                  style={{
                    flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.42)',
                    borderWidth: 1, borderColor: palette.gold,
                  }}>
                  <MessageCircle size={16} color={ink} />
                  <Text style={{ color: ink, fontSize: 13, fontWeight: '600' }} numberOfLines={1}>Mensaje</Text>
                </Pressable>
                {/* Pedir pareja: la otra persona decide, y el servidor lleva la cuenta. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Pedir pareja a ${name}`}
                  disabled={busy}
                  onPress={() => void askCoupleAction()}
                  style={{
                    flex: 1, height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
                    borderRadius: 999, backgroundColor: 'rgba(255,143,163,0.18)',
                    borderWidth: 1, borderColor: 'rgba(255,143,163,0.55)',
                  }}>
                  {busy ? <ActivityIndicator size="small" color="#FF8FA3" /> : <Heart size={16} color="#FF8FA3" />}
                  <Text style={{ color: '#FF8FA3', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>Pareja</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
          </Pressable>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

/** Una fila del menú del «?»: icono, palabra y, si toca, tono de aviso. */
function MenuItem({
  icon,
  label,
  onPress,
  tone = 'normal',
  last = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  tone?: 'normal' | 'danger';
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 9,
        paddingHorizontal: 12, paddingVertical: 12,
        borderBottomWidth: last ? 0 : 1, borderBottomColor: 'rgba(0,0,0,0.08)',
      }}>
      {icon}
      <Text
        style={{ flex: 1, fontSize: 12.5, fontWeight: '600', color: tone === 'danger' ? '#8C1D18' : '#2E2418' }}
        numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}
