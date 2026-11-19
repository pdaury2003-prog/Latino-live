import { memo, useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet, View } from 'react-native';
import Reanimated, { useAnimatedStyle } from 'react-native-reanimated';
import { Camera, Crown, Lock, Mic, MicOff, Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AvatarPhoto } from '@/components/avatar-photo';
import { SvipAvatarFrame } from '@/components/svip-frame';
import { FramedAvatar } from '@/components/framed-avatar';
import { SvipMicWave } from '@/components/svip-pieces';
import { SeatRing } from '@/components/seat-ring';
import { useRolePulse } from '@/lib/role-motion';
import { LiveVideo } from '@/components/live-video';
import type { VideoSource } from '@/lib/live-audio.types';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { SeatRow } from '@/lib/rooms';

const SEAT_PORTRAIT = require('@/assets/dragon-seat-360.webp');
/** La misma gema ilustrada de la billetera, para que la moneda sea una sola. */
const GEM = require('@/assets/diamond-gem-160.webp');

/**
 * El diamante del contador, vivo: la gema ilustrada de la casa, que late con
 * el mismo pulso que las insignias, así que veinte asientos comparten un solo
 * bucle y el ahorro de batería lo detiene.
 */
const DiamondMark = memo(function DiamondMark({ size }: { size: number }) {
  const pulse = useRolePulse(true);
  const style = useAnimatedStyle(() => ({
    opacity: 0.78 + 0.22 * pulse.value,
    transform: [{ scale: 0.93 + 0.16 * pulse.value }, { rotate: `${-8 + 16 * pulse.value}deg` }],
  }));
  // La gema tiene detalle: se dibuja un poco más grande que el glifo que
  // sustituye, o a 8 px se convierte en una mancha azul.
  const drawn = Math.round(size * 1.3);
  return (
    <Reanimated.View style={style}>
      <Image
        source={GEM}
        resizeMode="contain"
        style={{ width: drawn, height: drawn }}
        accessibilityIgnoresInvertColors
      />
    </Reanimated.View>
  );
});

/** A seat's diamonds stay short: 1200 reads 1.2k, a million reads 1M. */
export function compactDiamonds(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 === 0 ? 0 : 1)}M`;
  // Six digits and up read better without the decimal: 500.99k is just 501k.
  if (value >= 100_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 === 0 ? 0 : 1)}k`;
  return String(Math.max(0, Math.round(value)));
}

/**
 * One seat of the hall, at any size: the same face, SVIP frame, crown,
 * microphone badge and number in the plain grid and inside a room design.
 *
 * It is a plain component so a design can place it at a percentage of a square
 * without a second copy of this drawing that could drift from the first.
 */
