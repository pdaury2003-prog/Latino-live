import { memo } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Camera, Dices, Gift, Sparkles, Trophy } from 'lucide-react-native';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { RoleBadge } from '@/components/role-badge';
import { SvipBubble } from '@/components/svip-pieces';
import type { BadgeKind } from '@/lib/badges';
import { BUBBLES } from '@/lib/bubbles';
import { roomPhotoUrl, type MessageRow } from '@/lib/rooms';
import { cn } from '@/lib/utils';

type Tone = (typeof BUBBLES)[number];

type Props = {
  message: MessageRow;
  /** El mensaje es de quien está mirando: su burbuja va a la derecha. */
  mine: boolean;
  /** La insignia de rol que lleva quien escribe, ya resuelta. */
  badge: BadgeKind | null;
  /** El color de burbuja que el anfitrión le dio a un moderador. */
  tone: Tone | null;
  /** Nivel SVIP que escribe en su propia placa; 0 para una burbuja normal. */
  svipLevel: number;
  /** El acento del modo, para la suerte de la sala. */
  accent: string;
  /** Lo ancho que puede ir una foto del chat, ya medido para este teléfono. */
  photoWidth: number;
  onPhoto: (path: string) => void;
};

const EMPTY_ACCENT = '#FFC24B';

/**
 * One line of the room chat.
 *
 * Cada mensaje se dibuja una vez y se queda quieto: un micrófono que se abre,
 * un aviso que aparece o una hoja que se cierra vuelven a dibujar la sala,
 * pero no los veinte mensajes que ya estaban en el chat.
 */
