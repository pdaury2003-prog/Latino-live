import { Pressable, View } from 'react-native';
import { Swords, Trophy, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { usePkClock, type PkBattle, type TeamPkBattle } from '@/lib/pk';
import { cn } from '@/lib/utils';

type Props = {
  battle: PkBattle;
  roomId: string;
  isHost: boolean;
  onClose?: () => void;
};

/**
 * The battle strip at the top of the room: both sides, the diamonds each one
 * has received, who is winning and how long is left.
 */
export function PkBattleBanner({ battle, roomId, isHost, onClose }: Props) {
  const left = usePkClock(battle);
  const live = battle.status === 'live' && left > 0;
  const total = battle.score_a + battle.score_b;
  const share = total > 0 ? battle.score_a / total : 0.5;
  const mineIsA = battle.room_a === roomId;
  const myScore = mineIsA ? battle.score_a : battle.score_b;
  const rivalScore = mineIsA ? battle.score_b : battle.score_a;
  const myTitle = mineIsA ? battle.title_a : battle.title_b;
  const rivalTitle = mineIsA ? battle.title_b : battle.title_a;
  const draw = battle.winner === null;
  const won = battle.winner === roomId;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;

  return (
    <View
      className="border-primary/35 bg-card mx-3 mt-2 overflow-hidden rounded-2xl border"
      // The seats below draw an overflowing SVIP frame: the strip must sit on
      // top of it, and a positioned box is what a browser honours for zIndex.
      style={{ position: 'relative', zIndex: 10, elevation: 10 }}>
      <View className="flex-row items-center justify-between px-3 pt-1.5">
        <View className="flex-row items-center gap-1.5">
          <Icon as={Swords} className="text-primary size-3" />
          <Text className="text-primary text-[11px] font-bold tracking-[0.08em]">{live ? 'PK' : 'RESULTADO'}</Text>
          <Text className="text-muted-foreground text-[11px]">
            {live ? `${minutes}:${seconds < 10 ? '0' : ''}${seconds}` : 'Resultado'}
          </Text>
        </View>
        {isHost && !live && onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Cerrar el resultado de la batalla" onPress={onClose} hitSlop={8} className="active:opacity-70">
            <Icon as={X} className="text-muted-foreground size-3.5" />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-0.5 flex-row items-center gap-2 px-3 pb-1">
        <View className="flex-1 flex-row items-baseline gap-1.5">
          <Text className="text-primary text-[14px] font-bold">{myScore.toLocaleString('es')}</Text>
          <Text className="text-muted-foreground flex-1 text-[11px]" numberOfLines={1}>{myTitle}</Text>
        </View>
        <Text className="text-muted-foreground text-[11px] font-bold">VS</Text>
        <View className="flex-1 flex-row items-baseline justify-end gap-1.5">
          <Text className="text-muted-foreground flex-1 text-right text-[11px]" numberOfLines={1}>{rivalTitle}</Text>
          <Text className="text-foreground text-[14px] font-bold">{rivalScore.toLocaleString('es')}</Text>
        </View>
      </View>

      <View className="mx-3 h-2 flex-row overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <View style={{ width: `${share * 100}%`, backgroundColor: '#FF3D7F' }} />
        <View style={{ flex: 1, backgroundColor: '#3B82F6' }} />
      </View>

      {!live ? (
        <View className="mt-1 flex-row items-center gap-1.5 px-3 pb-1.5">
          <Icon as={Trophy} className={won ? 'text-primary size-3.5' : 'text-muted-foreground size-3.5'} />
          <Text className={won ? 'text-primary text-[12px] font-bold' : 'text-muted-foreground text-[12px] font-semibold'}>
            {draw ? 'Empate' : won ? '¡Ganó tu sala!' : `Ganó ${rivalTitle}`}
          </Text>
        </View>
      ) : (
        <Text className="text-muted-foreground mt-1 px-3 pb-1.5 text-[11px]">
          Cada regalo suma sus diamantes a su sala.
        </Text>
      )}
    </View>
  );
}

/**
 * The tiny battle chip in the room's status line: the score and the clock,
 * small enough that it never touches the seats' frames. Tapping it opens the
 * whole card.
 */
export function PkPill({ battle, roomId, onPress }: { battle: PkBattle; roomId: string; onPress: () => void }) {
  const left = usePkClock(battle);
  const live = battle.status === 'live' && left > 0;
  const mineIsA = battle.room_a === roomId;
  const myScore = mineIsA ? battle.score_a : battle.score_b;
  const rivalScore = mineIsA ? battle.score_b : battle.score_a;
  const won = battle.winner === roomId;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Batalla PK, ${myScore} contra ${rivalScore}. Ver el marcador`}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        'mx-2 h-6 flex-1 flex-row items-center justify-center gap-1 rounded-full border px-2 active:opacity-80',
        live ? 'border-primary/45 bg-primary/12' : 'border-border bg-card',
      )}>
      <Icon as={live ? Swords : Trophy} className="text-primary size-3" />
      <Text className="text-primary text-[11px] font-bold tabular-nums">
        {myScore.toLocaleString('es')}
      </Text>
      <Text className="text-muted-foreground text-[11px]">vs</Text>
      <Text className="text-foreground text-[11px] font-semibold tabular-nums">{rivalScore.toLocaleString('es')}</Text>
      <Text className="text-muted-foreground text-[11px]">
        {live ? `· ${minutes}:${seconds < 10 ? '0' : ''}${seconds}` : won ? '· ganaste' : '· fin'}
      </Text>
    </Pressable>
  );
}

const RED = '#FF4D5E';
const BLUE = '#3B82F6';

function teamLabel(side: 'red' | 'blue') {
  return side === 'red' ? 'Equipo Rojo' : 'Equipo Azul';
}

/**
 * The team battle inside the room: the seated people split into Equipo Rojo
 * and Equipo Azul, each gift pushing its sender's side. It is the same card as
 * the battle between rooms, only the two sides are teams instead of halls.
 */
export function TeamPkBanner({
  battle,
  isHost,
  onClose,
}: {
  battle: TeamPkBattle;
  isHost: boolean;
  onClose?: () => void;
}) {
  const left = usePkClock(battle);
  const live = battle.status === 'live' && left > 0;
  const total = battle.score_red + battle.score_blue;
  const share = total > 0 ? battle.score_red / total : 0.5;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  const draw = battle.winner === null;
  const redSeats = `Asientos 1–${battle.split_seat}`;
  const blueSeats = `Asientos ${battle.split_seat + 1}–${battle.max_seats}`;

  return (
    <View
      className="border-primary/35 bg-card mx-3 mt-2 overflow-hidden rounded-2xl border"
      style={{ position: 'relative', zIndex: 10, elevation: 10 }}>
      <View className="flex-row items-center justify-between px-3 pt-1.5">
        <View className="flex-row items-center gap-1.5">
          <Icon as={Swords} className="text-primary size-3" />
          <Text className="text-primary text-[11px] font-bold tracking-[0.08em]">
            {live ? 'PK DE EQUIPOS' : 'RESULTADO'}
          </Text>
          <Text className="text-muted-foreground text-[11px]">
            {live ? `${minutes}:${seconds < 10 ? '0' : ''}${seconds}` : 'Resultado'}
          </Text>
        </View>
        {isHost && !live && onClose ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar el resultado del PK"
            onPress={onClose}
            hitSlop={8}
            className="active:opacity-70">
            <Icon as={X} className="text-muted-foreground size-3.5" />
          </Pressable>
        ) : null}
      </View>

      <View className="mt-1 gap-1 px-3 pb-1">
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: RED }} />
          <Text className={cn('text-[12px] font-bold', battle.winner === 'red' && 'text-primary')}>Equipo Rojo</Text>
          <Text className="text-muted-foreground flex-1 text-[11px]" numberOfLines={1}>{redSeats}</Text>
          <Text className="text-[14px] font-bold tabular-nums" style={{ color: RED }}>
            {battle.score_red.toLocaleString('es')}
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: BLUE }} />
          <Text className={cn('text-[12px] font-bold', battle.winner === 'blue' && 'text-primary')}>Equipo Azul</Text>
          <Text className="text-muted-foreground flex-1 text-[11px]" numberOfLines={1}>{blueSeats}</Text>
          <Text className="text-[14px] font-bold tabular-nums" style={{ color: BLUE }}>
            {battle.score_blue.toLocaleString('es')}
          </Text>
        </View>
      </View>

      <View className="mx-3 h-2 flex-row overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
        <View style={{ width: `${share * 100}%`, backgroundColor: RED }} />
        <View style={{ flex: 1, backgroundColor: BLUE }} />
      </View>

      {!live ? (
        <View className="mt-1 flex-row items-center gap-1.5 px-3 pb-1.5">
          <Icon as={Trophy} className={draw ? 'text-muted-foreground size-3.5' : 'text-primary size-3.5'} />
          <Text className={draw ? 'text-muted-foreground text-[12px] font-semibold' : 'text-primary text-[12px] font-bold'}>
            {draw ? 'Empate' : `Ganó el ${teamLabel(battle.winner as 'red' | 'blue')}`}
          </Text>
        </View>
      ) : (
        <Text className="text-muted-foreground mt-1 px-3 pb-1.5 text-[11px]">
          Cada regalo de alguien sentado suma a su equipo.
        </Text>
      )}
    </View>
  );
}

/** The team battle in the room's status line, small enough to sit by the seats. */
export function TeamPkPill({ battle, onPress }: { battle: TeamPkBattle; onPress: () => void }) {
  const left = usePkClock(battle);
  const live = battle.status === 'live' && left > 0;
  const minutes = Math.floor(left / 60);
  const seconds = left % 60;
  const red = battle.score_red.toLocaleString('es');
  const blue = battle.score_blue.toLocaleString('es');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`PK de equipos, rojo ${red} contra azul ${blue}. Ver el marcador`}
      onPress={onPress}
      hitSlop={6}
      className={cn(
        'mx-2 h-6 flex-1 flex-row items-center justify-center gap-1 rounded-full border px-2 active:opacity-80',
        live ? 'border-primary/45 bg-primary/12' : 'border-border bg-card',
      )}>
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: RED }} />
      <Text className="text-[11px] font-bold tabular-nums" style={{ color: RED }}>{red}</Text>
      <Text className="text-muted-foreground text-[11px]">vs</Text>
      <Text className="text-[11px] font-bold tabular-nums" style={{ color: BLUE }}>{blue}</Text>
      <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: BLUE }} />
      <Text className="text-muted-foreground text-[11px]">
        {live ? `· ${minutes}:${seconds < 10 ? '0' : ''}${seconds}` : battle.winner ? '· fin' : '· empate'}
      </Text>
    </Pressable>
  );
}
