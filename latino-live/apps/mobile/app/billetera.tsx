import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ArrowRightLeft, ChevronLeft, ChevronRight, Gift, Receipt, Sparkles, Store, Wallet } from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import { useAccent } from '@/lib/theme-accent';
import { Notice } from '@/components/state-views';
import { RowSkeleton } from '@/components/ui/skeleton';
import { getProfile, type ProfileRow } from '@/lib/rooms';
import { claimDiamondPacks, convertGold, GOLD_PER_DIAMOND, walletHistory, type WalletEntry } from '@/lib/shop';
import { paymentsAvailable, priceLabel, products, visitPayment, type Product } from '@/lib/payments';
import { config } from '@/lib/config';
import { usePlayTopUp } from '@/lib/play-billing';
import { cn } from '@/lib/utils';

/**
 * La billetera: el único lugar donde vive el dinero de la persona. Arriba, lo
 * que tiene (diamantes y oro); luego el oro que ganó con regalos convertido en
 * diamantes; al final, la recarga de diamantes con tarjeta. Los marcos y el
 * SVIP se compran en la tienda, y desde aquí se llega a ella.
 */

/** Las unidades que trae un paquete, leídas de su clave de derecho (diamonds_1200). */
function amountIn(product: Product) {
  const key = product.prices.find(price => price.entitlementKey?.startsWith('diamonds_'))?.entitlementKey ?? '';
  return Number(key.replace('diamonds_', '')) || 0;
}

const dayOf = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Hoy · 3:12 p. m.", "Ayer · …" o "12 nov · …" para cada línea del historial. */
function whenLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const days = Math.round((dayOf(new Date()) - dayOf(date)) / 86_400_000);
  let time = '';
  try {
    time = new Intl.DateTimeFormat('es-US', { hour: 'numeric', minute: '2-digit' }).format(date);
  } catch {
    time = '';
  }
  if (days <= 0) return time ? `Hoy · ${time}` : 'Hoy';
  if (days === 1) return time ? `Ayer · ${time}` : 'Ayer';
  try {
    const day = new Intl.DateTimeFormat('es-US', { day: 'numeric', month: 'short' }).format(date);
    return time ? `${day} · ${time}` : day;
  } catch {
    return date.toLocaleDateString();
  }
}

