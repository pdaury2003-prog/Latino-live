import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { Gift, X } from 'lucide-react-native';
import { AvatarPhoto } from '@/components/avatar-photo';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { getSeatGiftSenders, type SeatGiftSender } from '@/lib/rooms';
import { timeAgo } from '@/lib/activity';
import { useAccent } from '@/lib/theme-accent';
import { SparklingDiamond } from '@/components/sparkling-diamond';

type Props = {
  visible: boolean;
  roomId: string | null;
  userId: string | null;
  name: string;
  avatar: string | null;
  onClose: () => void;
};

/**
 * What the seat's counter is made of: the people who sent gifts to that person
 * since they sat down, each with how many gifts and diamonds they added up to.
 */
export function SeatGiftSheet({ visible, roomId, userId, name, avatar, onClose }: Props) {
  const accent = useAccent();
  const [senders, setSenders] = useState<SeatGiftSender[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!roomId || !userId) { setSenders([]); return; }
    setLoading(true);
    try {
      setSenders(await getSeatGiftSenders(roomId, userId));
    } catch {
      setSenders([]);
    } finally {
      setLoading(false);
    }
  }, [roomId, userId]);

  useEffect(() => {
    if (!visible) return;
    setSenders([]);
    void load();
  }, [visible, load]);

  const diamonds = senders.reduce((sum, sender) => sum + sender.diamonds, 0);
  const gifts = senders.reduce((sum, sender) => sum + sender.gifts, 0);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        className="flex-1 justify-center bg-black/70 px-5"
        onPress={onClose}
        accessibilityLabel="Cerrar quién envió los regalos">
        <Pressable
          className="border-border bg-card overflow-hidden rounded-3xl border"
          onPress={() => undefined}
          accessibilityRole="none">
          <View className="flex-row items-center gap-3 px-4 pb-3 pt-4">
            <View className="size-11 overflow-hidden rounded-full border-2" style={{ borderColor: accent.main }}>
              <AvatarPhoto uri={avatar} name={name} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground text-[15px] font-semibold" numberOfLines={1}>{name}</Text>
              <Text className="text-muted-foreground text-[11px]">Regalos en este asiento</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
              onPress={onClose}
              hitSlop={8}
              className="border-border size-8 items-center justify-center rounded-full border active:bg-muted">
              <Icon as={X} className="text-foreground size-4" />
            </Pressable>
          </View>

          <View
            className="mx-4 mb-3 flex-row items-center gap-4 rounded-2xl px-3 py-2.5"
            style={{ backgroundColor: 'rgba(255,194,75,0.14)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.34)' }}>
            <View className="flex-row items-center gap-1.5">
              <SparklingDiamond size={18} animated={false} />
              <Text className="text-primary text-[16px] font-bold tabular-nums">{diamonds.toLocaleString('es')}</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <Icon as={Gift} className="text-muted-foreground size-3.5" />
              <Text className="text-muted-foreground text-[12px]">
                {gifts === 1 ? '1 regalo' : `${gifts} regalos`}
              </Text>
            </View>
          </View>

          {loading ? (
            <View className="items-center gap-2 pb-6 pt-2">
              <ActivityIndicator color={accent.main} />
              <Text className="text-muted-foreground text-[11px]">Buscando los regalos…</Text>
            </View>
          ) : senders.length === 0 ? (
            <Text className="text-muted-foreground px-4 pb-6 text-center text-[12px] leading-4">
              {name} todavía no ha recibido regalos desde que se sentó.
            </Text>
          ) : (
            <View className="pb-2">
              {senders.map((sender, index) => (
                <View
                  key={`${sender.sender_id ?? sender.sender_name}-${index}`}
                  className="flex-row items-center gap-2.5 px-4 py-2"
                  style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                  <View className="size-8 overflow-hidden rounded-full border" style={{ borderColor: 'rgba(255,194,75,0.4)' }}>
                    <AvatarPhoto uri={null} name={sender.sender_name} textClassName="text-[12px]" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-foreground text-[13px] font-semibold" numberOfLines={1}>{sender.sender_name}</Text>
                    <Text className="text-muted-foreground text-[11px]">
                      {sender.gifts === 1 ? '1 regalo' : `${sender.gifts} regalos`} · {timeAgo(sender.last_at)}
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1">
                    <Text className="text-primary text-[13px] font-bold tabular-nums">{sender.diamonds.toLocaleString('es')}</Text>
                    <SparklingDiamond size={13} animated={false} />
                  </View>
                </View>
              ))}
            </View>
          )}

          <Text className="text-muted-foreground px-4 pb-4 text-[11px] leading-4">
            Cuentan los regalos que esta persona recibió desde que se sentó. Al levantarse o salir de la sala, el contador vuelve a cero.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
