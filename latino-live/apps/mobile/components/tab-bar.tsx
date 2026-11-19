import { memo, useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { LucideIcon } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { useDirectUnread } from '@/features/direct-alerts';
import { useDesignTheme } from '@/features/design-theme';

type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

export const TAB_BAR_HEIGHT = 56;

/**
 * The bar of the five rooms of the app: the billboard, the games, the moments,
 * the inbox and the profile.
 *
 * It floats over the content with a warm surface of its own, so the list keeps
 * running behind it instead of ending in a hard band. The open room is lit: a
 * soft capsule of the theme's accent with its icon glowing, the rest of the
 * bar quiet. The chosen look is a still light, not a loop, so the bar costs
 * nothing while the person reads.
 */
export const TabBar = memo(function TabBar({ state, descriptors, navigation, icons }: TabBarProps & { icons: Record<string, LucideIcon> }) {
  const insets = useSafeAreaInsets();
  const { unread } = useDirectUnread();
  const { colorScheme } = useDesignTheme();
  // El segundo modo es de día: papel blanco, tinta negra y oro.
  const day = colorScheme === 'light';
  // The two looks keep the same design language: one accent, used only for
  // what is alive and what the person chose.
  const accent = day ? '#8A5B08' : '#FFC24B';
  const onAccent = day ? '#FFF9EC' : '#2A1B06';
  const surface = day ? 'rgba(255,255,255,0.97)' : 'rgba(23,17,19,0.96)';
  const edge = day ? 'rgba(138,91,8,0.24)' : 'rgba(255,194,75,0.30)';
  const bottom = Math.max(insets.bottom, 12);

  return (
    <View pointerEvents="box-none" className="absolute bottom-0 left-0 right-0" style={{ paddingBottom: bottom }}>
      {/* The few pixels where the content slips under the bar fade into the
          night, so a card never ends halfway behind the glass. */}
      <LinearGradient
        pointerEvents="none"
        colors={[day ? 'rgba(241,239,234,0)' : 'rgba(8,6,7,0)', day ? 'rgba(241,239,234,0.65)' : 'rgba(8,6,7,0.55)']}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: bottom + TAB_BAR_HEIGHT + 26 }}
      />
      {/* En una pantalla ancha la barra no se estira de borde a borde: se
          queda del ancho de una columna de teléfono, centrada. */}
      <View className="px-3.5" style={{ width: '100%', maxWidth: 560, alignSelf: 'center' }}>
        <View
          role="tablist"
          className="overflow-hidden rounded-[22px] border"
          style={{
            height: TAB_BAR_HEIGHT,
            borderColor: edge,
            backgroundColor: surface,
            shadowColor: '#000',
            shadowOpacity: 0.45,
            shadowRadius: 22,
            shadowOffset: { width: 0, height: 10 },
            elevation: 18,
          }}>
          {/* Blurring a bar that floats over a scrolling list costs Android a lot
              of frames, so there it stays a plain translucent surface. */}
          {Platform.OS === 'android' ? null : (
            <BlurView intensity={Platform.OS === 'web' ? 0 : 40} tint={day ? 'light' : 'dark'} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
          )}
          {/* The top reflection: one hairline of the accent, brighter in the
              middle, the way polished metal catches the room's light. */}
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(255,255,255,0)', edge, 'rgba(255,255,255,0)']}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ position: 'absolute', top: 0, left: 18, right: 18, height: 1 }}
          />
          <View className="flex-1 flex-row items-center justify-around px-1.5">
            {state.routes.map((route, index) => {
              const options = descriptors[route.key]?.options ?? {};
              const label = typeof options.title === 'string' ? options.title : route.name;
              const focused = state.index === index;
              const icon = icons[route.name];
              const onPress = () => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
              };
              return (
                <TabButton
                  key={route.key}
                  label={label}
                  focused={focused}
                  icon={icon}
                  accent={accent}
                  onAccent={onAccent}
                  badge={route.name === 'mensajes' ? unread : 0}
                  onPress={onPress}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
});

/**
 * One room of the bar. It lifts a little and lights its capsule when opened;
 * the change is a short ease, never a loop.
 */
const TabButton = memo(function TabButton({
  label,
  focused,
  icon,
  accent,
  onAccent,
  badge,
  onPress,
}: {
  label: string;
  focused: boolean;
  icon?: LucideIcon;
  accent: string;
  onAccent: string;
  badge: number;
  onPress: () => void;
}) {
  const lit = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    lit.value = withTiming(focused ? 1 : 0, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [focused, lit]);

  const capsule = useAnimatedStyle(() => ({
    opacity: lit.value,
    transform: [{ scale: 0.94 + lit.value * 0.06 }],
  }));
  const lift = useAnimatedStyle(() => ({ transform: [{ translateY: -1.5 * lit.value }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.18 + lit.value * 0.4 }));

  return (
    <Pressable
      role="tab"
      aria-selected={focused}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPress={onPress}
      className={cn(
        'min-h-11 flex-1 items-center justify-center',
        Platform.select({ web: 'outline-none focus-visible:ring-2 focus-visible:ring-ring/60' }),
      )}
      style={{ alignSelf: 'stretch' }}>
      {/*
        The lit tile of the open room. It is pinned to the whole pressable, so
        it can never grow past the bar or drift under the label.
      */}
      <Animated.View
        pointerEvents="none"
        style={[
          capsule,
          {
            position: 'absolute',
              top: 3.5,
              bottom: 3.5,
              left: 3.5,
              right: 3.5,
              borderRadius: 13,
            overflow: 'hidden',
          },
        ]}>
        <LinearGradient colors={[accent, accent]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
        <LinearGradient
          colors={['rgba(255,255,255,0.30)', 'rgba(255,255,255,0)']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '52%' }}
        />
      </Animated.View>
      <Animated.View style={lift} className="items-center justify-center">
        {icon ? (
          <View>
            {/* The light the open icon gives off: a still glow, not an animation. */}
            <Animated.View
              pointerEvents="none"
              style={[
                glow,
                {
                  position: 'absolute',
                  left: -8,
                  right: -8,
                  top: -8,
                  bottom: -8,
                  borderRadius: 18,
                  backgroundColor: accent,
                  opacity: 0.2,
                },
              ]}
            />
            <Icon
              as={icon}
              style={{ width: 19, height: 19 }}
              className={cn(focused ? '' : 'text-muted-foreground')}
              color={focused ? onAccent : undefined}
            />
            {badge > 0 ? (
              <View
                className="absolute -right-2.5 -top-1.5 min-w-[17px] items-center justify-center rounded-full px-1"
                style={{ height: 16, backgroundColor: '#E5484D', borderWidth: 1.5, borderColor: '#13101E' }}>
                <Text allowFontScaling={false} className="text-[11px] font-bold leading-[12px] text-white tabular-nums">
                  {badge > 9 ? '9+' : badge}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text
          allowFontScaling={false}
          className={cn('mt-0.5 text-[11px]', focused ? 'font-semibold' : 'text-muted-foreground font-medium')}
          style={focused ? { color: onAccent } : undefined}>
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
});
