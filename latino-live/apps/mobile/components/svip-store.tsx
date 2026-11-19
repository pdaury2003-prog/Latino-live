import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Bell, Check, ChevronLeft, Crown, Diamond, Lock, MessageCircle, Mic, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SvipShield } from '@/components/gold-plate';
import { UltraHalo } from '@/components/ultra-halo';
import { getProfile, saveProfile, type ProfileRow } from '@/lib/rooms';
import { buySvip, frameArt, shopItems } from '@/lib/shop';
import { SVIP_LEVELS, SVIP_PIECES, liveSvipLevel, svipDaysLeft, svipShows, type SvipPiece, type SvipTheme } from '@/lib/svip';
import { imperialKit } from '@/lib/svip-imperial';
import { svipKit } from '@/lib/svip-kit';
import { usePowerSettings } from '@/lib/power';
import { SvipKitAvatar, SvipKitBanner } from '@/components/svip-kit';
import { AvatarPhoto } from '@/components/avatar-photo';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import { cn } from '@/lib/utils';

type Privilege = {
  key: string;
  title: string;
  note: string;
  art?: number | null;
  /** Drawn instead of an image for levels without their own kit. */
  icon?: 'shield' | 'mic' | 'notice' | 'bubble';
};

/** The six things a level wears, drawn with its own art when it has one. */
function privilegesOf(theme: SvipTheme): Privilege[] {
  const kit = imperialKit(theme.level);
  const owned = svipKit(theme.level);
  return [
    { key: 'emblem', title: 'Emblema', note: 'Insignia junto a tu nombre', art: owned?.emblem ?? null, icon: 'shield' },
    { key: 'frame', title: 'Marco de avatar', note: 'Aro animado en tu foto', art: owned?.avatar ?? kit?.frame ?? frameArt(theme.frame) },
    { key: 'notice', title: 'Banner de entrada', note: 'Aviso al entrar a la sala', art: owned?.entry ?? kit?.notice ?? null, icon: 'notice' },
    { key: 'bubble', title: 'Burbuja de chat', note: 'Tu voz con estilo propio', art: kit?.bubble ?? null, icon: 'bubble' },
    { key: 'mic', title: 'Ondas del micrófono', note: 'Brillo cuando hablas', art: kit?.micWave ?? null, icon: 'mic' },
    { key: 'room', title: 'Fondo de perfil y sala', note: 'Tu tarjeta y tu sala', art: owned?.background ?? kit?.roomFrame ?? theme.art },
  ];
}

type Props = {
  /** Level the person wants to see; the shop opens on their own level or 1. */
  initialLevel?: number;
};

/**
 * The SVIP-only shop: a level rail, the level on a lit stage with its own
 * colours, the six pieces it unlocks, and one price in diamonds.
 */
