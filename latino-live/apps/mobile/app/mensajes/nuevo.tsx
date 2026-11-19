import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { MessageCircle, UserPlus } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { getConnections, type Connection } from '@/lib/rooms';

/** Pick a friend to start a private conversation. */
export default function NuevaConversacion() {
  const { session } = useAuth();
  const [friends, setFriends] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    try {
      setFriends(await getConnections(session.user.id, 'friends'));
    } catch {
      setFriends([]);
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  return (
    <Screen back title="Nuevo mensaje" description="Elige un amigo. Solo los dos podréis leerlo.">
      {loading ? (
        <View className="items-center gap-2 py-10">
          <ActivityIndicator color="#FFC24B" />
          <Text className="text-muted-foreground text-[12px]">Buscando a tus amigos…</Text>
        </View>
      ) : friends.length === 0 ? (
        <View className="border-border bg-card items-center gap-2 rounded-2xl border p-6">
          <View className="bg-primary/15 size-12 items-center justify-center rounded-full">
            <Icon as={UserPlus} className="text-primary size-5" />
          </View>
          <Text className="text-foreground text-sm font-semibold">Aún no tienes amigos</Text>
          <Text className="text-muted-foreground text-center text-[12px] leading-4">
            Los mensajes privados son solo entre amigos. Sigue a alguien y, cuando también te siga, podréis hablar.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/perfil/conexiones?tab=following' as Href)}
            className="bg-primary mt-1 h-10 items-center justify-center rounded-full px-5 active:bg-primary/80">
            <Text className="text-primary-foreground text-[12px] font-semibold">Ver a quién sigo</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="gap-2">
          {friends.map(friend => (
            <Pressable
              key={friend.id}
              accessibilityRole="button"
              accessibilityLabel={`Escribir a ${friend.display_name}`}
              onPress={() => router.push(`/mensajes/${friend.id}` as Href)}
              className="border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3.5 py-3 active:bg-muted">
              {friend.avatar_url ? (
                <Image source={{ uri: friend.avatar_url }} className="size-10 rounded-full" />
              ) : (
                <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
                  <Text className="text-primary text-[13px] font-semibold">{friend.display_name.slice(0, 1).toUpperCase()}</Text>
                </View>
              )}
              <View className="flex-1">
                <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{friend.display_name}</Text>
                <Text className="text-muted-foreground text-[11px]">Nv.{friend.level} · Amigo</Text>
              </View>
              <Icon as={MessageCircle} className="text-primary size-4" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}