export const RoomChatRow = memo(function RoomChatRow({ message, mine, badge, tone, svipLevel, accent, photoWidth, onPhoto }: Props) {
  if (message.kind === 'welcome') {
    return (
      <View className="bg-muted/60 rounded-2xl rounded-tl-md px-3.5 py-3">
        <Text className="text-foreground text-[13px] leading-5">{message.body}</Text>
      </View>
    );
  }

  if (message.kind === 'announcement') {
    return (
      <View className="border-primary/30 bg-primary/10 rounded-2xl border px-3.5 py-2.5">
        <Text className="text-primary mb-0.5 text-[11px] font-semibold tracking-wide">ANUNCIO DEL ANFITRIÓN</Text>
        <Text className="text-foreground text-[13px] leading-5">{message.body}</Text>
      </View>
    );
  }

  if (message.kind === 'system') {
    // The podium's own news is worth a trophy and the room's colour; every
    // other system line stays quiet grey.
    if (message.author === 'Podio') {
      return (
        <View className="border-primary/35 bg-primary/10 flex-row items-center gap-2 rounded-2xl border px-3 py-2">
          <Icon as={Trophy} className="text-primary size-3.5" />
          <Text className="text-primary flex-1 text-[12px] font-semibold leading-4">{message.body}</Text>
        </View>
      );
    }
    return (
      <View className="flex-row items-center gap-1.5 px-1">
        <Icon as={Sparkles} className="text-muted-foreground size-3" />
        <Text className="text-muted-foreground flex-1 text-[11px]">{message.body}</Text>
      </View>
    );
  }

  if (message.kind === 'photo') {
    return (
      <View className={cn('max-w-[78%] gap-1.5', mine ? 'self-end' : 'self-start')}>
        <View className="flex-row items-center gap-1.5">
          <Icon as={Camera} className="text-muted-foreground size-3" />
          <Text className="text-muted-foreground text-[11px]">{mine ? 'Tú' : message.author}</Text>
          {!mine && badge ? <RoleBadge kind={badge} height={11} /> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Foto enviada por ${mine ? 'ti' : message.author} en el chat`}
          onPress={() => message.image_path && onPhoto(message.image_path)}
          className="overflow-hidden rounded-2xl border border-white/15 active:opacity-90">
          {message.image_path ? (
            <Image
              source={{ uri: roomPhotoUrl(message.image_path) }}
              resizeMode="cover"
              // La foto llega del teléfono a tamaño completo y aquí se dibuja
              // pequeña: Android la reduce antes de guardarla en memoria, así
              // no ocupa lo de una foto de cámara ni se ve borrosa.
              resizeMethod="resize"
              style={{ width: photoWidth, height: Math.round(photoWidth * 0.75) }}
            />
          ) : null}
        </Pressable>
        {message.body ? <Text className="text-foreground px-1 text-[12px] leading-4">{message.body}</Text> : null}
      </View>
    );
  }

  if (message.kind === 'gift') {
    return (
      <View className="border-primary/40 bg-primary/10 flex-row items-center gap-2 rounded-xl border px-3 py-2">
        <Icon as={Gift} className="text-primary size-4" />
        <Text className="text-foreground flex-1 text-[12px]">{message.body}</Text>
      </View>
    );
  }

  if (message.kind === 'luck') {
    // La suerte se lee distinta del habla: es un número que toda la sala vio.
    return (
      <View
        className="flex-row items-center gap-2 rounded-xl px-3 py-2"
        style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' }}>
        <Icon as={Dices} size={14} color={accent || EMPTY_ACCENT} />
        <Text className="flex-1 text-[12px]" style={{ color: '#F6F0E4' }}>{message.body}</Text>
      </View>
    );
  }

  // Imperial levels write on their own plaque instead of a plain bubble.
  const imperial = svipLevel > 0;
  return (
    <View className={cn('flex-row items-start gap-2', mine && 'flex-row-reverse')}>
      <Avatar alt={message.author} className="size-7">
        <AvatarFallback className={cn(mine ? 'bg-primary/25' : 'bg-muted')}>
          <Text className={cn('text-[11px] font-semibold', mine ? 'text-primary' : 'text-foreground')}>{message.author.slice(0, 1)}</Text>
        </AvatarFallback>
      </Avatar>
      <View
        className={cn('max-w-[78%]', imperial ? '' : 'rounded-2xl px-3 py-2', !tone && !imperial && (mine ? 'bg-primary rounded-tr-md' : 'bg-muted rounded-tl-md'))}
        style={imperial ? {
          backgroundColor: 'transparent',
        } : tone ? {
          backgroundColor: tone.fill,
          borderWidth: 1,
          borderColor: tone.border,
          borderTopRightRadius: mine ? 6 : 16,
          borderTopLeftRadius: mine ? 16 : 6,
        } : undefined}>
        {imperial ? (
          <SvipBubble level={svipLevel}>
            <View className="mb-0.5 flex-row items-center gap-1">
              <Text className="text-[11px] text-white/80">{mine ? 'Tú' : message.author}</Text>
              {badge ? <RoleBadge kind={badge} height={11} /> : null}
              {tone ? <Text className="text-[11px] font-bold text-white/90">MOD</Text> : null}
            </View>
            <Text className="text-[13px] leading-5 text-white/95" style={{ fontWeight: '500' }}>
              {message.body}
            </Text>
          </SvipBubble>
        ) : (
          <>
            {mine ? null : (
              <View className="mb-0.5 flex-row items-center gap-1">
                <Text className="text-muted-foreground text-[11px]">{message.author}</Text>
                {badge ? <RoleBadge kind={badge} height={11} /> : null}
                {tone ? <Text className="text-[11px] font-bold" style={{ color: tone.ink }}>MOD</Text> : null}
              </View>
            )}
            <Text className={cn('text-[13px] leading-5', tone ? '' : mine ? 'text-primary-foreground' : 'text-foreground')} style={tone ? { color: tone.ink, fontWeight: '500' } : undefined}>
              {message.body}
            </Text>
          </>
        )}
      </View>
    </View>
  );
});

/** El color de burbuja de un moderador, o null si escribe como todos. */
export function chatTone(color: string | null | undefined): Tone | null {
  if (!color) return null;
  return BUBBLES.find(item => item.key === color) ?? null;
}
