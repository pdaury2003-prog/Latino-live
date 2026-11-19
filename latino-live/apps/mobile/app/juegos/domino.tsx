import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, type Href } from 'expo-router';
import { ChevronRight, Dices, Plus, Sparkles, Users, Zap } from 'lucide-react-native';
import { Screen, Section } from '@/components/screen';
import { AvatarPhoto } from '@/components/avatar-photo';
import { DominoBack, DominoTile } from '@/components/domino-tile';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { listProfiles, type ProfileRow } from '@/lib/rooms';
import {
  createDominoTable,
  joinDominoTable,
  listDominoPlayers,
  listDominoTables,
  type DominoPlayer,
  type DominoTable,
} from '@/lib/domino';

/**
 * La antesala del dominó: abrir una mesa de 2 o 4, entrar a una que ya espera
 * o dejar que el juego rápido encuentre asiento. Sin apuestas: se juega por
 * quedarse sin fichas.
 */
export default function DominoLobby() {
  const { session, loading: authLoading } = useAuth();
  const [tables, setTables] = useState<DominoTable[]>([]);
  const [players, setPlayers] = useState<DominoPlayer[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const me = session?.user.id ?? null;

  const load = useCallback(async () => {
    if (!me) {
      setTables([]);
      setPlayers([]);
      setLoading(false);
      return;
    }
    try {
      const rows = await listDominoTables();
      const seats = await listDominoPlayers(rows.map(row => row.id));
      setTables(rows);
      setPlayers(seats);
      const ids = [...new Set([...rows.map(row => row.host_id), ...seats.map(seat => seat.user_id)])];
      if (ids.length > 0) {
        const found = await listProfiles(ids);
        setProfiles(current => {
          const next = { ...current };
          found.forEach(row => { next[row.id] = row; });
          return next;
        });
      }
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos leer las mesas.');
    } finally {
      setLoading(false);
    }
  }, [me]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const seated = (tableId: string) => players.filter(player => player.table_id === tableId);
  const openTables = tables.filter(table => table.status === 'waiting' && seated(table.id).length < table.seats);
  const mine = tables.filter(table => seated(table.id).some(player => player.user_id === me));

  async function openMyTable(seats: 2 | 4) {
    if (!me || busy) return;
    setBusy(`new-${seats}`);
    setError(null);
    try {
      const id = await createDominoTable(seats);
      router.push(`/juegos/domino/${id}` as Href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos abrir la mesa.');
    } finally {
      setBusy(null);
    }
  }

  async function join(table: DominoTable) {
    if (!me || busy) return;
    setBusy(table.id);
    setError(null);
    try {
      await joinDominoTable(table.id);
      router.push(`/juegos/domino/${table.id}` as Href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos entrar a esa mesa.');
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function quick() {
    if (!me || busy) return;
    setBusy('quick');
    setError(null);
    try {
      const target = openTables[0];
      if (target) {
        await joinDominoTable(target.id);
        router.push(`/juegos/domino/${target.id}` as Href);
      } else {
        const id = await createDominoTable(4);
        router.push(`/juegos/domino/${id}` as Href);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos sentarte.');
    } finally {
      setBusy(null);
    }
  }

  if (!authLoading && !session) {
    return (
      <Screen back title="Dominó" description="Mesas de 2 o 4 jugadores.">
        <View className="border-border bg-card items-center gap-3 rounded-[22px] border px-6 py-9">
          <View className="bg-primary/15 size-14 items-center justify-center rounded-full">
            <Icon as={Dices} className="text-primary size-6" />
          </View>
          <Text className="text-foreground text-center text-[15px] font-semibold">Entra con tu cuenta</Text>
          <Text className="text-muted-foreground text-center text-[12.5px] leading-5">
            Tu mano y tus mesas quedan guardadas en tu perfil, así que necesitas una cuenta para jugar.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/entrar' as Href)}
            className="bg-primary mt-1 h-12 w-full items-center justify-center rounded-full active:opacity-85">
            <Text className="text-primary-foreground text-[13.5px] font-semibold">Entrar o crear cuenta</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen back title="Dominó" description="Mesas de 2 o 4 jugadores. Gana quien se queda sin fichas.">
      {error ? <Text className="text-destructive -mt-3 text-[12px]">{error}</Text> : null}

      <View className="border-primary/30 overflow-hidden rounded-[26px] border">
        <LinearGradient
          colors={['#1C4A36', '#12301F', '#0C1712']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        <View
          style={{ position: 'absolute', width: 190, height: 190, borderRadius: 95, borderWidth: 1, borderColor: 'rgba(255,194,75,0.18)', right: -50, top: -40 }}
        />
        <View style={{ position: 'absolute', right: 18, top: 30, flexDirection: 'row', gap: 6 }}>
          <View style={{ transform: [{ rotate: '-14deg' }], opacity: 0.9 }}>
            <DominoBack width={38} height={70} />
          </View>
          <View style={{ transform: [{ rotate: '9deg' }], marginTop: 14 }}>
            <DominoTile tile="6-6" width={38} height={70} />
          </View>
        </View>

        <View className="gap-3 p-5 pr-24">
          <View className="border-primary/35 bg-primary/15 flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1">
            <Icon as={Sparkles} size={11} className="text-primary" />
            <Text className="text-[11px] font-semibold tracking-wide text-primary">MESA DE LA CASA</Text>
          </View>
          <Text className="text-foreground text-[24px] font-semibold leading-[1.1]">
            La mesa está servida.
          </Text>
          <Text className="text-foreground/70 text-[12px] leading-5">
            Fichas dobles, turnos y una sola regla: quedarte sin fichas primero. Sin apuestas ni premios.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Juego rápido de dominó"
            accessibilityState={{ disabled: Boolean(busy) }}
            disabled={Boolean(busy)}
            onPress={() => void quick()}
            className="bg-primary h-12 flex-row items-center justify-center gap-2 self-start rounded-full px-5 active:opacity-85">
            {busy === 'quick' ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={Zap} size={16} className="text-primary-foreground" />}
            <Text className="text-primary-foreground text-[13.5px] font-bold">Juego rápido</Text>
          </Pressable>
        </View>
      </View>

      <View className="flex-row gap-2">
        {([2, 4] as const).map(seats => (
          <Pressable
            key={seats}
            accessibilityRole="button"
            accessibilityLabel={`Abrir una mesa de ${seats} jugadores`}
            disabled={Boolean(busy)}
            onPress={() => void openMyTable(seats)}
            className="border-border bg-card h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full border active:bg-muted">
            {busy === `new-${seats}` ? (
              <ActivityIndicator size="small" />
            ) : (
              <Icon as={Plus} className="text-primary size-4" />
            )}
            <Text className="text-foreground text-[13px] font-semibold">Mesa de {seats}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View className="items-center py-6">
          <ActivityIndicator />
        </View>
      ) : null}

      {mine.length > 0 ? (
        <Section title="Tus mesas">
          <View className="gap-2">
            {mine.map(table => {
              const count = seated(table.id).length;
              return (
                <TableRow
                  key={table.id}
                  table={table}
                  host={profiles[table.host_id]}
                  count={count}
                  action="Abrir"
                  onPress={() => router.push(`/juegos/domino/${table.id}` as Href)}
                />
              );
            })}
          </View>
        </Section>
      ) : null}

      <Section title="Mesas abiertas">
        {openTables.length === 0 ? (
          <View className="border-border bg-card items-center gap-1 rounded-[20px] border px-5 py-7">
            <Icon as={Users} className="text-muted-foreground size-5" />
            <Text className="text-foreground mt-1 text-[13.5px] font-semibold">Nadie espera todavía</Text>
            <Text className="text-muted-foreground text-center text-[12px] leading-5">
              Abre una mesa y compártela con la sala. En cuanto se llene, se reparten las fichas.
            </Text>
          </View>
        ) : (
          <View className="gap-2">
            {openTables.map(table => {
              const count = seated(table.id).length;
              return (
                <TableRow
                  key={table.id}
                  table={table}
                  host={profiles[table.host_id]}
                  count={count}
                  action={count >= table.seats ? 'Llena' : 'Entrar'}
                  disabled={Boolean(busy) || count >= table.seats}
                  busy={busy === table.id}
                  onPress={() => void join(table)}
                />
              );
            })}
          </View>
        )}
      </Section>

      <View className="border-border bg-card gap-2 rounded-[20px] border p-4">
        <Text className="text-foreground text-[13px] font-semibold">Cómo se juega</Text>
        <Text className="text-muted-foreground text-[12px] leading-5">
          Sale primero quien tiene la ficha doble más alta. En tu turno pones una ficha que coincida con un extremo;
          si no puedes, robas del montón. Si la mesa se tranca, gana quien tenga menos puntos en la mano.
        </Text>
      </View>
    </Screen>
  );
}

function TableRow({
  table,
  host,
  count,
  action,
  onPress,
  disabled = false,
  busy = false,
}: {
  table: DominoTable;
  host: ProfileRow | undefined;
  count: number;
  action: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const state = table.status === 'waiting' ? 'Esperando' : table.status === 'playing' ? 'En juego' : 'Terminada';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mesa de ${host?.display_name ?? 'un jugador'}, ${count} de ${table.seats} asientos, ${state}. ${action}`}
      disabled={disabled || busy}
      onPress={onPress}
      className="border-border bg-card flex-row items-center gap-3 rounded-[18px] border px-3.5 py-3 active:bg-muted">
      <View className="border-primary/30 size-10 overflow-hidden rounded-full border">
        <AvatarPhoto uri={host?.avatar_url ?? null} name={host?.display_name ?? '?'} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text numberOfLines={1} className="text-foreground text-[13.5px] font-semibold">
          {host?.display_name ?? 'Mesa de la casa'}
        </Text>
        <Text className="text-muted-foreground text-[11.5px]">
          {count} de {table.seats} asientos · {state}
        </Text>
      </View>
      <View
        className={disabled ? 'bg-muted h-9 flex-row items-center rounded-full px-3' : 'bg-primary h-9 flex-row items-center rounded-full px-3'}>
        {busy ? (
          <ActivityIndicator size="small" color="#2A1B46" />
        ) : (
          <>
            <Text className={disabled ? 'text-muted-foreground text-[12px] font-semibold' : 'text-[12px] font-semibold text-[#2A1B46]'}>
              {action}
            </Text>
            {disabled ? null : <Icon as={ChevronRight} size={13} className="ml-0.5 text-[#2A1B46]" />}
          </>
        )}
      </View>
    </Pressable>
  );
}
