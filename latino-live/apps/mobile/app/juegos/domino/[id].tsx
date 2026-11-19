import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { ArrowLeft, ArrowRight, Dices, DoorOpen, Plus, RefreshCw, Share2, Trophy } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { AvatarPhoto } from '@/components/avatar-photo';
import { DominoTile } from '@/components/domino-tile';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { listProfiles, type ProfileRow } from '@/lib/rooms';
import { shareText } from '@/lib/share';
import {
  getDominoTable,
  getMyDominoHand,
  joinDominoTable,
  leaveDominoTable,
  listDominoPlayers,
  passDominoTurn,
  pipTotal,
  playDominoTile,
  rematchDomino,
  sidesForTile,
  tileValues,
  watchDominoTable,
  type DominoPlayer,
  type DominoSide,
  type DominoTable,
} from '@/lib/domino';

/**
 * Una mesa de dominó: los asientos arriba, la mesa en medio y tu mano abajo.
 * El servidor decide los turnos; esta pantalla solo deja tocar lo que de verdad
 * se puede jugar y avisa cuando la mesa se tranca o alguien gana.
 */
export default function DominoTableScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const tableId = Array.isArray(params.id) ? params.id[0] : params.id ?? '';
  const { session, loading: authLoading } = useAuth();
  const me = session?.user.id ?? null;

  const [table, setTable] = useState<DominoTable | null>(null);
  const [players, setPlayers] = useState<DominoPlayer[]>([]);
  const [hand, setHand] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [sidePick, setSidePick] = useState<{ tile: string; sides: DominoSide[] } | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(true);
  const boardRef = useRef<ScrollView>(null);
  const boardCount = table?.board.length ?? 0;

  const load = useCallback(async (silent = false) => {
    if (!tableId) return;
    if (!silent) setLoading(true);
    try {
      const next = await getDominoTable(tableId);
      if (!next) {
        setTable(null);
        setError('Esa mesa ya no existe.');
        return;
      }
      const seats = await listDominoPlayers([tableId]);
      setTable(next);
      setPlayers(seats);
      if (me) setHand(await getMyDominoHand(tableId));
      const ids = [...new Set([next.host_id, ...seats.map(seat => seat.user_id)])];
      if (ids.length > 0) {
        const found = await listProfiles(ids);
        setProfiles(current => {
          const merged = { ...current };
          found.forEach(row => { merged[row.id] = row; });
          return merged;
        });
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer la mesa.');
    } finally {
      setLoading(false);
    }
  }, [me, tableId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Every phone at the table follows the same row, so a play shows up at once.
  useEffect(() => {
    if (!tableId) return;
    return watchDominoTable(tableId, () => { void load(true); });
  }, [load, tableId]);

  // A quiet poll keeps the turn moving on a phone where live updates sleep.
  useEffect(() => {
    if (!tableId || table?.status === 'finished') return;
    const timer = setInterval(() => { void load(true); }, 6500);
    return () => clearInterval(timer);
  }, [load, table?.status, tableId]);

  useEffect(() => {
    if (boardCount > 0) boardRef.current?.scrollToEnd({ animated: true });
  }, [boardCount]);

  const finishedKey = table?.status === 'finished' ? table.updated_at : null;
  useEffect(() => {
    if (!finishedKey) return;
    setResultOpen(true);
    setSidePick(null);
  }, [finishedKey]);

  const mySeat = useMemo(() => players.find(player => player.user_id === me) ?? null, [me, players]);
  const currentSeat = table?.status === 'playing' ? players.find(player => player.seat_no === table.turn_seat) ?? null : null;
  const myTurn = Boolean(table?.status === 'playing' && mySeat && table.turn_seat === mySeat.seat_no);
  const hostProfile = table ? profiles[table.host_id] : undefined;
  const winnerProfile = table?.winner ? profiles[table.winner] : undefined;
  const nameOf = useCallback(
    (userId: string | null | undefined) => profiles[userId ?? '']?.display_name ?? 'Alguien',
    [profiles],
  );

  async function play(tile: string, side: DominoSide) {
    if (!table || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await playDominoTile(table.id, tile, side);
      setSidePick(null);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos poner esa ficha.');
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  function tapTile(tile: string) {
    if (!table || busy) return;
    if (!myTurn) {
      setNotice('Espera tu turno para poner una ficha.');
      return;
    }
    const sides = sidesForTile(table, tile);
    if (sides.length === 0) {
      setNotice('Esa ficha no entra por ningún extremo.');
      return;
    }
    setNotice(null);
    if (sides.length > 1 && table.left_pip !== table.right_pip) {
      setSidePick({ tile, sides });
      return;
    }
    void play(tile, sides[0]);
  }

  async function pass() {
    if (!table || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const outcome = await passDominoTurn(table.id);
      if (outcome.drew && outcome.tile) {
        const [a, b] = tileValues(outcome.tile);
        setNotice(`Robaste la ficha ${a} y ${b}. Mira si te sirve.`);
      } else {
        setNotice('Pasaste tu turno.');
      }
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos pasar el turno.');
      await load(true);
    } finally {
      setBusy(false);
    }
  }

  async function sitDown() {
    if (!table || busy) return;
    setBusy(true);
    setError(null);
    try {
      await joinDominoTable(table.id);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos sentarte.');
    } finally {
      setBusy(false);
    }
  }

  async function leave() {
    if (!table) return;
    setLeaveOpen(false);
    setBusy(true);
    try {
      await leaveDominoTable(table.id);
    } catch {
      // Leaving should never trap anyone; the lobby proves the real state.
    } finally {
      setBusy(false);
      router.replace('/juegos/domino' as Href);
    }
  }

  async function rematch() {
    if (!table || busy) return;
    setBusy(true);
    setError(null);
    try {
      await rematchDomino(table.id);
      setResultOpen(false);
      await load(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos repartir otra vez.');
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const outcome = await shareText(
      'Mesa de dominó',
      'Te espero en mi mesa de dominó en Latino Live. Abre la app, entra a Juegos y busca mi mesa.',
    );
    if (outcome === 'copied') setNotice('Invitación copiada. Pégala en el chat de la sala.');
    else if (outcome === 'shared') setNotice('Invitación lista para enviar.');
    else if (outcome === 'failed') setError('No pudimos abrir el menú de compartir.');
  }

  if (!authLoading && !session) {
    return (
      <Screen back title="Dominó">
        <View className="border-border bg-card items-center gap-3 rounded-[22px] border px-6 py-9">
          <Icon as={Dices} className="text-primary size-7" />
          <Text className="text-foreground text-center text-[15px] font-semibold">Entra con tu cuenta para jugar</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/entrar' as Href)}
            className="bg-primary mt-1 h-12 w-full items-center justify-center rounded-full active:opacity-85">
            <Text className="text-primary-foreground text-[13.5px] font-semibold">Entrar</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen back title="Dominó" scroll={false}>
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator />
          <Text className="text-muted-foreground text-[12.5px]">Repartiendo la mesa…</Text>
        </View>
      </Screen>
    );
  }

  if (!table) {
    return (
      <Screen back title="Dominó">
        <View className="border-border bg-card items-center gap-3 rounded-[22px] border px-6 py-9">
          <Icon as={Dices} className="text-muted-foreground size-6" />
          <Text className="text-foreground text-center text-[15px] font-semibold">Esta mesa ya no está</Text>
          <Text className="text-muted-foreground text-center text-[12.5px] leading-5">{error ?? 'Puede que se haya cerrado.'}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace('/juegos/domino' as Href)}
            className="bg-primary mt-1 h-11 w-full items-center justify-center rounded-full active:opacity-85">
            <Text className="text-primary-foreground text-[13px] font-semibold">Ver otras mesas</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const waiting = table.status === 'waiting';
  const finished = table.status === 'finished';
  const full = players.length >= table.seats;
  const lastPlay = [...(table.log ?? [])].reverse().find(entry => entry.kind === 'play');

  return (
    <Screen
      back
      title={waiting ? `Mesa de ${table.seats}` : finished ? 'Mesa terminada' : 'Dominó'}
      scroll={false}
      className="gap-2 px-3 pb-1"
      action={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Salir de la mesa"
          onPress={() => setLeaveOpen(true)}
          className="bg-muted size-10 items-center justify-center rounded-full active:opacity-70">
          <Icon as={DoorOpen} className="text-muted-foreground size-4" />
        </Pressable>
      }>
      <View className="flex-row gap-1.5">
        {Array.from({ length: table.seats }, (_, index) => {
          const player = players.find(row => row.seat_no === index);
          const profile = player ? profiles[player.user_id] : undefined;
          const active = table.status === 'playing' && table.turn_seat === index;
          const isMe = player?.user_id === me;
          return (
            <View
              key={index}
              className={`flex-1 items-center gap-1 rounded-[14px] border px-1 py-2 ${active ? 'border-primary/70 bg-primary/10' : 'border-transparent'}`}>
              <View className={`rounded-full p-[2px] ${active ? 'border-primary border' : 'border border-transparent'}`}>
                <View className="bg-muted size-8 overflow-hidden rounded-full">
                  {player ? (
                    <AvatarPhoto uri={profile?.avatar_url ?? null} name={profile?.display_name ?? '?'} />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Icon as={Plus} size={13} className="text-muted-foreground" />
                    </View>
                  )}
                </View>
              </View>
              <Text numberOfLines={1} className={`text-[11px] font-semibold ${active ? 'text-primary' : 'text-foreground'}`}>
                {player ? (profile?.display_name ?? 'Jugador') : 'Libre'}
              </Text>
              <Text numberOfLines={1} className="text-muted-foreground text-[11px]">
                {player ? (isMe ? `${player.tiles_left} fichas · tú` : `${player.tiles_left} fichas`) : 'Esperando'}
              </Text>
            </View>
          );
        })}
      </View>

      {waiting ? (
        <View className="flex-1 justify-center">
          <View className="border-primary/25 overflow-hidden rounded-[26px] border">
            <LinearGradient
              colors={['#17402F', '#102A1E', '#0B1A14']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View className="items-center gap-3 px-6 py-9">
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ transform: [{ rotate: '-10deg' }] }}>
                  <DominoTile tile="6-6" width={48} height={88} />
                </View>
                <View style={{ transform: [{ rotate: '9deg' }], marginTop: 10 }}>
                  <DominoTile tile="3-5" width={48} height={88} />
                </View>
              </View>
              <Text className="text-foreground text-center text-[19px] font-semibold">
                {full ? 'Repartiendo las fichas…' : 'Faltan jugadores'}
              </Text>
              <Text className="text-foreground/60 text-center text-[12.5px] leading-5">
                {full
                  ? 'La mesa está completa. En un momento empieza la partida.'
                  : `Hay ${players.length} de ${table.seats} asientos. Comparte la mesa o espera a que se llene.`}
              </Text>
              {!mySeat && !full ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void sitDown()}
                  disabled={busy}
                  className="bg-primary mt-1 h-12 w-full flex-row items-center justify-center rounded-full active:opacity-85">
                  {busy ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={Plus} size={15} className="text-primary-foreground" />}
                  <Text className="text-primary-foreground ml-2 text-[13.5px] font-semibold">Sentarme</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => void share()}
                className="border-primary/30 mt-1 h-12 w-full flex-row items-center justify-center gap-2 rounded-full border active:bg-primary/10">
                <Icon as={Share2} size={15} className="text-primary" />
                <Text className="text-primary text-[13px] font-semibold">Compartir la mesa</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : (
        <View className="border-primary/20 flex-1 overflow-hidden rounded-[24px] border">
          <LinearGradient
            colors={['#1A4634', '#123325', '#0B1C15']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.feltRing} />
          <View style={styles.feltRingInner} />

          {table.board.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-2 px-8">
              <View className="border-primary/30 bg-primary/10 size-14 items-center justify-center rounded-full border">
                <Icon as={Dices} className="text-primary size-6" />
              </View>
              <Text className="text-foreground text-center text-[16px] font-semibold">La mesa está lista</Text>
              <Text className="text-foreground/60 text-center text-[12px] leading-5">
                {myTurn ? 'Abre con la ficha que quieras.' : `Abre ${nameOf(currentSeat?.user_id)} con su primera ficha.`}
              </Text>
            </View>
          ) : (
            <>
              <View className="absolute left-3 right-3 top-3 z-10 flex-row items-center justify-between">
                <View className="border-primary/40 bg-card/90 flex-row items-center gap-1 rounded-full border px-2.5 py-1">
                  <Icon as={ArrowLeft} size={11} className="text-primary" />
                  <Text className="text-primary text-[11.5px] font-bold tabular-nums">{table.left_pip}</Text>
                </View>
                <View className="border-primary/40 bg-card/90 flex-row items-center gap-1 rounded-full border px-2.5 py-1">
                  <Text className="text-primary text-[11.5px] font-bold tabular-nums">{table.right_pip}</Text>
                  <Icon as={ArrowRight} size={11} className="text-primary" />
                </View>
              </View>
              <ScrollView
                ref={boardRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingTop: 40, paddingBottom: 8 }}>
                {table.board.map((tile, index) => (
                  <View key={`${index}-${tile.l}-${tile.r}`} style={{ marginRight: index === table.board.length - 1 ? 0 : 3 }}>
                    <DominoTile tile={`${tile.l}-${tile.r}`} width={58} height={34} horizontal />
                  </View>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {notice ? <Text className="text-primary px-1 text-[11.5px] leading-4">{notice}</Text> : null}
      {error ? <Text className="text-destructive px-1 text-[11.5px] leading-4">{error}</Text> : null}

      {!waiting ? (
        <View className="flex-row items-center gap-2 rounded-[14px] border border-border bg-card px-3 py-2">
          <View className={`size-2 rounded-full ${myTurn ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
          <Text className={`flex-1 text-[12.5px] font-semibold ${myTurn ? 'text-primary' : 'text-foreground'}`} numberOfLines={1}>
            {finished
              ? table.reason ?? 'La mesa terminó'
              : myTurn
                ? 'Tu turno: toca una ficha'
                : `Turno de ${nameOf(currentSeat?.user_id)}`}
          </Text>
          {lastPlay && !finished ? (
            <Text className="text-muted-foreground text-[11px] tabular-nums">Última: {lastPlay.tile}</Text>
          ) : null}
        </View>
      ) : null}

      {!waiting ? (
        <View className="gap-1.5">
          <View className="flex-row items-center justify-between px-1">
            <Text className="text-muted-foreground text-[11px] font-semibold tracking-wide">TU MANO</Text>
            <Text className="text-muted-foreground text-[11px] tabular-nums">
              {mySeat ? `${hand.length} fichas · ${pipTotal(hand)} puntos` : 'De espectador'}
            </Text>
          </View>
          {hand.length === 0 ? (
            <View className="border-border bg-card h-[92px] items-center justify-center rounded-[18px] border">
              <Text className="text-muted-foreground text-[12px]">
                {finished ? 'La mano está vacía.' : 'Sin fichas en la mano.'}
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 2, paddingVertical: 4 }}>
              {hand.map(tile => {
                const playable = myTurn && sidesForTile(table, tile).length > 0;
                return (
                  <Pressable
                    key={tile}
                    accessibilityRole="button"
                    accessibilityLabel={`Ficha ${tile.split('-')[0]} y ${tile.split('-')[1]}`}
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() => tapTile(tile)}
                    style={{ opacity: myTurn ? 1 : 0.82 }}
                    className="active:scale-95">
                    <DominoTile tile={tile} width={46} height={86} highlight={playable} dimmed={myTurn && !playable} />
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </View>
      ) : null}

      {!waiting ? (
        <View className="flex-row gap-2 pb-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Pasar turno o robar una ficha"
            accessibilityState={{ disabled: !myTurn || busy }}
            disabled={!myTurn || busy}
            onPress={() => void pass()}
            className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border ${myTurn ? 'border-primary/50 bg-primary/10 active:opacity-80' : 'border-border bg-card opacity-50'}`}>
            {busy ? <ActivityIndicator size="small" /> : <Icon as={RefreshCw} size={15} className={myTurn ? 'text-primary' : 'text-muted-foreground'} />}
            <Text className={`text-[13px] font-semibold ${myTurn ? 'text-primary' : 'text-muted-foreground'}`}>Pasar o robar</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir la mesa"
            onPress={() => void share()}
            className="border-border bg-card size-12 items-center justify-center rounded-full border active:bg-muted">
            <Icon as={Share2} size={16} className="text-muted-foreground" />
          </Pressable>
        </View>
      ) : null}

      {/* Elegir extremo cuando la ficha entra por los dos lados. */}
      <Modal visible={Boolean(sidePick)} transparent animationType="fade" onRequestClose={() => setSidePick(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSidePick(null)}>
          <Pressable style={styles.sheet} onPress={() => undefined}>
            {sidePick ? (
              <>
                <View className="items-center gap-2">
                  <DominoTile tile={sidePick.tile} width={56} height={104} />
                  <Text className="text-foreground text-[15px] font-semibold">¿En qué extremo la pones?</Text>
                  <Text className="text-muted-foreground text-center text-[11.5px] leading-4">
                    La mesa tiene {table.left_pip} a la izquierda y {table.right_pip} a la derecha.
                  </Text>
                </View>
                <View className="mt-4 flex-row gap-2">
                  <SideButton label="Izquierda" pip={table.left_pip} onPress={() => void play(sidePick.tile, 'left')} disabled={busy} />
                  <SideButton label="Derecha" pip={table.right_pip} onPress={() => void play(sidePick.tile, 'right')} disabled={busy} />
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* Resultado de la mesa. */}
      <Modal visible={finished && resultOpen} transparent animationType="fade" onRequestClose={() => setResultOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View className="items-center gap-2">
              <View className="bg-primary/15 size-14 items-center justify-center rounded-full">
                <Icon as={Trophy} className="text-primary size-6" />
              </View>
              <Text className="text-foreground text-center text-[20px] font-semibold">
                {table.winner && table.winner === me ? '¡Ganaste la mesa!' : table.winner ? `${winnerProfile?.display_name ?? 'Alguien'} ganó` : 'Mesa trancada'}
              </Text>
              <Text className="text-muted-foreground text-center text-[12.5px] leading-5">
                {table.reason ?? 'La partida terminó.'}
                {mySeat ? ` Te quedaron ${pipTotal(hand)} puntos.` : ''}
              </Text>
            </View>
            <View className="mt-4 gap-2">
              {table.host_id === me && full ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void rematch()}
                  disabled={busy}
                  className="bg-primary h-12 flex-row items-center justify-center gap-2 rounded-full active:opacity-85">
                  {busy ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={RefreshCw} size={15} className="text-primary-foreground" />}
                  <Text className="text-primary-foreground text-[13.5px] font-semibold">Revancha</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => setResultOpen(false)}
                className="border-border h-12 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-[13px] font-semibold">Ver la mesa</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void leave()}
                className="h-10 items-center justify-center">
                <Text className="text-muted-foreground text-[12px]">Salir de la mesa</Text>
              </Pressable>
            </View>
            {table.host_id !== me && full ? (
              <Text className="text-muted-foreground mt-2 text-center text-[11px]">
                {hostProfile?.display_name ?? 'El anfitrión'} puede repartir la revancha.
              </Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Confirmar la salida: en juego, la mesa se termina para todos. */}
      <Modal visible={leaveOpen} transparent animationType="fade" onRequestClose={() => setLeaveOpen(false)}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <Text className="text-foreground text-[17px] font-semibold">¿Salir de la mesa?</Text>
            <Text className="text-muted-foreground mt-1 text-[12.5px] leading-5">
              {table.status === 'playing'
                ? 'La partida está en curso: si sales, se termina para todos.'
                : 'Tu asiento queda libre para otra persona.'}
            </Text>
            <View className="mt-4 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                onPress={() => setLeaveOpen(false)}
                className="border-border h-12 flex-1 items-center justify-center rounded-full border active:bg-muted">
                <Text className="text-foreground text-[13px] font-semibold">Quedarme</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => void leave()}
                className="bg-destructive/15 h-12 flex-1 items-center justify-center rounded-full active:opacity-85">
                <Text className="text-destructive text-[13px] font-semibold">Salir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SideButton({ label, pip, onPress, disabled }: { label: string; pip: number | null; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Poner la ficha a la ${label.toLowerCase()}, extremo ${pip ?? ''}`}
      disabled={disabled}
      onPress={onPress}
      className="border-primary/40 bg-primary/10 h-14 flex-1 items-center justify-center gap-0.5 rounded-[16px] border active:opacity-80">
      <Text className="text-primary text-[12.5px] font-semibold">{label}</Text>
      <Text className="text-foreground text-[18px] font-bold tabular-nums">{pip}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  feltRing: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.12)',
    alignSelf: 'center',
    top: '22%',
  },
  feltRingInner: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.08)',
    alignSelf: 'center',
    top: '32%',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(4,6,5,0.74)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    backgroundColor: '#14110E',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.24)',
    padding: 20,
  },
});