export default function Billetera() {
  const { session } = useAuth();
  const accent = useAccent();
  // The store build pays with Google Play; the direct install pays with card.
  const play = usePlayTopUp();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [goldBusy, setGoldBusy] = useState(false);
  const [packs, setPacks] = useState<Product[]>([]);
  const [history, setHistory] = useState<WalletEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (!session?.user.id) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }
    try {
      setHistory(await walletHistory(30));
    } catch {
      // El saldo sigue siendo útil aunque el historial no llegue.
    } finally {
      setHistoryLoading(false);
    }
  }, [session?.user.id]);

  const load = useCallback(async () => {
    if (!session?.user.id) {
      setProfile(null);
      setLoading(false);
      return;
    }
    try {
      setProfile(await getProfile(session.user.id));
      setError(null);
    } catch {
      setError('No pudimos cargar tu saldo. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
    void loadHistory();
  }, [session?.user.id, loadHistory]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  // Diamonds from a Play purchase arrived: show them without reopening the app.
  useEffect(() => {
    if (play.credited <= 0) return;
    setNotice(`Se acreditaron ${play.credited.toLocaleString('es-US')} diamantes.`);
    play.clearCredited();
    void load();
    // Only the credit count matters here; the rest of the hook changes per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play.credited]);

  // Una compra pagada la acredita el servidor: al volver del pago se reclama.
  useEffect(() => {
    if (!session) return;
    const claim = () => {
      void claimDiamondPacks()
        .then(credited => {
          if (credited > 0) {
            setNotice(`Se acreditaron ${credited.toLocaleString('es-US')} diamantes.`);
            void load();
          }
        })
        .catch(() => undefined);
    };
    claim();
    const activity = AppState.addEventListener('change', state => { if (state === 'active') claim(); });
    const links = Linking.addEventListener('url', claim);
    return () => { activity.remove(); links.remove(); };
  }, [session, load]);

  useEffect(() => {
    if (!config.topUp || !session || !paymentsAvailable()) return;
    void products()
      .then(result =>
        setPacks(
          result.items
            .filter(product => product.prices.some(price => price.entitlementKey?.startsWith('diamonds_')))
            // Del paquete más pequeño al más grande: se lee como una escalera.
            .sort((a, b) => amountIn(a) - amountIn(b))
        )
      )
      .catch(() => undefined);
  }, [session]);

  async function cambiarOro(gold: number) {
    if (!session?.user.id || goldBusy || gold <= 0) return;
    setGoldBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await convertGold(gold);
      setProfile(current => (current ? { ...current, gold: result.gold, diamonds: result.diamonds } : current));
      setNotice(`Cambiaste ${gold.toLocaleString('es-US')} de oro. Ahora tienes ${result.diamonds.toLocaleString('es-US')} diamantes.`);
      void loadHistory();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos cambiar el oro.');
    } finally {
      setGoldBusy(false);
    }
  }

  const diamonds = profile?.diamonds ?? 0;
  const gold = profile?.gold ?? 0;
  const changeable = Math.floor(gold / GOLD_PER_DIAMOND);

  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView contentContainerClassName="pb-16" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-2 px-4 pb-3 pt-2">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/perfil' as Href))}
            className="border-border bg-card size-10 items-center justify-center rounded-full border active:opacity-70">
            <Icon as={ChevronLeft} className="text-foreground size-4" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-foreground text-[17px] font-semibold">Billetera</Text>
            <Text className="text-muted-foreground text-[11px]">Tu oro y tus diamantes</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir la tienda de marcos y SVIP"
            onPress={() => router.push('/tienda' as Href)}
            className="border-border bg-card size-10 items-center justify-center rounded-full border active:opacity-70">
            <Icon as={Store} className="text-primary size-4" />
          </Pressable>
        </View>

        {!session ? (
          <View className="border-border bg-card mx-4 items-center gap-3 rounded-[22px] border px-6 py-9">
            <View className="bg-primary/15 size-14 items-center justify-center rounded-full">
              <Icon as={Wallet} className="text-primary size-6" />
            </View>
            <Text className="text-foreground text-center text-[15px] font-semibold">Tu billetera vive en tu cuenta</Text>
            <Text className="text-muted-foreground text-center text-[12.5px] leading-5">
              {config.topUp
                ? 'Entra con tu correo para ver tus diamantes, cambiar el oro que ganas con regalos y recargar con tarjeta.'
                : 'Entra con tu correo para ver tus diamantes y cambiar el oro que ganas con regalos.'}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/entrar' as Href)}
              className="bg-primary mt-1 h-11 w-full items-center justify-center rounded-full active:opacity-85">
              <Text className="text-primary-foreground text-[13px] font-semibold">Entrar o crear cuenta</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* El saldo: dos números, ni una cifra más. */}
            <View className="mx-4 overflow-hidden rounded-[22px]">
              <LinearGradient
                colors={accent.light ? ['#FFF6DF', '#FFFFFF'] : ['#2A1E12', '#171113']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ padding: 16, borderWidth: 1, borderColor: accent.line, borderRadius: 22 }}>
                <View className="flex-row items-center gap-1.5">
                  <Icon as={Sparkles} size={12} color={accent.main} />
                  <Text className="text-[11px] font-semibold tracking-[0.18em]" style={{ color: accent.main }}>
                    TU SALDO
                  </Text>
                </View>
                <View className="mt-2 flex-row items-center gap-2.5">
                  {/* La joya de la casa: el diamante que brilla junto al saldo. */}
                  <SparklingDiamond size={32} />
                  <Text className="text-foreground text-[34px] font-semibold leading-none tabular-nums">
                    {diamonds.toLocaleString('es-US')}
                  </Text>
                  <Text className="text-muted-foreground pb-1 text-[12px]">diamantes</Text>
                </View>
                <View className="mt-3 flex-row items-center gap-1.5">
                  <SparklingDiamond size={13} animated={false} tone="gold" />
                  <Text className="text-muted-foreground text-[11.5px] tabular-nums">
                    {gold.toLocaleString('es-US')} de oro
                  </Text>
                </View>
              </LinearGradient>
            </View>

            {/* El oro que llega de los regalos se vuelve diamantes. */}
            <View className="mx-4 mt-4 rounded-[22px] border p-4" style={{ borderColor: accent.line, backgroundColor: accent.raised }}>
              <View className="flex-row items-center gap-2">
                <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: accent.wash }}>
                  <Icon as={ArrowRightLeft} size={15} color={accent.main} />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-[13px] font-semibold">Cambiar oro por diamantes</Text>
                  <Text className="text-muted-foreground mt-0.5 text-[11px]">
                    El oro que recibes de los regalos se vuelve diamantes.
                  </Text>
                </View>
              </View>
              <View className="mt-3 flex-row items-center gap-2 rounded-2xl px-3 py-2.5" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                <Icon as={Sparkles} size={13} color={accent.main} />
                <Text className="text-muted-foreground text-[11px] tracking-wide">ORO</Text>
                <Text className="text-foreground flex-1 text-right text-[15px] font-semibold tabular-nums">
                  {gold.toLocaleString('es-US')}
                </Text>
              </View>
              <View className="mt-2.5 rounded-2xl border border-dashed p-3" style={{ borderColor: 'rgba(255,255,255,0.14)' }}>
                <View className="flex-row items-center justify-between gap-2">
                  <Text className="text-muted-foreground flex-1 text-[11px] leading-4">
                    {changeable >= 1
                      ? `Puedes cambiar hasta ${(changeable * GOLD_PER_DIAMOND).toLocaleString('es-US')} de oro y recibir ${changeable.toLocaleString('es-US')} diamantes.`
                      : `Necesitas al menos ${GOLD_PER_DIAMOND} de oro para un diamante.`}
                  </Text>
                  <SparklingDiamond size={16} animated={false} />
                </View>
                <View className="mt-2.5 flex-row gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar todo mi oro por diamantes"
                    accessibilityState={{ disabled: changeable < 1 || goldBusy }}
                    disabled={changeable < 1 || goldBusy}
                    onPress={() => void cambiarOro(changeable * GOLD_PER_DIAMOND)}
                    className={cn('h-10 flex-1 items-center justify-center rounded-full active:opacity-85', changeable >= 1 ? 'bg-primary' : 'bg-muted')}>
                    {goldBusy ? (
                      <ActivityIndicator size="small" color="#1A1409" />
                    ) : (
                      <Text className={cn('text-[12px] font-semibold', changeable >= 1 ? 'text-primary-foreground' : 'text-muted-foreground')}>
                        Cambiar todo
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Cambiar solo ${GOLD_PER_DIAMOND} de oro por un diamante`}
                    accessibilityState={{ disabled: gold < GOLD_PER_DIAMOND || goldBusy }}
                    disabled={gold < GOLD_PER_DIAMOND || goldBusy}
                    onPress={() => void cambiarOro(GOLD_PER_DIAMOND)}
                    className={cn('h-10 flex-1 items-center justify-center rounded-full border active:opacity-85',
                      gold >= GOLD_PER_DIAMOND ? 'border-primary/40 bg-primary/10' : 'border-border bg-background')}>
                    <Text className={cn('text-[12px] font-semibold', gold >= GOLD_PER_DIAMOND ? 'text-primary' : 'text-muted-foreground')}>
                      Solo 1 diamante
                    </Text>
                  </Pressable>
                </View>
              </View>
              <Text className="text-muted-foreground mt-3 text-[11px] leading-4">
                {GOLD_PER_DIAMOND} de oro = 1 diamante. El oro que recibe el anfitrión ya tiene aplicada la retención del 30%.
              </Text>
            </View>

            {/* La recarga: en la versión de Play se paga con Google Play, que
                es el único cobro que la tienda acepta dentro de la app; la
                instalación directa la paga con tarjeta. */}
            {play.supported ? (
              <View className="mx-4 mt-4">
                <View className="mb-2 flex-row items-center gap-1.5">
                  <SparklingDiamond size={14} animated={false} />
                  <Text className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em]">RECARGAR DIAMANTES</Text>
                </View>

                {play.error ? <Notice tone="error" text={play.error} className="mx-0" /> : null}
                {notice ? <Notice tone="success" text={notice} className="mx-0" /> : null}

                {!play.ready ? (
                  <View className="gap-2">{[0, 1].map(index => <RowSkeleton key={index} />)}</View>
                ) : play.packs.length === 0 ? (
                  <View className="border-border bg-card rounded-2xl border p-4">
                    <Text className="text-foreground text-[13px] font-semibold">La recarga todavía no está abierta</Text>
                    <Text className="text-muted-foreground mt-1 text-[11.5px] leading-4">
                      Los paquetes de diamantes se activan en Google Play. Mientras tanto puedes ganar diamantes cuando
                      alguien te envía regalos en tu sala, o cambiar el oro que ya tienes.
                    </Text>
                  </View>
                ) : (
                  play.packs.map(pack => (
                    <Pressable
                      key={pack.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Comprar ${pack.amount} diamantes${pack.price ? ` por ${pack.price}` : ''} con Google Play`}
                      accessibilityState={{ disabled: Boolean(play.busy) }}
                      disabled={Boolean(play.busy)}
                      onPress={() => {
                        setNotice(null);
                        void play.buy(pack.id).catch((cause: unknown) => {
                          setError(cause instanceof Error ? cause.message : 'No pudimos completar la compra.');
                        });
                      }}
                      className="border-border bg-card mb-2.5 flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-90">
                      <View className="bg-warning/15 size-10 items-center justify-center rounded-full">
                        <SparklingDiamond size={18} animated={false} tone="gold" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-[13px] font-semibold tabular-nums">
                          {pack.amount.toLocaleString('es-US')} diamantes
                        </Text>
                        <Text className="text-muted-foreground text-[11px]">Se acreditan al confirmar el pago</Text>
                      </View>
                      <View className="bg-primary h-8 items-center justify-center rounded-full px-3">
                        {play.busy === pack.id ? (
                          <ActivityIndicator size="small" color="#2A1B05" />
                        ) : (
                          <Text className="text-primary-foreground text-[12px] font-semibold">{pack.price}</Text>
                        )}
                      </View>
                    </Pressable>
                  ))
                )}

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Recuperar compras de Google Play"
                  onPress={() => { void play.restore(); }}
                  className="mt-1 self-start active:opacity-70">
                  <Text className="text-[11.5px] font-semibold text-primary">Recuperar una compra</Text>
                </Pressable>

                <Text className="text-muted-foreground mt-2 text-[11px] leading-4">
                  El cobro lo hace Google Play y aparece en tu cuenta de Google. Si el saldo no aparece al volver, toca
                  «Recuperar una compra».
                </Text>
              </View>
            ) : config.topUp ? (
            <View className="mx-4 mt-4">
              <View className="mb-2 flex-row items-center gap-1.5">
                <SparklingDiamond size={14} animated={false} tone="gold" />
                <Text className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em]">RECARGAR DIAMANTES</Text>
              </View>

              {error ? <Notice tone="error" text={error} className="mx-0" /> : null}
              {notice ? <Notice tone="success" text={notice} className="mx-0" /> : null}

              {loading ? (
                <View className="gap-2">{[0, 1].map(index => <RowSkeleton key={index} />)}</View>
              ) : packs.length === 0 ? (
                <View className="border-border bg-card rounded-2xl border p-4">
                  <Text className="text-foreground text-[13px] font-semibold">La recarga todavía no está abierta</Text>
                  <Text className="text-muted-foreground mt-1 text-[11.5px] leading-4">
                    Los paquetes de diamantes se activan en Pagos. Mientras tanto puedes ganar diamantes cuando alguien te envía regalos en tu sala, o cambiar el oro que ya tienes.
                  </Text>
                </View>
              ) : (
                packs.map(product => {
                  const price = product.prices[0];
                  const amount = amountIn(product);
                  return (
                    <Pressable
                      key={product.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Comprar ${amount} diamantes${price ? ` por ${priceLabel(price)}` : ''}`}
                      onPress={() => {
                        if (!price) return;
                        setError(null);
                        void visitPayment('checkout', price.id).catch((cause: unknown) => {
                          setError(cause instanceof Error ? cause.message : 'No pudimos abrir el pago.');
                        });
                      }}
                      className="border-border bg-card mb-2.5 flex-row items-center gap-3 rounded-2xl border p-3 active:opacity-90">
                      <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
                        <SparklingDiamond size={18} animated={false} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-foreground text-[13px] font-semibold tabular-nums">
                          {amount.toLocaleString('es-US')} diamantes
                        </Text>
                        <Text className="text-muted-foreground text-[11px]">Se acreditan al confirmar el pago</Text>
                      </View>
                      <View className="bg-primary h-8 items-center justify-center rounded-full px-3">
                        <Text className="text-primary-foreground text-[12px] font-semibold">{price ? priceLabel(price) : ''}</Text>
                      </View>
                    </Pressable>
                  );
                })
              )}

              <Text className="text-muted-foreground mt-1 text-[11px] leading-4">
                El pago se hace con tarjeta en una página segura. Si el saldo no aparece al volver, abre la billetera otra vez y se suma solo.
              </Text>
            </View>
            ) : null}

            {/* De dónde vino cada diamante y cada grano de oro. */}
            <View className="mx-4 mt-5">
              <View className="mb-2 flex-row items-center gap-1.5">
                <Icon as={Receipt} size={13} color={accent.main} />
                <Text className="text-muted-foreground text-[11px] font-semibold tracking-[0.16em]">HISTORIAL</Text>
              </View>

              {historyLoading ? (
                <View className="gap-2">{[0, 1, 2].map(index => <RowSkeleton key={index} avatar={32} />)}</View>
              ) : history.length === 0 ? (
                <View className="border-border bg-card rounded-2xl border p-4">
                  <Text className="text-foreground text-[13px] font-semibold">Todavía no hay movimientos</Text>
                  <Text className="text-muted-foreground mt-1 text-[11.5px] leading-4">
                    Cuando recargues diamantes, cambies oro o alguien te envíe un regalo, aparecerá aquí.
                  </Text>
                </View>
              ) : (
                <View className="border-border bg-card overflow-hidden rounded-2xl border">
                  {history.map((entry, index) => {
                    const Art = entry.kind === 'compra' ? Receipt : entry.kind === 'regalo' ? Gift : ArrowRightLeft;
                    const amount = entry.kind === 'regalo' ? entry.gold : entry.diamonds;
                    const unit = entry.kind === 'regalo' ? 'oro' : 'diamantes';
                    const price =
                      entry.kind === 'compra' && entry.amountMinor !== null && entry.currency
                        ? priceLabel({ currency: entry.currency, unitAmount: entry.amountMinor })
                        : null;
                    const note = [entry.note, price].filter(Boolean).join(' · ');
                    return (
                      <View
                        key={`${entry.kind}-${entry.at}-${index}`}
                        className={cn(
                          'flex-row items-center gap-3 px-3.5 py-3',
                          index < history.length - 1 ? 'border-border border-b' : ''
                        )}>
                        <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,194,75,0.12)' }}>
                          <Icon as={Art} size={14} color={accent.main} />
                        </View>
                        <View className="flex-1">
                          <Text className="text-foreground text-[12.5px] font-semibold" numberOfLines={1}>
                            {entry.title}
                          </Text>
                          {note ? (
                            <Text className="text-muted-foreground mt-0.5 text-[11px]" numberOfLines={1}>
                              {note}
                            </Text>
                          ) : null}
                          <Text className="text-muted-foreground mt-0.5 text-[11px] opacity-70">{whenLabel(entry.at)}</Text>
                        </View>
                        <View className="items-end">
                          <Text
                            className={cn(
                              'text-[14px] font-semibold tabular-nums',
                              entry.kind === 'regalo' ? 'text-primary' : 'text-foreground'
                            )}>
                            {`+${amount.toLocaleString('es-US')}`}
                          </Text>
                          <Text className="text-muted-foreground text-[11px]">{unit}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ir a la tienda a comprar marcos y SVIP"
              onPress={() => router.push('/tienda' as Href)}
              className="border-border bg-card mx-4 mt-4 flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-90">
              <View className="bg-primary/15 size-9 items-center justify-center rounded-full">
                <Icon as={Store} className="text-primary size-4" />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-[13px] font-semibold">Marcos y SVIP</Text>
                <Text className="text-muted-foreground mt-0.5 text-[11px]">Se pagan con los diamantes de tu billetera</Text>
              </View>
              <Icon as={ChevronRight} className="text-muted-foreground size-4" />
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
