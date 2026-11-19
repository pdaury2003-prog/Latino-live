import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Trophy, X } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

type Props = {
  /** What the room just earned, as the database wrote it. */
  message: string | null;
  onOpenPodium: () => void;
  onDismiss: () => void;
};

/**
 * The room's own news, big enough to be seen: when the room enters the day's
 * podium the card drops in from the top, stays a few seconds and leaves. The
 * chat keeps the same line afterwards, so nothing is lost.
 */
export function PodiumCelebration({ message, onOpenPodium, onDismiss }: Props) {
  const slide = useRef(new Animated.Value(-1)).current;
  const shown = useRef<string | null>(null);
  /** La línea que sigue dibujada también mientras la tarjeta se va. */
  const [view, setView] = useState<string | null>(message);

  useEffect(() => {
    if (message) {
      if (shown.current === message) return;
      shown.current = message;
      setView(message);
      slide.setValue(-1);
      Animated.spring(slide, { toValue: 0, friction: 7, tension: 90, useNativeDriver: true }).start();
      return;
    }
    // El aviso se retira: sube y se desvanece en un instante, sin saltar.
    if (!shown.current) return;
    shown.current = null;
    Animated.timing(slide, { toValue: -1, duration: 220, useNativeDriver: true }).start(() => setView(null));
  }, [message, slide]);

  if (!view) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        transform: [{ translateY: slide.interpolate({ inputRange: [-1, 0], outputRange: [-120, 0] }) }],
        opacity: slide.interpolate({ inputRange: [-1, -0.4, 0], outputRange: [0, 1, 1] }),
      }}>
      <View
        className="mx-4 mt-2 overflow-hidden rounded-2xl active:opacity-90"
        style={{ borderWidth: 1, borderColor: 'rgba(255,194,75,0.55)' }}>
        <LinearGradient
          colors={['rgba(255,194,75,0.30)', 'rgba(40,24,8,0.94)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
          <View
            className="size-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'rgba(255,194,75,0.22)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.5)' }}>
            <Icon as={Trophy} size={18} color="#F3D58C" />
          </View>
          {/* The text opens the podium; the close button is its own press, so
              no button ever sits inside another one. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${view} Toca para ver el podio del día`}
            onPress={onOpenPodium}
            className="flex-1 active:opacity-85">
            <Text className="text-[11px] font-bold tracking-[0.12em]" style={{ color: '#FFC24B' }}>PODIO DE HOY</Text>
          <Text className="mt-0.5 text-[13px] font-semibold leading-4 text-white" numberOfLines={3}>{view}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar el aviso del podio"
            onPress={onDismiss}
            hitSlop={10}
            className="size-7 items-center justify-center rounded-full active:opacity-70"
            style={{ backgroundColor: 'rgba(0,0,0,0.28)' }}>
            <Icon as={X} size={13} color="rgba(255,255,255,0.8)" />
          </Pressable>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}
