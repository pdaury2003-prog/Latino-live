import { Pressable, View } from 'react-native';
import { ChevronRight, Trophy } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { RankFrame } from '@/components/rank-frame';
import { SparklingDiamond } from '@/components/sparkling-diamond';
import type { UserPodium } from '@/lib/pk';
import { roomPhotoUrl } from '@/lib/rooms';
import { cn } from '@/lib/utils';

type Props = {
  podium: UserPodium | null;
  avatarUrl?: string | null;
  onOpenRoom: (roomId: string) => void;
};

const ACCENT: Record<number, string> = {
  1: '#F2C75C',
  2: '#8FB8FF',
  3: '#C88BFF',
};

/**
 * The TOP frame the room wears on the ranking, carried onto its host's profile
 * card. It only appears on the three first places of the day.
 */
export function ProfilePodium({ podium, avatarUrl, onOpenRoom }: Props) {
  if (!podium || podium.place > 3) return null;
  const accent = ACCENT[podium.place] ?? ACCENT[1];
  // TOP 1 is a wide plaque and TOP 2/3 are taller: the row keeps one height so
  // the card never jumps while the frames flicker.
  const frameWidth = podium.place === 1 ? 148 : 104;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Tu sala ${podium.room_title} va en el puesto ${podium.place} del podio de hoy. Abrir la sala`}
      onPress={() => onOpenRoom(podium.room_id)}
      className="border-border mt-3 flex-row items-center gap-3 overflow-hidden rounded-2xl border px-2.5 py-2 active:opacity-90"
      style={{ borderColor: `${accent}59`, backgroundColor: `${accent}12` }}>
      <View style={{ height: 100, justifyContent: 'center' }}>
        <RankFrame
          rank={podium.place}
          width={frameWidth}
          uri={podium.photo_path ? roomPhotoUrl(podium.photo_path) : avatarUrl ?? null}
          name={podium.room_title}
        />
      </View>
      <View className="flex-1">
        <View className="flex-row items-center gap-1">
          <Icon as={Trophy} size={11} color={accent} />
          <Text className="text-[11px] font-semibold tracking-[0.16em]" style={{ color: accent }}>
            PODIO DE HOY
          </Text>
        </View>
        <Text className="text-foreground mt-0.5 text-[15px] font-semibold" numberOfLines={1}>
          TOP {podium.place} · {podium.room_title}
        </Text>
        <View className="mt-1 flex-row items-center gap-1.5">
          <SparklingDiamond size={13} animated={false} />
          <Text className="text-foreground text-[12px] font-semibold tabular-nums">
            {Number(podium.gold).toLocaleString('es-US')}
          </Text>
          <Text className="text-muted-foreground text-[11px]">
            de {podium.total_rooms} {podium.total_rooms === 1 ? 'sala' : 'salas'}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center gap-0.5">
          <Text className={cn('text-[11px] font-medium')} style={{ color: accent }}>
            Ver mi sala
          </Text>
          <Icon as={ChevronRight} size={12} color={accent} />
        </View>
      </View>
    </Pressable>
  );
}
