import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { Search, UserPlus, Users } from 'lucide-react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { goBack } from '@/components/screen';
import { UserProfileSheet } from '@/components/user-profile-sheet';
import { useAuth } from '@/features/auth';
import { getConnections, profileByNumber, toggleFollow, type Connection } from '@/lib/rooms';
import { cn } from '@/lib/utils';
import { Notice } from '@/components/state-views';
import { RowSkeleton } from '@/components/ui/skeleton';

const TABS = [
  { key: 'followers', label: 'Seguidores' },
  { key: 'following', label: 'Siguiendo' },
  { key: 'friends', label: 'Amigos' },
] as const;

type Kind = (typeof TABS)[number]['key'];

export default function Conexiones() {
  const params = useLocalSearchParams<{ tab?: string; buscar?: string }>();
  const { session } = useAuth();
  const [kind, setKind] = useState<Kind>(TABS.some(tab => tab.key === params.tab) ? (params.tab as Kind) : 'followers');
  const [rows, setRows] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Connection | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [numberDraft, setNumberDraft] = useState('');
  const [finding, setFinding] = useState(false);
  const numberInput = useRef<TextInput>(null);
  const [found, setFound] = useState<Connection | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) return;
    setLoading(true);
    setError(null);
    try {
      setRows(await getConnections(session.user.id, kind));
    } catch {
      setError('No pudimos cargar la lista. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id, kind]);

  useEffect(() => { void load(); }, [load]);

  // Coming from "Buscar por ID" puts the cursor straight in the number field.
  useEffect(() => {
    if (params.buscar !== '1') return;
    const timer = setTimeout(() => numberInput.current?.focus(), 350);
    return () => clearTimeout(timer);
  }, [params.buscar]);

  async function follow(row: Connection) {
    if (busy) return;
    setBusy(row.id);
    try {
      const following = await toggleFollow(row.id);
      setRows(current => current.map(item => (item.id === row.id ? { ...item, is_following: following } : item)));
    } catch {
      setError('No pudimos actualizar el seguimiento.');
    } finally {
      setBusy(null);
    }
  }

  async function buscarPorId() {
    const value = Number(numberDraft.replace(/\D/g, ''));
    setError(null);
    setFound(null);
    if (!Number.isFinite(value) || String(value).length !== 7) {
      setError('El ID tiene 7 cifras.');
      return;
    }
    setFinding(true);
    try {
      const row = await profileByNumber(value);
      if (!row) setError(`No encontramos a nadie con el ID ${value}.`);
      else if (row.id === session?.user.id) setError('Ese ID es el tuyo.');
      else setFound({ id: row.id, display_name: row.display_name, avatar_url: row.avatar_url, level: row.level, is_following: false });
    } catch {
      setError('No pudimos buscar ese ID. Revisa tu conexión.');
    } finally {
      setFinding(false);
    }
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} className="border-border bg-card size-10 items-center justify-center rounded-full border active:opacity-70">
          <Icon as={Users} className="text-foreground size-4" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-foreground text-[17px] font-semibold">Tu círculo</Text>
          <Text className="text-muted-foreground text-[11px]">Quién te sigue y a quién sigues</Text>
        </View>
      </View>

      <View className="mx-5 mt-2 flex-row gap-1.5 rounded-full border border-border bg-card p-1">
        {TABS.map(tab => {
          const active = tab.key === kind;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.label}
              onPress={() => setKind(tab.key)}
              className={cn('h-9 flex-1 items-center justify-center rounded-full', active ? 'bg-primary' : '')}>
              <Text className={cn('text-[12px] font-medium', active ? 'text-primary-foreground' : 'text-muted-foreground')}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="mx-5 mt-2 flex-row items-center gap-2">
        <View className="border-border bg-card h-11 flex-1 flex-row items-center gap-2 rounded-full border px-4">
          <Icon as={Search} className="text-muted-foreground size-4" />
          <TextInput
            ref={numberInput}
            value={numberDraft}
            onChangeText={text => setNumberDraft(text.replace(/\D/g, '').slice(0, 7))}
            onSubmitEditing={() => void buscarPorId()}
            keyboardType="number-pad"
            placeholder="Buscar por ID de 7 cifras"
            placeholderTextColor="#8A8073"
            accessibilityLabel="Buscar a una persona por su ID de 7 cifras"
            className="text-foreground flex-1 text-[13px]"
            style={{ color: '#F6F0E4' }}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buscar ese ID"
          disabled={finding || numberDraft.length !== 7}
          onPress={() => void buscarPorId()}
          className={cn('h-11 items-center justify-center rounded-full px-4', numberDraft.length === 7 ? 'bg-primary' : 'bg-muted')}>
          {finding ? (
            <ActivityIndicator size="small" color="#1A1409" />
          ) : (
            <Text className={cn('text-[12px] font-semibold', numberDraft.length === 7 ? 'text-primary-foreground' : 'text-muted-foreground')}>Buscar</Text>
          )}
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-2 px-5 pb-10 pt-4" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="gap-2">{[0, 1, 2].map(index => <RowSkeleton key={index} />)}</View>
        ) : null}

        {error ? <Notice tone="error" text={error} className="mx-0" /> : null}

        {found ? (
          <View className="border-primary/40 bg-primary/10 flex-row items-center gap-3 rounded-2xl border px-3 py-2.5">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver el perfil de ${found.display_name}`}
              onPress={() => setSelected(found)}
              className="flex-1 flex-row items-center gap-3 active:opacity-80">
              <Avatar alt={found.display_name} className="size-11">
                {found.avatar_url ? <AvatarImage source={{ uri: found.avatar_url }} /> : null}
                <AvatarFallback className="bg-muted">
                  <Text className="text-foreground text-sm font-semibold">{found.display_name.slice(0, 1).toUpperCase()}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{found.display_name}</Text>
                <Text className="text-primary text-[11px] font-medium tabular-nums">ID {numberDraft}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ver la ficha de ${found.display_name}`}
              onPress={() => setSelected(found)}
              className="border-border bg-card h-9 items-center justify-center rounded-full border px-3">
              <Text className="text-foreground text-[11px] font-semibold">Ver ficha</Text>
            </Pressable>
          </View>
        ) : null}



        {!loading && rows.length === 0 ? (
          <View className="border-border bg-card items-center gap-2 rounded-2xl border px-6 py-10">
            <Icon as={UserPlus} className="text-muted-foreground size-5" />
            <Text className="text-foreground text-center text-sm font-medium">
              {kind === 'followers' ? 'Todavía no tienes seguidores' : kind === 'following' ? 'Todavía no sigues a nadie' : 'Todavía no tienes amigos'}
            </Text>
            <Text className="text-muted-foreground text-center text-[11px] leading-4">
              {kind === 'friends'
                ? 'Un amigo es alguien con quien el seguimiento es mutuo. Entra a una sala y sigue a alguien que también te siga.'
                : 'Toca a una persona sentada en una sala para ver su ficha y seguirla.'}
            </Text>
            <Pressable accessibilityRole="button" onPress={() => router.replace('/' as Href)} className="bg-primary mt-2 h-10 items-center justify-center rounded-full px-4">
              <Text className="text-primary-foreground text-xs font-semibold">Ir a las salas</Text>
            </Pressable>
          </View>
        ) : null}

        {rows.map(row => (
          <View key={row.id} className="border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3 py-2.5">
            <Pressable accessibilityRole="button" accessibilityLabel={`Ver el perfil de ${row.display_name}`} onPress={() => setSelected(row)} className="flex-1 flex-row items-center gap-3 active:opacity-80">
              <Avatar alt={row.display_name} className="size-11">
                {row.avatar_url ? <AvatarImage source={{ uri: row.avatar_url }} /> : null}
                <AvatarFallback className="bg-muted">
                  <Text className="text-foreground text-sm font-semibold">{row.display_name.slice(0, 1).toUpperCase()}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{row.display_name}</Text>
                <Text className="text-muted-foreground text-[11px]">Nivel {row.level}</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={row.is_following ? `Dejar de seguir a ${row.display_name}` : `Seguir a ${row.display_name}`}
              onPress={() => void follow(row)}
              className={cn('h-9 items-center justify-center rounded-full border px-3', row.is_following ? 'border-border bg-card' : 'border-primary bg-primary/15')}>
              <Text className={cn('text-[11px] font-semibold', row.is_following ? 'text-foreground' : 'text-primary')}>
                {busy === row.id ? '…' : row.is_following ? 'Siguiendo' : 'Seguir'}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <UserProfileSheet
        visible={selected !== null}
        userId={selected?.id ?? null}
        fallbackName={selected?.display_name ?? 'Miembro'}
        fallbackAvatar={selected?.avatar_url ?? null}
        isHostSeat={false}
        isSelf={selected?.id === session?.user.id}
        onClose={() => setSelected(null)}
        onGift={() => setSelected(null)}
      />
    </SafeAreaView>
  );
}
