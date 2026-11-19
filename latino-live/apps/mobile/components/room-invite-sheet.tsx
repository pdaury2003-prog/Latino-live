import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Search, Share2, UserPlus, X } from 'lucide-react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { inviteToRoom, searchPeople, type ProfileRow } from '@/lib/rooms';
import { shareText } from '@/lib/share';
import { useAccent } from '@/lib/theme-accent';

type Props = {
  visible: boolean;
  roomId: string;
  roomTitle: string;
  hostName: string;
  /** Whether the room is private: only its host can hand out its code. */
  isPrivate: boolean;
  isHost: boolean;
  selfId: string | undefined;
  onClose: () => void;
  onNotice: (message: string) => void;
};

/**
 * Sharing the room: the link for anyone, and a personal invitation for the
 * people who already have an account in the app. The invited person finds it
 * in their notices and enters the room with one tap.
 */
export function RoomInviteSheet({
  visible,
  roomId,
  roomTitle,
  hostName,
  isPrivate,
  isHost,
  selfId,
  onClose,
  onNotice,
}: Props) {
  const accent = useAccent();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ProfileRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [invited, setInvited] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (visible) return;
    setQuery('');
    setPeople([]);
  }, [visible]);

  // The search waits for the person to stop typing.
  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setPeople([]);
      setSearching(false);
      return;
    }
    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchPeople(text, selfId).then(rows => {
        if (!alive) return;
        setPeople(rows);
        setSearching(false);
      });
    }, 350);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, selfId]);

  const invite = useCallback(async (person: ProfileRow) => {
    setSending(person.id);
    try {
      await inviteToRoom(roomId, person.id);
      setInvited(current => ({ ...current, [person.id]: true }));
      onNotice(`${person.display_name} recibió tu invitación`);
    } catch (cause) {
      onNotice(cause instanceof Error ? cause.message : 'No pudimos invitar');
    } finally {
      setSending(null);
    }
  }, [roomId, onNotice]);

  const shareLink = useCallback(async () => {
    const outcome = await shareText(
      roomTitle,
      `${hostName} te invita a la sala "${roomTitle}" en Latino Live. Entra con el enlace de la app.`,
    );
    if (outcome === 'copied') onNotice('Enlace copiado. Pégalo en tu chat.');
    else if (outcome === 'shared') onNotice('Enlace compartido');
  }, [roomTitle, hostName, onNotice]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }} onPress={onClose} accessibilityLabel="Cerrar la invitación">
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: accent.raised, borderTopLeftRadius: 26, borderTopRightRadius: 26,
            borderWidth: 1, borderColor: accent.line, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26,
            maxHeight: '80%',
          }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: accent.hairline, alignSelf: 'center', marginBottom: 14 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon as={UserPlus} className="text-primary size-4" />
            <Text style={{ color: accent.text, fontSize: 17, fontWeight: '700', flex: 1 }}>Compartir la sala</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar la invitación"
              onPress={onClose}
              className="border-border size-7 items-center justify-center rounded-full border">
              <Icon as={X} className="text-foreground size-3.5" />
            </Pressable>
          </View>
          <Text style={{ color: '#B3A897', fontSize: 12, marginTop: 4 }}>
            Escribe el nombre de la persona y le llegará la invitación a la app.
          </Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: accent.wash, borderRadius: 14, borderWidth: 1, borderColor: accent.line, paddingHorizontal: 12 }}>
            <Icon as={Search} className="text-muted-foreground size-4" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Nombre de la persona"
              placeholderTextColor="#8A8073"
              autoCorrect={false}
              accessibilityLabel="Buscar a una persona para invitar"
              style={{ flex: 1, color: accent.text, fontSize: 14, paddingVertical: 11 }}
            />
            {searching ? <ActivityIndicator size="small" color={accent.main} /> : null}
          </View>

          {isPrivate && !isHost ? (
            <Text style={{ color: accent.main, fontSize: 11.5, marginTop: 8 }}>
              Esta sala es privada: solo su anfitrión puede invitar a alguien con el código.
            </Text>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4, marginTop: 10 }}>
            {people.map(person => (
              <View
                key={person.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14, backgroundColor: accent.wash }}>
                <Avatar alt={person.display_name} className="size-10">
                  {person.avatar_url ? <AvatarImage source={{ uri: person.avatar_url }} /> : null}
                  <AvatarFallback className="bg-muted">
                    <Text className="text-foreground text-sm font-semibold">{person.display_name.slice(0, 1).toUpperCase()}</Text>
                  </AvatarFallback>
                </Avatar>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: accent.text, fontSize: 14, fontWeight: '600' }}>{person.display_name}</Text>
                  {person.user_number ? (
                    <Text style={{ color: '#B3A897', fontSize: 11.5, marginTop: 1 }}>N.º {person.user_number}</Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Invitar a ${person.display_name}`}
                  disabled={sending === person.id || (invited[person.id] && !isHost) || (isPrivate && !isHost)}
                  onPress={() => void invite(person)}
                  style={{
                    height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: invited[person.id] ? 'rgba(111,216,194,0.18)' : 'rgba(255,194,75,0.18)',
                  }}>
                  {sending === person.id ? (
                    <ActivityIndicator size="small" color={accent.main} />
                  ) : (
                    <Text style={{ color: invited[person.id] ? '#3FE8C6' : accent.main, fontSize: 12.5, fontWeight: '700' }}>
                      {invited[person.id] ? 'Invitada' : 'Invitar'}
                    </Text>
                  )}
                </Pressable>
              </View>
            ))}
            {query.trim().length >= 2 && !searching && people.length === 0 ? (
              <Text style={{ color: '#B3A897', fontSize: 12, paddingVertical: 10 }}>Nadie con ese nombre tiene cuenta en la app.</Text>
            ) : null}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Compartir el enlace de la sala"
            onPress={() => void shareLink()}
            className="border-primary/40 bg-primary/12 mt-3 h-11 flex-row items-center justify-center gap-2 rounded-full border">
            <Icon as={Share2} className="text-primary size-4" />
            <Text className="text-primary text-[13px] font-semibold">Compartir el enlace</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
