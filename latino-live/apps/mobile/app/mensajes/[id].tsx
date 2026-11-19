import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { pickPhotoFromLibrary } from '@/lib/pick-photo';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, Gift, Send, ShieldCheck } from 'lucide-react-native';
import { Screen, goBack } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { UserProfileSheet } from '@/components/user-profile-sheet';
import { useAuth } from '@/features/auth';
import { useDirectUnread } from '@/features/direct-alerts';
import { cn } from '@/lib/utils';
import { Notice } from '@/components/state-views';
import { capped } from '@/lib/responsive';
import { useResponsive } from '@/lib/use-responsive';
import { getProfile, type ProfileRow } from '@/lib/rooms';
import {
  DIRECT_GIFTS,
  directPhotoUrl,
  listDirectGifts,
  listDirectMessages,
  markConversationRead,
  sendDirectMessage,
  sendDirectGift,
  sendDirectPhoto,
  useDirectLive,
  type DirectGift,
  type DirectMessage,
} from '@/lib/direct';

export default function Conversacion() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const partnerId = id ?? '';
  const { width } = useResponsive();
  // La foto del mensaje sigue el ancho del teléfono: grande en uno ancho,
  // recogida en uno angosto, y siempre en la misma proporción.
  const photoWidth = Math.round(Math.max(132, Math.min(210, capped(width, 520) * 0.52)));
  const { session } = useAuth();
  const { markRead } = useDirectUnread();
  const me = session?.user.id;
  const chatRef = useRef<ScrollView>(null);
  const [partner, setPartner] = useState<ProfileRow | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [gifts, setGifts] = useState<DirectGift[]>([]);
  const [giftOpen, setGiftOpen] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);
  const [brokenPhotos, setBrokenPhotos] = useState<Record<string, boolean>>({});

  const load = useCallback(async () => {
    if (!partnerId) return;
    try {
      const [profile, rows, sent] = await Promise.all([
        getProfile(partnerId),
        listDirectMessages(partnerId),
        listDirectGifts(partnerId),
      ]);
      setPartner(profile);
      setMessages(rows);
      setGifts(sent);
      setError(null);
      await markConversationRead(partnerId);
      markRead(partnerId);
    } catch {
      setError('No pudimos abrir esta conversación. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [partnerId, markRead]);

  useEffect(() => { void load(); }, [load]);
  useDirectLive(partnerId, () => { void load(); });

  useEffect(() => {
    if (!messages.length) return;
    const timer = setTimeout(() => chatRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(timer);
  }, [messages.length]);

  async function send() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft('');
    try {
      await sendDirectMessage(partnerId, text);
      await load();
    } catch (cause) {
      setDraft(text);
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar tu mensaje.');
    } finally {
      setSending(false);
    }
  }

  async function pickPhoto() {
    if (photoBusy) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const picked = await pickPhotoFromLibrary({ quality: 0.8 });
      if (picked.status === 'unavailable') {
        setError('La galería no está disponible en esta versión. Instala la más reciente.');
        return;
      }
      if (picked.status === 'failed') {
        setError('No pudimos abrir la galería. Inténtalo otra vez.');
        return;
      }
      if (picked.status !== 'picked') return;
      await sendDirectPhoto(partnerId, picked.photo, draft.trim());
      setDraft('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar la foto.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function sendGift(key: string, cost: number) {
    setGiftOpen(false);
    try {
      await sendDirectGift(partnerId, key, cost);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos enviar el regalo.');
    }
  }

  const timeline = [
    ...messages.map(message => ({ kind: 'message' as const, at: message.created_at, message })),
    ...gifts.map(gift => ({ kind: 'gift' as const, at: gift.created_at, gift })),
  ].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));

  const name = partner?.display_name ?? 'Conversación privada';

  return (
    <Screen
      scroll={false}
      back
      title={name}
      description="Mensaje privado entre amigos"
      action={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ver el perfil de ${name}`}
          onPress={() => setProfileOpen(true)}
          className="size-10 items-center justify-center rounded-full active:opacity-70">
          {partner?.avatar_url ? (
            <Image source={{ uri: partner.avatar_url }} className="size-8 rounded-full" />
          ) : (
            <View className="bg-primary/15 size-8 items-center justify-center rounded-full">
              <Text className="text-primary text-[12px] font-semibold">{name.slice(0, 1).toUpperCase()}</Text>
            </View>
          )}
        </Pressable>
      )}>
      <View className="border-border bg-card/60 mb-3 flex-row items-start gap-2 rounded-2xl border px-3 py-2">
        <Icon as={ShieldCheck} className="text-primary mt-0.5 size-3.5" />
        <Text className="text-muted-foreground flex-1 text-[11px] leading-4">
          Solo tú y {name.split(' ')[0]} pueden leer esta conversación.
        </Text>
      </View>

      <ScrollView ref={chatRef} className="flex-1" contentContainerClassName="gap-2.5 pb-4" showsVerticalScrollIndicator={false}>
        {loading ? (
          <View className="items-center gap-2 py-10">
            <ActivityIndicator color="#FFC24B" />
            <Text className="text-muted-foreground text-[12px]">Cargando conversación…</Text>
          </View>
        ) : null}

        {!loading && messages.length === 0 ? (
          <View className="border-border bg-card items-center gap-2 rounded-2xl border p-6">
            <Text className="text-foreground text-sm font-semibold">Empezad a hablar</Text>
            <Text className="text-muted-foreground text-center text-[12px] leading-4">
              Escribe el primer mensaje. Solo los dos podréis leerlo.
            </Text>
          </View>
        ) : null}

        {timeline.map(item => {
          if (item.kind === 'gift') {
            const sent = item.gift.sender_id === me;
            const label = DIRECT_GIFTS.find(entry => entry.key === item.gift.gift_key)?.name ?? item.gift.gift_key;
            return (
              <View
                key={`gift-${item.gift.id}`}
                className={cn('max-w-[80%] flex-row items-center gap-2 rounded-2xl border border-primary/40 bg-primary/10 px-3 py-2', sent ? 'self-end' : 'self-start')}>
                <Icon as={Gift} className="text-primary size-4" />
                <Text className="text-foreground text-[12px]">
                  {sent ? `Enviaste ${label}` : `${name.split(' ')[0]} te envió ${label}`}
                </Text>
              </View>
            );
          }
          const message = item.message;
          const mine = message.sender_id === me;
          return (
            <View key={message.id} className={cn('max-w-[80%]', mine ? 'self-end' : 'self-start')}>
              {message.image_path ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Ver la foto enviada"
                  onPress={() => setViewPhoto(message.image_path)}
                  className="mb-1 overflow-hidden rounded-2xl border border-white/15 active:opacity-90">
                  <Image
                    source={{ uri: directPhotoUrl(message.image_path) }}
                    resizeMode="cover"
                    resizeMethod="resize"
                    onError={() => setBrokenPhotos(current => ({ ...current, [message.id]: true }))}
                    style={{ width: photoWidth, height: Math.round(photoWidth * 0.75) }}
                  />
                  {brokenPhotos[message.id] ? (
                    <View className="bg-muted absolute inset-0 items-center justify-center gap-1 px-3">
                      <Icon as={Camera} className="text-muted-foreground size-4" />
                      <Text className="text-muted-foreground text-center text-[11px]">No pudimos mostrar esta foto</Text>
                    </View>
                  ) : null}
                </Pressable>
              ) : null}
              {message.body ? (
                <View className={cn('rounded-2xl px-3 py-2', mine ? 'bg-primary rounded-tr-md' : 'bg-muted rounded-tl-md')}>
                  <Text className={cn('text-[13px] leading-5', mine ? 'text-primary-foreground' : 'text-foreground')}>{message.body}</Text>
                </View>
              ) : null}
              <Text className={cn('text-muted-foreground mt-0.5 text-[11px]', mine ? 'text-right' : 'text-left')}>
                {new Date(message.created_at).toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })}
                {mine && message.read_at ? ' · Leído' : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {error ? <Notice tone="error" text={error} className="mx-0" /> : null}

      <View className="border-border bg-card mb-2 h-12 flex-row items-center rounded-full border px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar una foto en privado"
          onPress={() => void pickPhoto()}
          disabled={photoBusy}
          className="mr-2 active:opacity-60">
          {photoBusy
            ? <ActivityIndicator size="small" color="#FFC24B" />
            : <Icon as={Camera} className="text-muted-foreground size-4" />}
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={() => void send()}
          placeholder="Escribe un mensaje privado…"
          placeholderTextColor="#8A8073"
          returnKeyType="send"
          maxLength={1000}
          accessibilityLabel="Escribir un mensaje privado"
          className="text-foreground flex-1 text-[14px]"
          style={{ paddingVertical: 0, minWidth: 0 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar mensaje privado"
          onPress={() => void send()}
          disabled={!draft.trim() || sending}
          className="ml-2 size-9 items-center justify-center rounded-full active:opacity-70"
          style={{ backgroundColor: draft.trim() ? '#FFC24B' : 'transparent' }}>
          {sending
            ? <ActivityIndicator size="small" color="#1A1409" />
            : <Icon as={Send} className={cn('size-4', draft.trim() ? 'text-primary-foreground' : 'text-muted-foreground')} />}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Enviar un regalo a ${name}`}
        onPress={() => setGiftOpen(true)}
        className="border-border bg-card mb-2 h-11 flex-row items-center justify-center gap-2 rounded-full border active:bg-muted">
        <Icon as={Gift} className="text-primary size-4" />
        <Text className="text-foreground text-[12px] font-medium">Enviar un regalo a {name.split(' ')[0]}</Text>
      </Pressable>

      <Pressable accessibilityRole="button" onPress={goBack} className="items-center py-1 active:opacity-70">
        <Text className="text-muted-foreground text-[11px]">Volver a Mensajes</Text>
      </Pressable>

      <UserProfileSheet
        visible={profileOpen}
        userId={partnerId || null}
        fallbackName={name}
        fallbackAvatar={partner?.avatar_url ?? null}
        isHostSeat={false}
        isSelf={false}
        onClose={() => setProfileOpen(false)}
        onGift={() => { setProfileOpen(false); router.push('/' as never); }}
      />

      <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setGiftOpen(false)} accessibilityLabel="Cerrar regalos">
          <Pressable className="border-border bg-card rounded-t-[28px] border px-5 pb-8 pt-3" onPress={() => undefined}>
            <View className="bg-border mx-auto mb-4 h-1 w-10 rounded-full" />
            <Text className="text-foreground text-lg font-semibold">Regalos para {name.split(' ')[0]}</Text>
            <Text className="text-muted-foreground mt-1 text-xs">Se envía solo a esta persona.</Text>
            <View className="mt-4 flex-row flex-wrap gap-2">
              {DIRECT_GIFTS.map(item => (
                <Pressable
                  key={item.key}
                  accessibilityRole="button"
                  accessibilityLabel={`Enviar ${item.name} por ${item.cost} diamantes`}
                  onPress={() => void sendGift(item.key, item.cost)}
                  className="border-border bg-background w-[31%] items-center gap-1 rounded-2xl border py-3 active:bg-muted">
                  <Icon as={Gift} className="text-primary size-5" />
                  <Text className="text-foreground text-xs font-medium">{item.name}</Text>
                  <Text className="text-muted-foreground text-[11px] tabular-nums">{item.cost} diamantes</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={viewPhoto !== null} transparent animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/90 px-4" onPress={() => setViewPhoto(null)} accessibilityLabel="Cerrar la foto">
          {viewPhoto ? (
            <Image
              source={{ uri: directPhotoUrl(viewPhoto) }}
              resizeMode="contain"
              onError={() => setViewPhoto(null)}
              style={{ width: '100%', height: '70%' }}
            />
          ) : null}
          <Text className="text-muted-foreground mt-4 text-[11px]">Toca en cualquier lado para cerrar</Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}
