import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Mic, MicOff } from 'lucide-react-native';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LevelChip } from '@/components/level-badge';
import { listProfiles, type ProfileRow, type SeatRow } from '@/lib/rooms';
import { useAccent } from '@/lib/theme-accent';

export type PersonInRoom = {
  id: string;
  name: string;
  avatar: string | null;
  seatNo: number | null;
  muted: boolean;
  speaking: boolean;
};

type Props = {
  visible: boolean;
  /** Seat holders, who always have a name and photo already known. */
  seats: SeatRow[];
  /** Everyone present in the live channel, seated or listening. */
  memberIds: string[];
  selfId: string | undefined;
  onClose: () => void;
  onOpenPerson: (person: PersonInRoom) => void;
};

/**
 * Everyone in the room: who is on a seat and who is only listening. Tapping a
 * person opens their card.
 */
export function RoomPeopleSheet({ visible, seats, memberIds, selfId, onClose, onOpenPerson }: Props) {
  const accent = useAccent();
  const [profiles, setProfiles] = useState<Record<string, ProfileRow>>({});
  const [loading, setLoading] = useState(false);

  const seatedIds = seats.map(seat => seat.user_id);
  // Presence outlives a closed app for a few seconds, and an account that was
  // deleted leaves nothing behind: without a profile there is no person to show.
  const listeners = memberIds.filter(id => !seatedIds.includes(id) && Boolean(profiles[id]));

  const load = useCallback(async () => {
    const candidates = [...new Set([...seats.map(seat => seat.user_id), ...memberIds])]
      .filter(id => !profiles[id]);
    const missing = candidates;
    if (missing.length === 0) return;
    setLoading(true);
    try {
      const rows = await listProfiles(missing);
      setProfiles(current => {
        const next = { ...current };
        rows.forEach(row => { next[row.id] = row; });
        return next;
      });
    } catch {
      // A profile that cannot be read is shown with its initial letter.
    } finally {
      setLoading(false);
    }
  }, [seats, memberIds, profiles]);

  useEffect(() => {
    if (!visible) return;
    void load();
  }, [visible, load]);

  const people: PersonInRoom[] = [
    ...seats.map(seat => ({
      id: seat.user_id,
      name: seat.display_name,
      avatar: seat.avatar_url ?? profiles[seat.user_id]?.avatar_url ?? null,
      seatNo: seat.seat_no,
      muted: seat.muted,
      speaking: seat.speaking,
    })),
    ...listeners.map(id => ({
      id,
      name: profiles[id]?.display_name ?? 'Miembro',
      avatar: profiles[id]?.avatar_url ?? null,
      seatNo: null,
      muted: false,
      speaking: false,
    })),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }} onPress={onClose} accessibilityLabel="Cerrar la lista">
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: accent.raised, borderTopLeftRadius: 26, borderTopRightRadius: 26,
            borderWidth: 1, borderColor: accent.line, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 26,
            maxHeight: '76%',
          }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: accent.hairline, alignSelf: 'center', marginBottom: 14 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ color: accent.text, fontSize: 17, fontWeight: '700', flex: 1 }}>
              En la sala
            </Text>
            <View style={{ paddingHorizontal: 9, height: 24, borderRadius: 12, justifyContent: 'center', backgroundColor: 'rgba(255,194,75,0.16)' }}>
              <Text style={{ color: accent.main, fontSize: 12, fontWeight: '700' }}>{people.length}</Text>
            </View>
          </View>
          <Text style={{ color: '#B3A897', fontSize: 12, marginBottom: 12 }}>
            {seats.length} en asientos · {listeners.length} escuchando
          </Text>

          {loading && people.length === 0 ? <ActivityIndicator color={accent.main} style={{ marginVertical: 20 }} /> : null}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 4 }}>
            {people.map(person => {
              const isSelf = person.id === selfId;
              return (
                <Pressable
                  key={person.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Ver a ${person.name}${person.seatNo ? `, asiento ${person.seatNo}` : ', escuchando'}`}
                  onPress={() => onOpenPerson(person)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 14,
                    backgroundColor: person.seatNo ? accent.wash : 'transparent',
                    borderWidth: person.seatNo ? 1 : 0,
                    borderColor: accent.line,
                  }}>
                  <Avatar alt={person.name} className="size-10">
                    {person.avatar ? <AvatarImage source={{ uri: person.avatar }} /> : null}
                    <AvatarFallback className="bg-muted">
                      <Text className="text-foreground text-sm font-semibold">{person.name.slice(0, 1).toUpperCase()}</Text>
                    </AvatarFallback>
                  </Avatar>

                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text numberOfLines={1} style={{ color: accent.text, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>
                        {person.name}
                      </Text>
                      {isSelf ? (
                        <View style={{ paddingHorizontal: 6, height: 17, borderRadius: 9, justifyContent: 'center', backgroundColor: accent.wash }}>
                          <Text style={{ color: accent.main, fontSize: 11, fontWeight: '700' }}>Tú</Text>
                        </View>
                      ) : null}
                      {profiles[person.id]?.level ? <LevelChip level={profiles[person.id].level} size={15} /> : null}
                    </View>
                    <Text style={{ color: accent.muted, fontSize: 11.5, marginTop: 1 }}>
                      {person.seatNo ? `Asiento ${person.seatNo}` : 'Escuchando'}
                      {person.speaking ? ' · hablando' : ''}
                    </Text>
                  </View>
                  {person.seatNo ? (
                    <View style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: person.muted ? 'rgba(255,255,255,0.06)' : 'rgba(111,216,194,0.16)' }}>
                      {person.muted
                        ? <MicOff color="#8A8073" size={12} />
                        : <Mic color="#3FE8C6" size={12} />}
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