function RoomSeatView({
  no,
  seat,
  size,
  mine,
  locked,
  host,
  svip,
  showFrame,
  showMic,
  frame,
  goldPlace,
  numberInside,
  giftDiamonds,
  giftCount,
  onGiftPress,
  square,
  video,
  mirrorVideo,
  captionWidth,
  onPress,
}: {
  no: number;
  seat: SeatRow | undefined;
  size: number;
  mine: boolean;
  locked: boolean;
  host: boolean;
  svip: number;
  showFrame: boolean;
  showMic: boolean;
  frame: string | null;
  /** The design marks this place as the host's: drawn with a gold edge. */
  goldPlace?: boolean;
  /**
   * A design packs its places closer than a row of the plain grid, so the
   * number sits inside the circle instead of hanging under it, where it would
   * land on the seat below.
   */
  numberInside?: boolean;
  /** Diamonds this person has been given since they sat down; 0 hides the chip. */
  giftDiamonds?: number;
  /** How many gifts those diamonds came from, for the spoken label. */
  giftCount?: number;
  /** Tapping the counter names who sent those gifts; without it, it is inert. */
  onGiftPress?: () => void;
  /**
   * A camera place: the seat is drawn as a rounded square, the shape a live
   * picture fills, instead of the portrait's circle.
   */
  square?: boolean;
  /** This person's live camera, when they have it on. */
  video?: VideoSource | null;
  /**
   * Whether the picture is shown mirrored. The front lens mirrors like a
   * mirror so a person recognises themselves; the back one never does.
   */
  mirrorVideo?: boolean;
  /**
   * How wide the name under the seat may run. A packed design gives it less
   * room than a row of the plain grid, so it never covers a neighbour.
   */
  captionWidth?: number;
  onPress: () => void;
}) {
  const radius = square ? Math.round(size * 0.2) : undefined;
  const diamonds = Math.max(0, Math.round(giftDiamonds ?? 0));
  // The line under the seat is as wide as the space its place leaves.
  const caption = captionWidth;
  const pulse = useRef(new Animated.Value(1)).current;
  const shown = useRef(diamonds);
  useEffect(() => {
    // A new gift makes the counter pop once, so the room sees it land.
    if (diamonds > shown.current) {
      pulse.setValue(0.72);
      Animated.spring(pulse, { toValue: 1, friction: 4, tension: 130, useNativeDriver: true }).start();
    }
    shown.current = diamonds;
  }, [diamonds, pulse]);
  const label = seat
    ? `${seat.display_name}, asiento ${no}${seat.muted ? ', silenciado' : seat.speaking ? ', hablando' : ''}${mine ? ', tu asiento' : ''}${diamonds > 0 ? `, ${diamonds} diamantes recibidos desde que se sentó, en ${giftCount ?? 0} regalos` : ''}`
    : locked
      ? `Asiento ${no} cerrado con candado por el anfitrión`
      : `Asiento libre número ${no}, toca para sentarte`;
  return (
    <View
      style={{
        width: size,
        height: numberInside ? size + Math.round(size * 0.22) : size,
        overflow: 'visible',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: mine }}
      onPress={onPress}
      className="items-center justify-center active:opacity-75"
      style={{ width: size, height: numberInside ? size + Math.round(size * 0.22) : size, overflow: 'visible' }}>
      {seat ? (
        <View className={cn('size-full items-center justify-center', seat.muted && 'opacity-50')}>
          {video ? (
            /*
             * A live camera fills its square edge to edge. The name and the
             * badges stay on top, so a face is never mistaken for a stranger.
             */
            <View
              style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden', backgroundColor: '#141A26' }}>
              <LiveVideo source={video} mirror={mirrorVideo ?? mine} />
            </View>
          ) : square ? (
            <View
              style={{ width: size, height: size, borderRadius: radius, overflow: 'hidden' }}>
              <AvatarPhoto
                uri={seat.avatar_url}
                name={seat.display_name}
                fallback={SEAT_PORTRAIT}
                radius={radius}
                className={cn(mine && 'ring-primary ring-2', seat.speaking && !seat.muted && 'ring-primary ring-2')}
              />
            </View>
          ) : svip > 0 && showFrame ? (
            <SvipMicWave level={svip} speaking={Boolean(seat.speaking) && !seat.muted && showMic}>
              <SvipAvatarFrame level={svip} size={size} seat animated={false} medal={false}>
                <AvatarPhoto
                  uri={seat.avatar_url}
                  name={seat.display_name}
                  fallback={SEAT_PORTRAIT}
                  className={cn(mine && 'ring-primary ring-2', seat.speaking && !seat.muted && 'ring-primary ring-2')}
                />
              </SvipAvatarFrame>
            </SvipMicWave>
          ) : (
            <FramedAvatar frame={frame} size={size} seat>
              <AvatarPhoto
                uri={seat.avatar_url}
                name={seat.display_name}
                fallback={SEAT_PORTRAIT}
                className={cn(mine && 'ring-primary ring-2', seat.speaking && !seat.muted && 'ring-primary ring-2')}
              />
            </FramedAvatar>
          )}
          {/* The crown follows the host wherever they sit, not the first chair. */}
          {host ? (
            <View className="bg-primary absolute -top-1 items-center justify-center rounded-full px-1.5">
              <Icon as={Crown} className="text-primary-foreground size-3" />
            </View>
          ) : null}
          <View
            className={cn(
              'border-background absolute bottom-0 right-0 size-4 items-center justify-center rounded-full border-2',
              seat.muted ? 'bg-destructive' : seat.speaking ? 'bg-primary' : 'bg-success',
            )}>
            <Icon as={seat.muted ? MicOff : Mic} className={cn('size-2.5', seat.muted ? 'text-white' : 'text-success-foreground')} />
          </View>
          {video ? (
            <View className="absolute left-0 top-0 size-4 items-center justify-center rounded-full border-2 border-black/50 bg-black/60">
              <Icon as={Camera} className="size-2.5 text-white" />
            </View>
          ) : null}
        </View>
      ) : locked ? (
        <SeatRing size={size} locked square={square}>
          <LinearGradient
            colors={['#2A2D35', '#171A21']}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 0.8, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={StyleSheet.absoluteFill} className="items-center justify-center">
            <Icon as={Lock} size={Math.max(20, Math.round(size * 0.32))} color="#D7DBE3" />
          </View>
        </SeatRing>
      ) : (
        <SeatRing size={size} bare goldPlace={goldPlace} square={square}>
          {/* A free seat wears the house's dragon portrait; it is kept dark so
              an empty place never pulls the eye, and a plus says it can be
              taken. */}
          <Image
            source={SEAT_PORTRAIT}
            resizeMode="contain"
            style={{ width: size, height: size }}
            accessibilityIgnoresInvertColors
          />
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              backgroundColor: 'rgba(4,7,14,0.62)',
            }}
          />
          <View
            className="items-center justify-center"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              // A packed design keeps its number inside the circle, so the plus
              // moves up to leave it the room right under it.
              paddingBottom: numberInside ? Math.round(size * 0.24) : 0,
            }}>
            <View
              style={{
                // The plus stays small enough to leave the seat's number its
                // own corner when a design packs the places together.
                width: Math.round(size * 0.34),
                height: Math.round(size * 0.34),
                borderRadius: 999,
                borderWidth: 1.5,
                borderColor: 'rgba(243,213,140,0.75)',
                backgroundColor: 'rgba(10,14,24,0.55)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Icon as={Plus} size={Math.round(size * 0.21)} color="#F3D58C" />
            </View>
          </View>
        </SeatRing>
      )}
      {/* The seat's own number: under its circle, like a hall, or right under
          it, tucked in, when a design packs the places closer. */}
      {numberInside ? (
        <Text
          allowFontScaling={false}
          pointerEvents="none"
          className="font-bold text-white/85 tabular-nums"
          style={{
            position: 'absolute',
            bottom: 0,
            fontSize: Math.max(9, Math.round(size * 0.17)),
            lineHeight: Math.max(11, Math.round(size * 0.21)),
            textShadowColor: 'rgba(0,0,0,0.9)',
            textShadowRadius: 2,
            opacity: seat ? 0 : 1,
          }}>
          {no}
        </Text>
      ) : (
        <Text
          className="text-white/60 mt-0.5 text-[11px] font-semibold tabular-nums"
          style={{ opacity: seat ? 0 : 1 }}>
          {no}
        </Text>
      )}
    </Pressable>

    {/*
     * Under the seat: who sits there and what the room has given them. It
     * replaces the seat's number once somebody sits down, and the counter is
     * its own button, so tapping it names the people who sent the diamonds.
     */}
    {seat ? (
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: numberInside ? size + Math.round(size * 0.03) : size + 2,
          width: caption ?? Math.round(size * 1.7),
          left: Math.round((size - (caption ?? Math.round(size * 1.7))) / 2),
          alignItems: 'center',
          transform: [{ scale: pulse }],
        }}>
        {/* El nombre solo: la insignia del rol ya se ve en su perfil y en el
            chat, y en el asiento competía con el nombre y el contador. */}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          className="shrink font-semibold text-white"
          style={{
            fontSize: Math.max(8, Math.round(size * 0.155)),
            lineHeight: Math.max(10, Math.round(size * 0.19)),
            textShadowColor: 'rgba(0,0,0,0.95)',
            textShadowRadius: 2,
          }}>
          {seat.display_name}
        </Text>

        {/* El contador, en su propia línea bajo el nombre: se lee de un golpe
            y ya no empuja el nombre fuera de su sitio. */}
        {diamonds > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Ver quién envió los ${diamonds} diamantes a ${seat.display_name}`}
            onPress={onGiftPress}
            disabled={!onGiftPress}
            hitSlop={6}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 1,
              marginTop: 1,
              // Solo la gema y la cifra: sin pastilla, sin borde y sin fondo,
              // el contador se lee como parte del asiento y no como un botón.
            }}>
            <DiamondMark size={Math.max(7, Math.round(size * 0.13))} />
            <Text
              allowFontScaling={false}
              className="font-bold tabular-nums"
              style={{
                color: '#EEF6FF',
                fontSize: Math.max(7, Math.round(size * 0.14)),
                // La sombra sostiene la cifra sobre cualquier foto del asiento.
                textShadowColor: 'rgba(0,0,0,0.9)',
                textShadowRadius: 2,
              }}>
              {compactDiamonds(diamonds)}
            </Text>
          </Pressable>
        ) : null}
      </Animated.View>
    ) : null}
    </View>
  );
}

/**
 * A seat is redrawn only when something of its own changes. The room updates
 * many times a second while people talk and chat; without this, every keystroke
 * redrew all twenty faces and their frames.
 */
export const RoomSeat = memo(RoomSeatView);
