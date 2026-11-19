import { Image } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { BADGE_ART, type BadgeKind } from '@/lib/badges';
import { useRolePulse } from '@/lib/role-motion';

/**
 * La insignia de rol junto al nombre: el arte de la casa, a la altura del
 * texto para que no empuje el nombre fuera de su asiento.
 */
export function RoleBadge({ kind, height = 18, dimmed = false, animated = true }: { kind: BadgeKind | null | undefined; height?: number; dimmed?: boolean; animated?: boolean }) {
  const pulse = useRolePulse(Boolean(kind) && animated);
  const breathe = useAnimatedStyle(() => ({
    opacity: dimmed ? 0.75 : 0.9 + 0.1 * pulse.value,
    transform: [{ scale: 0.97 + 0.05 * pulse.value }],
  }));
  if (!kind) return null;
  const art = BADGE_ART[kind];
  return (
    <Animated.View style={breathe} accessible accessibilityLabel={`Insignia ${art.label}`}>
      <Image
        source={art.source}
        resizeMode="contain"
        style={{ height, width: Math.round(height * art.ratio) }}
      />
    </Animated.View>
  );
}
