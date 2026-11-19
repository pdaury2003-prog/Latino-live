import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Check, ChevronLeft, Crown, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import { getProfile, saveProfile, type ProfileRow } from '@/lib/rooms';
import { buyFrame, buySvip, FRAMES, myFrames, shopItems, type ShopItem } from '@/lib/shop';
import { AnimatedFrameArt } from '@/components/animated-frame';
import { ALL_FRAMES } from '@/lib/gold';
import { SVIP_LEVELS, liveSvipLevel, svipDaysLeft } from '@/lib/svip';
import { SvipShield } from '@/components/gold-plate';
import { useOwnership } from '@/lib/payments';
import { cn } from '@/lib/utils';
import { Notice } from '@/components/state-views';
import { RowSkeleton } from '@/components/ui/skeleton';

type Tab = 'marcos' | 'svip';

export default function Tienda() {
  const { session } = useAuth();
  const [tab, setTab] = useState<Tab>('marcos');
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [items, setItems] = useState<ShopItem[]>([]);
  const [owned, setOwned] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [catalog, frames] = await Promise.all([shopItems(), myFrames()]);
      setItems(catalog);
      setOwned(frames);
      if (session?.user.id) setProfile(await getProfile(session.user.id));
      else setProfile(null);
      setError(null);
    } catch {
      setError('No pudimos cargar la tienda. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  const framesVendidos = useMemo(() => new Set(items.filter(item => item.kind === 'frame').map(item => item.key)), [items]);
  const priceOf = useCallback((key: string) => items.find(item => item.key === key)?.price_diamonds ?? 0, [items]);
  const diamonds = profile?.diamonds ?? 0;

  async function comprarMarco(key: string) {
    if (!session) { router.push('/entrar' as Href); return; }
    if (busy) return;
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const paid = await buyFrame(key);
      setNotice(`Compraste el marco y ya lo llevas puesto (−${paid.toLocaleString('es-US')} diamantes).`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos completar la compra.');
    } finally {
      setBusy(null);
    }
  }

  async function equipar(frame: string | null) {
    if (!session?.user.id || busy) return;
    setBusy('equipar');
    setError(null);
    try {
      await saveProfile(session.user.id, { equipped_frame: frame });
      setProfile(current => (current ? { ...current, equipped_frame: frame } : current));
      setNotice(frame ? 'Marco puesto.' : 'Volviste al marco normal.');
    } catch {
      setError('No pudimos guardar tu marco.');
    } finally {
      setBusy(null);
    }
  }

  async function comprarSvip(level: number) {
    if (!session) { router.push('/entrar' as Href); return; }
    if (busy) return;
    setBusy(`svip:${level}`);
    setError(null);
    setNotice(null);
    try {
      const paid = await buySvip(level);
      setNotice(`Ahora llevas SVIP ${level} (−${paid.toLocaleString('es-US')} diamantes).`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos completar la compra.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView contentContainerClassName="pb-16" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-2 px-4 pb-3 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/' as Href))}
            className="border-border bg-card size-10 items-center justify-center rounded-full border active:opacity-70">
            <Icon as={ChevronLeft} className="text-foreground size-4" />
          </Pressable>
          <Image
            source={require('@/assets/brand-mark.webp')}
            resizeMode="contain"
            style={{ width: 32, height: 32 }}
            accessibilityIgnoresInvertColors
          />
          <View className="flex-1">
            <Text className="text-foreground text-[17px] font-semibold">Tienda</Text>
            <Text className="text-muted-foreground text-[11px]">Marcos y SVIP</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir la billetera"
            onPress={() => router.push('/billetera' as Href)}
            className="border-primary/40 bg-primary/12 flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 active:opacity-80">
            <SparklingDiamond size={16} animated={false} />
            <Text className="text-primary text-[13px] font-semibold tabular-nums">{diamonds.toLocaleString('es-US')}</Text>
          </Pressable>
        </View>

        <View className="mx-4 mb-4 flex-row gap-1.5">
          {([
            { key: 'marcos', label: 'Marcos' },
            { key: 'svip', label: 'SVIP' },
          ] as { key: Tab; label: string }[]).map(option => (
            <Pressable
              key={option.key}
              accessibilityRole="button"
              accessibilityLabel={option.label}
              accessibilityState={{ selected: tab === option.key }}
              onPress={() => setTab(option.key)}
              className={cn('h-9 flex-1 items-center justify-center rounded-full border active:opacity-80',
                tab === option.key ? 'border-primary bg-primary/15' : 'border-border bg-card')}>
              <Text className={cn('text-[12px] font-semibold', tab === option.key ? 'text-primary' : 'text-muted-foreground')}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? <Notice tone="error" text={error} className="mx-4" /> : null}
        {notice ? <Notice tone="success" text={notice} className="mx-4" /> : null}

        {loading ? (
          <View className="gap-3 px-4">
            {[0, 1, 2].map(index => <RowSkeleton key={index} avatar={40} />)}
          </View>
        ) : null}

        {tab === 'marcos' && !loading ? (
          <View className="px-4">
            <Text className="text-muted-foreground mb-3 text-[11px] leading-4">
              Los marcos se ven en tu perfil, en tu asiento y en tu tarjeta dentro de la sala.
            </Text>
            {FRAMES.map(frame => {
              const key = `frame:${frame.key}`;
              const price = priceOf(key);
              const isOwned = owned.includes(key);
              const isWorn = profile?.equipped_frame === key;
              const forSale = framesVendidos.has(key);
              return (
                <View key={frame.key} className="border-border bg-card mb-3 flex-row items-center gap-3 rounded-2xl border p-3">
                  <View className="size-[74px] items-center justify-center">
                    <View className="bg-muted/60 size-[46px] items-center justify-center rounded-full">
                      <Icon as={Sparkles} className="text-muted-foreground/50 size-5" />
                    </View>
                    <AnimatedFrameArt
                      art={frame.art}
                      size={74}
                      accent={ALL_FRAMES.find(item => item.key === frame.key)?.accent ?? '#FFC24B'}
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground text-[13px] font-semibold">{frame.name}</Text>
                    <Text className="text-muted-foreground mt-0.5 text-[11px]">{frame.note}</Text>
                    {isOwned ? (
                      <Text className="text-success mt-1 text-[11px] font-medium">{isWorn ? 'Puesto ahora' : 'Ya es tuyo'}</Text>
                    ) : (
                      <View className="mt-1 flex-row items-center gap-1">
                        <SparklingDiamond size={14} animated={false} />
                        <Text className="text-primary text-[12px] font-semibold tabular-nums">
                          {forSale ? price.toLocaleString('es-US') : '—'}
                        </Text>
                      </View>
                    )}
                  </View>
                  {isOwned ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={isWorn ? `Quitar ${frame.name}` : `Poner ${frame.name}`}
                      disabled={busy === 'equipar'}
                      onPress={() => void equipar(isWorn ? null : key)}
                      className={cn('h-9 min-w-[84px] items-center justify-center rounded-full px-3 active:opacity-80',
                        isWorn ? 'border-border bg-background border' : 'bg-primary')}>
                      <Text className={cn('text-[12px] font-semibold', isWorn ? 'text-foreground' : 'text-primary-foreground')}>
                        {isWorn ? 'Quitar' : 'Poner'}
                      </Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Comprar ${frame.name}`}
                      disabled={busy === key || !forSale}
                      onPress={() => void comprarMarco(frame.key)}
                      className={cn('h-9 min-w-[84px] items-center justify-center rounded-full px-3 active:opacity-80', forSale ? 'bg-primary' : 'bg-muted')}>
                      {busy === key ? (
                        <ActivityIndicator size="small" color="#1A1409" />
                      ) : (
                        <Text className={cn('text-[12px] font-semibold', forSale ? 'text-primary-foreground' : 'text-muted-foreground')}>
                          Comprar
                        </Text>
                      )}
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === 'svip' && !loading ? (
          <View className="px-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Abrir la tienda SVIP"
              onPress={() => router.push('/tienda/svip' as Href)}
              className="mb-3 overflow-hidden rounded-[22px] border border-primary/35 active:opacity-90">
              <LinearGradient
                colors={['#241707', '#140D06', '#0A0908']}
                start={{ x: 0.1, y: 0 }}
                end={{ x: 0.9, y: 1 }}
                style={{ padding: 14 }}>
                <View className="flex-row items-center gap-3">
                  <SvipShield level={Math.max(1, liveSvipLevel(profile) || 1)} width={72} />
                  <View className="flex-1">
                    <Text className="text-primary text-[11px] font-bold tracking-[2px]">SOLO MIEMBROS</Text>
                    <Text className="text-foreground mt-1 text-[16px] font-semibold">Tienda SVIP</Text>
                    <Text className="text-muted-foreground mt-0.5 text-[11px] leading-4">
                      10 niveles con emblema, marco, entrada, burbuja y ondas propias.
                    </Text>
                  </View>
                </View>
                <View className="mt-3 h-10 flex-row items-center justify-center gap-1.5 rounded-full bg-primary">
                  <Icon as={Crown} className="text-primary-foreground size-4" />
                  <Text className="text-primary-foreground text-[13px] font-semibold">Entrar a la tienda SVIP</Text>
                </View>
              </LinearGradient>
            </Pressable>
            <Text className="text-muted-foreground mb-3 text-[11px] leading-4">
              {liveSvipLevel(profile)
                ? `Tu nivel actual: SVIP ${liveSvipLevel(profile)} · quedan ${svipDaysLeft(profile)} días.`
                : 'Sin SVIP activo. Cada nivel dura 30 días y se paga con diamantes.'}
            </Text>
            {SVIP_LEVELS.slice(Math.max(0, (liveSvipLevel(profile) || 1) - 1), Math.max(1, liveSvipLevel(profile) || 1) + 1).map(theme => {
              const price = priceOf(`svip:${theme.level}`);
              const active = liveSvipLevel(profile) >= theme.level;
              return (
                <Pressable
                  key={theme.level}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver SVIP ${theme.level} en la tienda SVIP`}
                  onPress={() => router.push('/tienda/svip' as Href)}
                  className="border-border mb-3 overflow-hidden rounded-2xl border active:opacity-90">
                  <LinearGradient
                    colors={[theme.background[0], theme.background[1]]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 }}>
                    <SvipShield level={theme.level} width={62} />
                    <View className="flex-1">
                      <Text className="text-foreground text-[13px] font-semibold">{theme.name}</Text>
                      <Text className="text-muted-foreground mt-0.5 text-[11px]">{theme.tagline}</Text>
                      <View className="mt-1 flex-row items-center gap-1">
                        {active ? (
                          <>
                            <Icon as={Check} className="text-success size-3" />
                            <Text className="text-success text-[11px] font-semibold">Activo</Text>
                          </>
                        ) : (
                          <>
                            <SparklingDiamond size={14} animated={false} />
                            <Text className="text-primary text-[12px] font-semibold tabular-nums">{price.toLocaleString('es-US')}</Text>
                          </>
                        )}
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              );
            })}
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}
