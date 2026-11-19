import { CATALOG_MAX } from '@/lib/responsive';
import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Bell, ChevronRight, Gift, MessageCircle, MessageSquarePlus, UserPlus } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { timeAgo } from '@/lib/activity';
import { getNotices } from '@/lib/notices-data';
import type { AppNotice } from '@/lib/notices';
import { listConversations, useDirectInbox, type Conversation } from '@/lib/direct';
import { cn } from '@/lib/utils';
import { EmptyState, Notice, TabHeader } from '@/components/state-views';
import { RowSkeleton } from '@/components/ui/skeleton';

/**
 * Mensajes holds only what is addressed to this person: private conversations
 * with friends, and the app's notices. Room chats stay inside their room.
 */
export default function Mensajes() {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    try {
      const [chats, avisos] = await Promise.all([listConversations(), getNotices(session.user.id)]);
      setConversations(chats);
      setNotices(avisos.slice(0, 4));
      setError(null);
    } catch {
      setError('No pudimos cargar tus mensajes. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);
  useDirectInbox(() => { void load(); });

  const unread = conversations.reduce((total, item) => total + Number(item.unread ?? 0), 0);

  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="pb-28"
        contentContainerStyle={{ width: '100%', maxWidth: CATALOG_MAX, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor="#FFC24B" />}>
        <TabHeader
          title="Mensajes"
          subtitle="Privados entre amigos y avisos de Latino Live"
          action={(
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Escribir un mensaje privado a un amigo"
              onPress={() => router.push('/mensajes/nuevo' as Href)}
              className="bg-primary size-10 items-center justify-center rounded-full active:bg-primary/80">
              <Icon as={MessageSquarePlus} className="text-primary-foreground size-4" />
            </Pressable>
          )}
        />

        {error ? <Notice tone="error" text={error} onRetry={() => { setLoading(true); void load(); }} /> : null}

        <View className="flex-row items-center gap-2 px-5 pb-2">
          <Icon as={MessageCircle} className="text-primary size-4" />
          <Text className="text-foreground flex-1 text-base font-semibold">Mensajes privados</Text>
          {unread > 0 ? (
            <View className="bg-primary rounded-full px-2 py-0.5">
              <Text className="text-primary-foreground text-[11px] font-semibold tabular-nums">{unread}</Text>
            </View>
          ) : null}
        </View>

        {loading && conversations.length === 0 ? (
          <View className="gap-2 px-5">
            {[0, 1, 2].map(index => <RowSkeleton key={index} />)}
          </View>
        ) : null}

        {!loading && conversations.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="Sin conversaciones privadas"
            hint="Habla en privado con tus amigos. Los mensajes de las salas siguen dentro de cada sala."
            action={{ label: 'Nuevo mensaje', onPress: () => router.push('/mensajes/nuevo' as Href) }}
          />
        ) : null}

        <View className="gap-2 px-5">
          {conversations.map(item => (
            <Pressable
              key={item.partner_id}
              accessibilityRole="button"
              accessibilityLabel={`Abrir la conversación con ${item.display_name}${item.unread ? `, ${item.unread} sin leer` : ''}`}
              onPress={() => router.push(`/mensajes/${item.partner_id}` as Href)}
              className="border-border bg-card flex-row items-center gap-3 rounded-2xl border px-3.5 py-3 active:bg-muted">
              {item.avatar_url ? (
                <Image source={{ uri: item.avatar_url }} className="size-11 rounded-full" />
              ) : (
                <View className={cn('size-11 items-center justify-center rounded-full', item.unread ? 'bg-primary/25' : 'bg-muted')}>
                  <Text className={cn('text-[14px] font-semibold', item.unread ? 'text-primary' : 'text-foreground')}>
                    {item.display_name.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <Text className={cn('flex-1 text-[13px]', item.unread ? 'text-foreground font-semibold' : 'text-foreground font-medium')} numberOfLines={1}>
                    {item.display_name}
                  </Text>
                  <Text className="text-muted-foreground text-[11px]">{timeAgo(item.last_at)}</Text>
                </View>
                <Text className={cn('mt-0.5 text-[12px]', item.unread ? 'text-foreground' : 'text-muted-foreground')} numberOfLines={1}>
                  {item.last_mine ? 'Tú: ' : ''}{item.last_body}
                </Text>
              </View>
              {item.unread > 0 ? <View className="bg-primary size-2.5 rounded-full" /> : null}
            </Pressable>
          ))}
        </View>

        <View className="mt-6 flex-row items-center gap-2 px-5 pb-2">
          <Icon as={Bell} className="text-primary size-4" />
          <Text className="text-foreground flex-1 text-base font-semibold">Notificaciones de la app</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ver todas las notificaciones"
            onPress={() => router.push('/notificaciones' as Href)}
            className="flex-row items-center gap-0.5 active:opacity-70">
            <Text className="text-primary text-[11px] font-medium">Ver todas</Text>
            <Icon as={ChevronRight} className="text-primary size-3.5" />
          </Pressable>
        </View>

        {notices.length === 0 ? (
          <View className="border-border bg-card mx-5 items-center gap-1.5 rounded-2xl border px-5 py-6">
            <Icon as={Bell} className="text-muted-foreground size-4" />
            <Text className="text-foreground text-[12px] font-semibold">Sin avisos todavía</Text>
            <Text className="text-muted-foreground text-center text-[11px] leading-4">
              Aquí verás regalos, nuevos seguidores y mensajes de tus salas.
            </Text>
          </View>
        ) : (
          <View className="gap-2 px-5">
            {notices.map(notice => (
              <Pressable
                key={notice.id}
                accessibilityRole="button"
                accessibilityLabel={`${notice.title}. ${notice.body}`}
                onPress={() => router.push((notice.slug ? `/room/${notice.slug}` : '/notificaciones') as Href)}
                className="border-border bg-card flex-row items-start gap-3 rounded-2xl border px-3.5 py-3 active:bg-muted">
                <View className="bg-primary/15 size-9 items-center justify-center rounded-full">
                  <Icon as={notice.kind === 'gift' ? Gift : notice.kind === 'follow' ? UserPlus : MessageCircle} className="text-primary size-4" />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground flex-1 text-[12px] font-semibold" numberOfLines={1}>{notice.title}</Text>
                    <Text className="text-muted-foreground text-[11px]">{timeAgo(notice.at)}</Text>
                  </View>
                  <Text className="text-muted-foreground mt-0.5 text-[11px] leading-4" numberOfLines={2}>{notice.body}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Configurar notificaciones del teléfono"
          onPress={() => router.push('/perfil/permisos' as Href)}
          className="border-border bg-card/60 mx-5 mt-4 flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:bg-muted">
          <Icon as={Bell} className="text-primary size-4" />
          <Text className="text-foreground flex-1 text-[12px] font-medium">Avisos en el teléfono</Text>
          <Icon as={ChevronRight} className="text-muted-foreground size-4" />
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
