import { CATALOG_MAX } from '@/lib/responsive';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Camera, Heart, MessageCircle, MoonStar, Pencil, Send, Sparkles, Trash2, X } from 'lucide-react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAccent } from '@/lib/theme-accent';
import { useAuth } from '@/features/auth';
import {
  addComment,
  deleteMoment,
  getComments,
  getMomentFeed,
  momentPhotoUrl,
  toggleLike,
  type Moment,
  type MomentComment,
} from '@/lib/moments';
import { timeAgo } from '@/lib/activity';
import { EmptyState, Notice, TabHeader } from '@/components/state-views';
import { RowSkeleton, SkeletonPhoto } from '@/components/ui/skeleton';

export default function Momentos() {
  const { session } = useAuth();
  const accent = useAccent();
  const [feed, setFeed] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyLike, setBusyLike] = useState<string | null>(null);
  const [openComments, setOpenComments] = useState<Moment | null>(null);
  const [comments, setComments] = useState<MomentComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [tab, setTab] = useState<'parati' | 'siguiendo'>('parati');

  const load = useCallback(async () => {
    try {
      setError(null);
      setFeed(await getMomentFeed(30));
    } catch {
      setError('No pudimos cargar los momentos. Desliza hacia abajo para reintentar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function like(moment: Moment) {
    if (busyLike) return;
    setBusyLike(moment.id);
    try {
      const liked = await toggleLike(moment.id);
      setFeed(current => current.map(item => (
        item.id === moment.id
          ? { ...item, liked, likes: Math.max(0, item.likes + (liked ? 1 : -1)) }
          : item
      )));
    } catch {
      setError('No pudimos guardar tu me gusta.');
    } finally {
      setBusyLike(null);
    }
  }

  async function openThread(moment: Moment) {
    setOpenComments(moment);
    setComments([]);
    setCommentError(null);
    setCommentsLoading(true);
    try {
      setComments(await getComments(moment.id));
    } catch {
      setCommentError('No pudimos cargar los comentarios.');
    } finally {
      setCommentsLoading(false);
    }
  }

  async function sendComment() {
    const body = draft.trim();
    if (!body || !openComments) return;
    try {
      await addComment(openComments.id, body);
      setDraft('');
      setComments(await getComments(openComments.id));
      setFeed(current => current.map(item => (
        item.id === openComments.id ? { ...item, comments: item.comments + 1 } : item
      )));
      setOpenComments(current => (current ? { ...current, comments: current.comments + 1 } : current));
    } catch (cause) {
      setCommentError(cause instanceof Error ? cause.message : 'No pudimos enviar el comentario.');
    }
  }

  async function remove(moment: Moment) {
    try {
      await deleteMoment(moment.id, moment.image_path);
      setFeed(current => current.filter(item => item.id !== moment.id));
    } catch {
      setError('No pudimos borrar el momento.');
    }
  }

  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView
        contentContainerClassName="pb-28"
        contentContainerStyle={{ width: '100%', maxWidth: CATALOG_MAX, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { setLoading(true); void load(); }} tintColor={accent.main} />}>
        <TabHeader
          title="Momentos"
          subtitle="Lo que pasa dentro y fuera de las salas"
          action={(
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Publicar un momento"
              onPress={() => router.push('/momentos/publicar' as Href)}
              className="bg-primary size-10 items-center justify-center rounded-full active:bg-primary/80">
              <Icon as={Pencil} className="text-primary-foreground size-4" />
            </Pressable>
          )}
        />

        <View className="border-border bg-card mx-5 flex-row gap-1 rounded-full border p-1">
          {[
            { key: 'parati', label: 'Para ti' },
            { key: 'siguiendo', label: 'Siguiendo' },
          ].map(item => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: tab === item.key }}
              onPress={() => setTab(item.key as 'parati' | 'siguiendo')}
              className={tab === item.key ? 'h-9 flex-1 items-center justify-center rounded-full bg-primary/15' : 'h-9 flex-1 items-center justify-center rounded-full'}>
              <Text className={tab === item.key ? 'text-primary text-[12px] font-medium' : 'text-muted-foreground text-[12px] font-medium'}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Comparte un momento"
          onPress={() => router.push('/momentos/publicar' as Href)}
          className="border-border bg-card mx-5 mt-4 flex-row items-center gap-3 rounded-[20px] border px-4 py-3 active:opacity-90">
          <View className="border-primary/40 size-9 items-center justify-center rounded-full border">
            <Icon as={MoonStar} className="text-primary size-4" />
          </View>
          <View className="flex-1">
            <Text className="text-foreground text-[13px] font-semibold">Comparte un momento</Text>
            <Text className="text-muted-foreground text-[11px]">Una foto, una idea o un pequeño logro.</Text>
          </View>
          <View className="bg-primary/15 size-9 items-center justify-center rounded-full">
            <Icon as={Camera} className="text-primary size-4" />
          </View>
        </Pressable>

        <View className="flex-row items-center gap-1.5 px-5 pb-3 pt-6">
          <Icon as={Sparkles} className="text-primary size-4" />
          <Text className="text-foreground flex-1 text-base font-semibold">En tu círculo</Text>
          <Text className="text-muted-foreground text-[11px]">{feed.length === 1 ? '1 momento' : `${feed.length} momentos`}</Text>
        </View>

        {error ? <Notice tone="error" text={error} onRetry={() => { setLoading(true); void load(); }} /> : null}

        {loading && feed.length === 0 ? (
          <View className="gap-3 px-5">
            {[0, 1].map(index => (
              <View key={index} className="border-border bg-card gap-3 rounded-[20px] border p-3">
                <View className="flex-row items-center gap-2.5">
                  <RowSkeleton avatar={36} />
                </View>
                <SkeletonPhoto />
              </View>
            ))}
          </View>
        ) : null}

        {!loading && feed.length === 0 ? (
          <EmptyState
            icon={Camera}
            title="Todavía no hay momentos"
            hint="Sé la primera persona en compartir una foto o una idea con la comunidad."
            action={{ label: 'Publicar un momento', onPress: () => router.push('/momentos/publicar' as Href) }}
          />
        ) : null}

        {feed.map(moment => (
          <View key={moment.id} className="border-border bg-card mx-5 mb-4 overflow-hidden rounded-[22px] border">
            <View className="flex-row items-center gap-2.5 px-4 pt-4">
              <Avatar alt={moment.author} className="border-primary/50 size-9 border">
                {moment.avatar_url ? <AvatarImage source={{ uri: moment.avatar_url }} /> : null}
                <AvatarFallback className="bg-primary/15">
                  <Text className="text-primary text-xs font-semibold">{moment.author.slice(0, 1).toUpperCase()}</Text>
                </AvatarFallback>
              </Avatar>
              <View className="flex-1">
                <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{moment.author}</Text>
                <Text className="text-muted-foreground text-[11px]">Nivel {moment.level} · {timeAgo(moment.created_at)}</Text>
              </View>
              {moment.author_id === session?.user.id ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Borrar este momento"
                  onPress={() => void remove(moment)}
                  className="border-border bg-background size-8 items-center justify-center rounded-full border active:opacity-70">
                  <Icon as={Trash2} className="text-muted-foreground size-3.5" />
                </Pressable>
              ) : null}
            </View>

            {moment.body ? (
              <Text className="text-foreground px-4 pb-3 pt-2.5 text-[13px] leading-5">{moment.body}</Text>
            ) : null}

            {moment.image_path ? (
              <Image
                source={{ uri: momentPhotoUrl(moment.image_path) }}
                resizeMode="cover"
                style={{ width: '100%', height: 260 }}
                accessibilityLabel={`Foto del momento de ${moment.author}`}
              />
            ) : null}

            <View className="border-border/70 flex-row items-center gap-4 border-t px-4 py-2.5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={moment.liked ? `Quitar me gusta a ${moment.author}` : `Me gusta el momento de ${moment.author}`}
                accessibilityState={{ selected: moment.liked, disabled: busyLike === moment.id }}
                onPress={() => void like(moment)}
                className="flex-row items-center gap-1.5 active:opacity-70">
                <Icon as={Heart} className={moment.liked ? 'text-destructive size-4' : 'text-muted-foreground size-4'} />
                <Text className={moment.liked ? 'text-destructive text-[11px] tabular-nums' : 'text-muted-foreground text-[11px] tabular-nums'}>
                  {moment.likes}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Ver los comentarios del momento de ${moment.author}`}
                onPress={() => void openThread(moment)}
                className="flex-row items-center gap-1.5 active:opacity-70">
                <Icon as={MessageCircle} className="text-muted-foreground size-4" />
                <Text className="text-muted-foreground text-[11px] tabular-nums">{moment.comments}</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>

      <Modal visible={openComments !== null} transparent animationType="slide" onRequestClose={() => setOpenComments(null)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setOpenComments(null)} accessibilityLabel="Cerrar comentarios">
          <Pressable className="border-border bg-card max-h-[76%] rounded-t-[26px] border px-4 pb-4 pt-3" onPress={() => undefined}>
            <View className="bg-border mx-auto mb-3 h-1 w-10 rounded-full" />
            <View className="flex-row items-center gap-2 pb-2">
              <Text className="text-foreground flex-1 text-[15px] font-semibold">Comentarios</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={() => setOpenComments(null)} className="border-border bg-background size-8 items-center justify-center rounded-full border active:opacity-70">
                <Icon as={X} className="text-foreground size-3.5" />
              </Pressable>
            </View>

            <ScrollView className="max-h-[400px]" contentContainerClassName="gap-2.5 pb-2" keyboardShouldPersistTaps="handled">
              {commentsLoading ? <ActivityIndicator color={accent.main} /> : null}
              {!commentsLoading && comments.length === 0 ? (
                <Text className="text-muted-foreground py-6 text-center text-[12px]">Sé la primera persona en comentar.</Text>
              ) : null}
              {comments.map(comment => (
                <View key={comment.id} className="flex-row items-start gap-2">
                  <Avatar alt={comment.author} className="size-7">
                    <AvatarFallback className="bg-muted">
                      <Text className="text-foreground text-[11px] font-semibold">{comment.author.slice(0, 1).toUpperCase()}</Text>
                    </AvatarFallback>
                  </Avatar>
                  <View className="bg-muted flex-1 rounded-2xl rounded-tl-md px-3 py-2">
                    <Text className="text-muted-foreground mb-0.5 text-[11px]">{comment.author} · {timeAgo(comment.created_at)}</Text>
                    <Text className="text-foreground text-[13px] leading-5">{comment.body}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {commentError ? <Text className="text-destructive pb-1 text-[11px]">{commentError}</Text> : null}

            <View className="border-border bg-background mt-1 h-11 flex-row items-center rounded-full border px-4">
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => void sendComment()}
                placeholder="Escribe un comentario…"
                placeholderTextColor="#8A8073"
                maxLength={300}
                returnKeyType="send"
                accessibilityLabel="Escribir un comentario"
                className="text-foreground flex-1 text-[13px]"
                style={{ paddingVertical: 0, minWidth: 0 }}
              />
              <Pressable accessibilityRole="button" accessibilityLabel="Enviar comentario" onPress={() => void sendComment()} disabled={!draft.trim()} className="active:opacity-60">
                <Icon as={Send} className={draft.trim() ? 'text-primary size-4' : 'text-muted-foreground size-4'} />
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
