import { Pressable, View } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { RankFrame } from '@/components/rank-frame';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import type { RankedRoom } from '@/lib/pk';
import { roomPhotoUrl } from '@/lib/rooms';
import { cn } from '@/lib/utils';

type Props = {
  entries: RankedRoom[];
  /** The room the person is in, marked on the podium. */
  roomId?: string;
  /** A photo to fall back on when the room has none of its own. */
  avatars?: Record<string, string | null>;
  onOpenRoom?: (roomId: string) => void;
};

function count(value: number) {
  try {
    return new Intl.NumberFormat('es-US').format(value);
  } catch {
    return String(value);
  }
}

/**
 * Today's podium, with the TOP 1, 2 and 3 frames: the winner in the middle and
 * taller, so the room sees at a glance where it stands.
 */
export function RankPodium({ entries, roomId, avatars = {}, onOpenRoom }: Props) {
  const top = entries.slice(0, 3);
  if (top.length === 0) {
    return (
      <Text className="text-muted-foreground text-center text-[12px]">
        Todavía nadie ha recibido diamantes hoy. Sé la primera sala en el podio.
      </Text>
    );
  }
  const order = [1, 0, 2];
  return (
    <View className="flex-row items-end justify-center gap-1">
      {order.map(position => {
        const item = top[position];
        if (!item) return <View key={`gap-${position}`} className="w-28" />;
        const first = position === 0;
        const mine = item.room_id === roomId;
        return (
          <Pressable
            key={item.room_id}
            accessibilityRole="button"
            accessibilityLabel={`Puesto ${position + 1}, ${item.title}, ${count(Number(item.gold))} diamantes`}
            onPress={() => onOpenRoom?.(item.room_id)}
            disabled={!onOpenRoom || mine}
            className={cn('items-center rounded-2xl px-0.5 pb-1.5', first ? 'w-40' : 'w-28 pt-5', mine && 'opacity-100')}>
            <RankFrame
              rank={position + 1}
              width={first ? 160 : 104}
              // The room's own photo is what the host chose to show; the
              // host's face is only used while the room has no photo yet.
              uri={item.photo_path ? roomPhotoUrl(item.photo_path) : avatars[item.room_id] ?? null}
              name={item.title}
            />
            <Text
              className={cn('mt-0.5 w-full text-center font-semibold', first ? 'text-[13px]' : 'text-[11px]', mine ? 'text-primary' : 'text-foreground')}
              numberOfLines={1}>
              {item.title}
            </Text>
            <View className="mt-0.5 flex-row items-center gap-1">
              <SparklingDiamond size={14} animated={false} />
              <Text className="text-foreground text-[11px] font-semibold">{count(Number(item.gold))}</Text>
              {Number(item.pk_wins) > 0 ? (
                <View className="bg-primary/15 flex-row items-center gap-0.5 rounded-full px-1.5">
                  <Icon as={Trophy} className="text-primary size-2.5" />
                  <Text className="text-primary text-[11px] font-semibold">{Number(item.pk_wins)}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