export function SvipStore({ initialLevel }: Props) {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [level, setLevel] = useState(initialLevel ?? 1);
  const [busy, setBusy] = useState<number | null>(null);
  /** Which pieces are being saved right now. Each one saves on its own. */
  const [savingPieces, setSavingPieces] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pickedOnce = useRef(Boolean(initialLevel));
  /** The last map of pieces we sent, so quick taps never lose one another. */
  const shownRef = useRef<Record<string, boolean>>({});
  /** The last map the server accepted, to return to when a save fails. */
  const savedRef = useRef<Record<string, boolean>>({});
  /** Pieces with a save in flight; their next taps are folded into it. */
  const savingRef = useRef<Record<string, boolean>>({});

  const load = useCallback(async () => {
    try {
      const [catalog, mine] = await Promise.all([
        shopItems().catch(() => []),
        session?.user.id ? getProfile(session.user.id).catch(() => null) : Promise.resolve(null),
      ]);
      const table: Record<number, number> = {};
      for (const item of catalog) {
        const match = /^svip:(\d+)$/.exec(item.key);
        if (match) table[Number(match[1])] = item.price_diamonds;
      }
      setPrices(table);
      setProfile(mine);
      shownRef.current = mine?.svip_show ?? {};
      savedRef.current = mine?.svip_show ?? {};
      // Open on what the person already wears, so the rail starts where they are.
      if (!pickedOnce.current && mine?.svip_level) {
        pickedOnce.current = true;
        setLevel(Math.min(10, Math.max(1, Math.round(mine.svip_level))));
      }
      setError(null);
    } catch {
      setError('No pudimos cargar la tienda. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  const theme = SVIP_LEVELS.find(item => item.level === level) ?? SVIP_LEVELS[0];
  const price = prices[theme.level] ?? 0;
  const myLevel = liveSvipLevel(profile);
  const owned = myLevel >= theme.level;
  const daysLeft = svipDaysLeft(profile);
  const isMyLevel = myLevel === theme.level;
  const diamonds = profile?.diamonds ?? 0;
  const short = Math.max(0, price - diamonds);
  const pieces = privilegesOf(theme);
  /** The art of the level the person wears, when it came with its own sheet. */
  const kit = svipKit(myLevel);

  /** Hides or shows one piece of the pack, for the person's own profile. */
  async function togglePiece(piece: SvipPiece) {
    if (!session?.user.id) return;
    const wasOn = svipShows(profile, piece);
    const next = { ...shownRef.current, [piece]: !wasOn };
    shownRef.current = next;
    // The switch moves at once: nobody waits for the network to see the change.
    setProfile(current => (current ? { ...current, svip_show: next } : current));
    // A save already on its way carries the newest map when it repeats, so a
    // quick off-and-on is not thrown away while the first one travels.
    if (savingRef.current[piece]) return;
    savingRef.current[piece] = true;
    setSavingPieces(current => ({ ...current, [piece]: true }));
    try {
      let sending = shownRef.current;
      for (;;) {
        await saveProfile(session.user.id, { svip_show: sending });
        savedRef.current = sending;
        // The person tapped again while this one travelled: send that.
        if (shownRef.current[piece] === sending[piece]) break;
        sending = shownRef.current;
      }
    } catch {
      setError('No pudimos guardar ese ajuste.');
      // The change did not stick, so the switch goes back to what the server
      // last accepted.
      const previous = { ...savedRef.current, [piece]: savedRef.current[piece] ?? wasOn };
      shownRef.current = previous;
      setProfile(current => (current ? { ...current, svip_show: previous } : current));
    } finally {
      delete savingRef.current[piece];
      setSavingPieces(current => {
        const nextState = { ...current };
        delete nextState[piece];
        return nextState;
      });
    }
  }

  async function comprar() {
    if (!session) { router.push('/entrar' as Href); return; }
    if (busy !== null || myLevel > theme.level) return;
    // Sin diamantes suficientes se va a la billetera a recargar.
    if (short > 0) { router.push('/billetera' as Href); return; }
    setBusy(theme.level);
    setError(null);
    setNotice(null);
    try {
      const paid = await buySvip(theme.level);
      setNotice(
        owned
          ? `SVIP ${theme.level} renovado 30 días más (−${paid.toLocaleString('es-US')} diamantes).`
          : `SVIP ${theme.level} desbloqueado por 30 días (−${paid.toLocaleString('es-US')} diamantes).`,
      );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos completar la compra.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#08070A' }}>
      <ScrollView contentContainerClassName="pb-10" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/tienda' as Href))}
            className="size-10 items-center justify-center rounded-full border border-white/12 bg-black/40 active:opacity-70">
            <Icon as={ChevronLeft} className="text-foreground size-4" />
          </Pressable>
            {/* The app's own emblem, so the shop reads as part of Latino Live. */}
            <Image
              source={require('@/assets/brand-mark.webp')}
              resizeMode="contain"
              style={{ width: 34, height: 34 }}
              accessibilityIgnoresInvertColors
            />
          <View className="flex-1">
            <Text className="text-foreground text-[17px] font-semibold">Tienda SVIP</Text>
            <Text className="text-muted-foreground text-[11px]">Solo para la realeza de la sala</Text>
          </View>
          <View className="flex-row items-center gap-1.5 rounded-full border border-primary/40 bg-primary/12 px-3 py-1.5">
            <SparklingDiamond size={16} animated={false} />
            <Text className="text-primary text-[13px] font-semibold tabular-nums">{diamonds.toLocaleString('es-US')}</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-1.5 px-4 py-2">
          {SVIP_LEVELS.map(item => {
            const active = item.level === theme.level;
            const mine = myLevel >= item.level;
            return (
              <Pressable
                key={item.level}
                accessibilityRole="button"
                accessibilityLabel={`Ver SVIP ${item.level}`}
                accessibilityState={{ selected: active }}
                onPress={() => { setLevel(item.level); setNotice(null); setError(null); }}
                className={cn(
                  'h-9 flex-row items-center gap-1 rounded-full border px-2.5 active:opacity-85',
                  active ? 'border-primary bg-primary/15' : 'border-white/10 bg-white/5',
                )}>
                <SvipShield level={item.level} width={18} />
                <Text className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-muted-foreground')}>
                  {item.level}
                </Text>
                {mine ? <Icon as={Check} className="text-success size-3" /> : null}
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? <Text className="text-destructive px-4 pb-2 text-[11px]">{error}</Text> : null}
        {notice ? <Text className="text-success px-4 pb-2 text-[11px]">{notice}</Text> : null}
        {loading ? <ActivityIndicator color="#FFC24B" style={{ paddingVertical: 16 }} /> : null}

        <SvipStage theme={theme} owned={owned} />

        <View className="mx-4 mt-4 rounded-2xl border border-primary/25 bg-white/[0.04] px-4 py-3">
          <View className="flex-row items-center gap-2">
            <Icon as={Crown} className="text-primary size-4" />
            <View className="flex-1">
              <Text className="text-foreground text-[14px] font-semibold">{theme.name}</Text>
              <Text className="text-muted-foreground text-[11px]">{theme.tagline}</Text>
            </View>
            {owned ? (
              <View className="flex-row items-center gap-1 rounded-full border border-success/40 bg-success/15 px-2.5 py-1">
                <Icon as={Check} className="text-success size-3" />
                <Text className="text-success text-[11px] font-semibold">Activo</Text>
              </View>
            ) : null}
          </View>

          {isMyLevel ? (
            <Text className="text-primary mt-1.5 text-[11px] font-semibold">
              {daysLeft > 0 ? `Vence en ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'}` : 'Membresía vencida'}
            </Text>
          ) : null}

          <Text className="text-muted-foreground mt-2 text-[11px] leading-4">
            {owned
              ? 'El pack dura 30 días. Al renovar se suman 30 días más al tiempo que te queda.'
              : 'Desbloquea el kit completo por 30 días. Si vence, se retiran todas las piezas hasta que lo renueves.'}
          </Text>

          <View className="mt-2.5 flex-row flex-wrap gap-1.5">
            {pieces.slice(0, 4).map(piece => (
              <View key={piece.key} className="rounded-full border border-primary/30 bg-black/30 px-2 py-1">
                <Text className="text-primary text-[11px]">{piece.title}</Text>
              </View>
            ))}
            <View className="rounded-full border border-primary/30 bg-black/30 px-2 py-1">
              <Text className="text-primary text-[11px]">+2</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              myLevel > theme.level ? 'Nivel superior activo' : short > 0 ? 'Recargar diamantes' : owned ? `Renovar ${theme.name} 30 días` : `Comprar ${theme.name}`
            }
            accessibilityState={{ disabled: myLevel > theme.level || busy !== null }}
            disabled={myLevel > theme.level || busy !== null}
            onPress={() => void comprar()}
            className={cn(
              'mt-3 h-11 flex-row items-center justify-center gap-2 rounded-full active:opacity-90',
              myLevel > theme.level ? 'border border-success/40 bg-success/15' : 'bg-primary',
            )}>
            {busy === theme.level ? (
              <ActivityIndicator size="small" color="#1A1409" />
            ) : (
              <>
                <Icon as={myLevel > theme.level ? Check : short > 0 ? Sparkles : Diamond} className={cn('size-4', myLevel > theme.level ? 'text-success' : 'text-primary-foreground')} />
                <Text className={cn('text-[13px] font-semibold', myLevel > theme.level ? 'text-success' : 'text-primary-foreground')}>
                  {myLevel > theme.level
                    ? 'Ya tienes un nivel superior'
                    : price === 0
                      ? 'Ver precio'
                      : short > 0
                        ? `Te faltan ${short.toLocaleString('es-US')} · Recargar`
                        : owned
                          ? `Renovar 30 días · ${price.toLocaleString('es-US')}`
                          : `Comprar 30 días · ${price.toLocaleString('es-US')}`}
                </Text>
              </>
            )}
          </Pressable>
        </View>

        <View className="mx-4 mb-1 mt-5 flex-row items-center gap-2">
          <View className="h-px flex-1" style={{ backgroundColor: 'rgba(255,194,75,0.28)' }} />
          <Text className="text-primary text-[11px] font-semibold tracking-[2px]">PRIVILEGIOS DEL NIVEL</Text>
          <View className="h-px flex-1" style={{ backgroundColor: 'rgba(255,194,75,0.28)' }} />
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-2 px-4 pt-2">
          {pieces.map(piece => (
            <View
              key={piece.key}
              style={{ width: '48.5%' }}
              className={cn(
                'overflow-hidden rounded-2xl border px-2 pb-2 pt-1.5',
                owned ? 'border-primary/35' : 'border-white/10',
              )}>
              <LinearGradient
                colors={owned ? [withAlpha(theme.accent, 0.22), 'rgba(0,0,0,0)'] : ['rgba(255,255,255,0.06)', 'rgba(0,0,0,0)']}
                start={{ x: 0.2, y: 0 }}
                end={{ x: 0.8, y: 1 }}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
              <View className="h-[62px] items-center justify-center">
                {piece.icon === 'shield' ? (
                  <SvipShield level={theme.level} width={54} />
                ) : piece.icon && !piece.art ? (
                  <View
                    className="size-11 items-center justify-center rounded-full border"
                    style={{ borderColor: withAlpha(theme.accent, 0.7), backgroundColor: withAlpha(theme.ring[1], 0.25) }}>
                    <Icon
                      as={piece.icon === 'notice' ? Bell : piece.icon === 'bubble' ? MessageCircle : Mic}
                      className="size-5"
                      color={theme.ring[0]}
                    />
                  </View>
                ) : piece.art ? (
                  <Image
                    source={piece.art}
                    resizeMode="contain"
                    style={{ width: 58, height: 54, opacity: owned ? 1 : 0.55 }}
                    accessibilityIgnoresInvertColors
                  />
                ) : (
                  <View
                    className="size-11 items-center justify-center rounded-full border"
                    style={{ borderColor: withAlpha(theme.accent, 0.6), backgroundColor: withAlpha(theme.ring[1], 0.22) }}>
                    <Icon as={Sparkles} className="size-5" color={theme.ring[0]} />
                  </View>
                )}
                {!owned ? (
                  <View className="absolute right-1 top-1 rounded-full bg-black/60 p-1">
                    <Icon as={Lock} className="text-muted-foreground size-3" />
                  </View>
                ) : null}
              </View>
              <Text className="text-foreground mt-1 text-[12px] font-semibold" numberOfLines={1}>
                {piece.title}
              </Text>
              <Text className="text-muted-foreground text-[11px] leading-[15px]" numberOfLines={2}>
                {piece.note}
              </Text>
            </View>
          ))}
        </View>

        {myLevel > 0 && kit ? (
          /* How the person's arrival looks in the rooms of other people. */
          <View className="mx-4 mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-black/30 px-3 py-3">
            <Text className="text-primary text-[11px] font-semibold tracking-[2px]">TU ENTRADA A LA SALA</Text>
            <View className="mt-2 items-center">
              <SvipKitBanner level={kit.level} width={300} height={82}>
                <View className="flex-row items-center gap-2">
                  <SvipKitAvatar level={kit.level} size={38} animated={false}>
                    <AvatarPhoto uri={profile?.avatar_url} name={profile?.display_name ?? 'Tú'} />
                  </SvipKitAvatar>
                  <View style={{ maxWidth: 150 }}>
                    <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>
                      {profile?.display_name ?? 'Tú'}
                    </Text>
                    <Text className="text-muted-foreground text-[11px]">entró a la sala</Text>
                  </View>
                </View>
              </SvipKitBanner>
            </View>
          </View>
        ) : null}

        {myLevel > 0 ? (
          <>
            <View className="mx-4 mb-1 mt-5 flex-row items-center gap-2">
              <View className="h-px flex-1" style={{ backgroundColor: 'rgba(255,194,75,0.28)' }} />
              <Text className="text-primary text-[11px] font-semibold tracking-[2px]">LO QUE LLEVAS PUESTO</Text>
              <View className="h-px flex-1" style={{ backgroundColor: 'rgba(255,194,75,0.28)' }} />
            </View>
            <Text className="text-muted-foreground mx-4 mt-1 text-[11px] leading-4">
              Apaga lo que no quieras mostrar y vuelve a encenderlo cuando quieras. El pack sigue tuyo hasta que venza.
            </Text>
            <View className="mx-4 mt-2.5 overflow-hidden rounded-2xl border border-white/10">
              {SVIP_PIECES.map((piece, index) => {
                const on = svipShows(profile, piece.key);
                const saving = savingPieces[piece.key] === true;
                return (
                  <Pressable
                    key={piece.key}
                    accessibilityRole="switch"
                    accessibilityLabel={`${on ? 'Ocultar' : 'Mostrar'} ${piece.label}`}
                    accessibilityState={{ checked: on, disabled: saving }}
                    disabled={saving}
                    onPress={() => void togglePiece(piece.key)}
                    className={cn(
                      'flex-row items-center gap-2.5 bg-white/[0.03] px-3 py-2.5 active:opacity-80',
                      index > 0 && 'border-t border-white/8',
                    )}>
                    <View className="flex-1">
                      <Text className="text-foreground text-[12px] font-medium">{piece.label}</Text>
                    </View>
                    <View
                      className={cn(
                        'h-6 w-11 flex-row items-center rounded-full border px-0.5',
                        on ? 'border-success/50 bg-success/25' : 'border-white/15 bg-black/40',
                      )}>
                      <View
                        className={cn('size-5 rounded-full', on ? 'bg-success' : 'bg-white/45')}
                        style={{ marginLeft: on ? 18 : 0 }}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        <Text className="text-muted-foreground mx-4 mt-4 text-[11px] leading-4">
          Los SVIP se pagan con diamantes, nunca con dinero directo, y duran 30 días. Al vencer se retira el pack
          completo de tu perfil, tu asiento y tu entrada a la sala.
        </Text>
      </ScrollView>
    </View>
  );
}

/** The level on its stage: light beams, the medal and the level's colours. */
function SvipStage({ theme, owned }: { theme: SvipTheme; owned: boolean }) {
  const saver = usePowerSettings().battery;
  const spin = useSharedValue(0);
  useEffect(() => {
    if (saver) {
      spin.value = 0;
      return;
    }
    spin.value = withRepeat(withTiming(1, { duration: 24000, easing: Easing.linear }), -1, false);
  }, [spin, saver]);
  const rays = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));

  const glow = useSharedValue(0);
  useEffect(() => {
    if (saver) {
      glow.value = 0.6;
      return;
    }
    glow.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [glow, saver]);
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + glow.value * 0.35, transform: [{ scale: 0.94 + glow.value * 0.08 }] }));

  return (
    <View className="mx-4 mt-1 overflow-hidden rounded-[26px] border" style={{ borderColor: withAlpha(theme.accent, 0.45) }}>
      <LinearGradient
        colors={[theme.background[0], theme.background[1], theme.background[2]]}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={{ alignItems: 'center', paddingVertical: 18 }}>
        <View style={{ width: 210, height: 210, alignItems: 'center', justifyContent: 'center' }}>
          <Animated.View style={[{ position: 'absolute', width: 250, height: 250 }, rays]}>
            {[0, 45, 90, 135].map(angle => (
              <View
                key={angle}
                style={{
                  position: 'absolute',
                  left: 124,
                  top: 0,
                  width: 2,
                  height: 250,
                  backgroundColor: withAlpha(theme.ring[0], 0.16),
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            ))}
          </Animated.View>
          <Animated.View
            style={[
              {
                position: 'absolute',
                width: 172,
                height: 172,
                borderRadius: 86,
                borderWidth: 1.5,
                borderColor: withAlpha(theme.ring[0], 0.55),
                backgroundColor: withAlpha(theme.ring[1], 0.2),
              },
              halo,
            ]}
          />
          <UltraHalo
            size={168}
            colors={[theme.ring[2], theme.ring[1], theme.ring[0]]}
            running={!saver}
            level={theme.level}
            duration={theme.level >= 4 ? 6400 : 7800}
          />
          <SvipShield level={theme.level} width={150} />
        </View>

        <Text className="text-foreground mt-1 text-[12px] font-semibold tracking-[3px]" style={{ color: theme.ring[2] }}>
          SVIP {theme.level}
        </Text>
        <Text className="text-foreground mt-1 text-[19px] font-semibold">{theme.name.split('· ')[1] ?? theme.name}</Text>
        <Text className="text-muted-foreground mt-0.5 text-[11px]">{theme.tagline}</Text>
        <View
          className="mt-2 flex-row items-center gap-1.5 rounded-full border px-3 py-1"
          style={{ borderColor: withAlpha(theme.accent, 0.5), backgroundColor: 'rgba(0,0,0,0.35)' }}>
          <Icon as={owned ? Check : Crown} className="size-3" color={theme.ring[0]} />
          <Text className="text-[11px] font-medium" style={{ color: theme.ring[2] }}>
            {owned ? 'Nivel activo' : 'Nivel bloqueado'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/** A colour as an rgba string, for borders and tints. */
function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
