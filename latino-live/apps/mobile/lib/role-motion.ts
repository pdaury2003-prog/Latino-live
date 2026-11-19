import { useEffect } from 'react';
import { Easing, makeMutable, withRepeat, withTiming } from 'react-native-reanimated';
import { useMotion } from '@/lib/power';

/**
 * El latido de las insignias. Todas comparten un solo valor animado, así que
 * una sala con veinte insignias no cuesta veinte bucles: cuesta uno, y el
 * ahorro de batería lo detiene en seco.
 */
const pulse = makeMutable(0);
let wearing = 0;

export function useRolePulse(active = true): typeof pulse {
  const motion = useMotion() && active;
  useEffect(() => {
    if (!motion) return;
    wearing += 1;
    if (wearing === 1) {
      pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }), -1, true);
    }
    return () => {
      wearing = Math.max(0, wearing - 1);
      if (wearing === 0) pulse.value = withTiming(0, { duration: 320 });
    };
  }, [motion]);
  return pulse;
}
