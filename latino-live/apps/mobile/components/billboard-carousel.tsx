import { memo, useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, View, useWindowDimensions } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Plus, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/** Un aviso de la cartelera: anuncio, evento o promoción de la casa. */
export type BillboardItem = {
  key: string;
  tag: string;
  meta: string;
  title: string;
  body: string;
  cta: string;
  icon: LucideIcon;
  tint: string;
  edge: string;
  wash: string;
  action: () => void;
  busy: boolean;
};

type Props = {
  items: BillboardItem[];
  day: boolean;
  /** Colores del modo, para que el aviso siga el papel o la noche. */
  text: string;
  muted: string;
  ink: string;
};

/**
 * La cartelera de arriba se turna sola cada dos segundos.
 *
 * Vive en su propio componente por una razón de peso: antes el turno era un
 * estado de la pantalla, así que cada dos segundos se volvían a dibujar el
 * encabezado, los tres marcos del podio, la billetera y todas las tarjetas de
 * salas. Ahora el cambio de aviso solo redibuja este recuadro.
 */
export const BillboardCarousel = memo(function BillboardCarousel({ items, day, text, muted, ink }: Props) {
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;
  const count = items.length;
  /**
   * En un teléfono angosto la cartelera no cabe con el icono, el texto y el
   * botón a la vez: la línea de detalle se aparta para que el título y la
   * acción se lean completos.
   */
  const { width } = useWindowDimensions();
  const tight = width < 400;

  // Solo avanza mientras la cartelera está a la vista: en otra pestaña se para.
  useFocusEffect(
    useCallback(() => {
      if (count < 2) return undefined;
      const timer = setInterval(() => {
        Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
          setIndex(current => (current + 1) % count);
          Animated.timing(fade, { toValue: 1, duration: 240, useNativeDriver: true }).start();
        });
      }, 2000);
      return () => clearInterval(timer);
    }, [fade, count]),
  );

  if (count === 0) return null;
  const shownIndex = index % count;
  const bill = items[shownIndex] ?? items[0];

  return (
    <View className="mb-3">
      <Animated.View style={{ opacity: fade }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${bill.tag}: ${bill.title}. ${bill.cta}`}
          disabled={bill.busy}
          onPress={bill.action}
          className="overflow-hidden rounded-[18px] active:opacity-85"
          style={{ borderWidth: 1, borderColor: bill.edge }}>
          <LinearGradient
            colors={day ? [bill.wash, '#FFFFFF'] : [bill.wash, 'rgba(24,16,44,0.94)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 }}>
            <View
              className="size-9 items-center justify-center rounded-full border"
              style={{ borderColor: bill.edge, backgroundColor: day ? '#FFFFFF' : 'rgba(255,255,255,0.08)' }}>
              <Icon as={bill.icon} size={16} color={bill.tint} />
            </View>
            <View className="flex-1" style={{ minWidth: 0 }}>
              <View className="flex-row items-center gap-1.5">
                <Text className="text-[11px] font-bold tracking-[0.12em]" style={{ color: bill.tint }}>{bill.tag}</Text>
                <Text className="text-[11px]" style={{ color: day ? muted : 'rgba(255,255,255,0.55)' }} numberOfLines={1}>{bill.meta}</Text>
              </View>
              <Text className="mt-0.5 text-[13px] font-medium" style={{ color: text }} numberOfLines={2}>{bill.title}</Text>
              {bill.body && !tight ? (
                <Text className="mt-0.5 text-[11px]" style={{ color: day ? muted : 'rgba(255,255,255,0.6)' }} numberOfLines={1}>{bill.body}</Text>
              ) : null}
            </View>
            <View
              className="h-8 shrink-0 flex-row items-center gap-1 rounded-full"
              style={{ backgroundColor: bill.tint, paddingHorizontal: tight ? 10 : 12 }}>
              {bill.busy ? <ActivityIndicator size="small" color={ink} /> : <Icon as={Plus} size={14} color={ink} />}
              <Text className="text-[12px] font-semibold" style={{ color: ink }} numberOfLines={1}>{bill.cta}</Text>
            </View>
          </LinearGradient>
        </Pressable>
      </Animated.View>
      <View className="mt-1.5 flex-row items-center justify-center gap-1.5">
        {items.map((item, position) => (
          <View
            key={item.key}
            style={{
              height: 3,
              width: position === shownIndex ? 14 : 5,
              borderRadius: 999,
              backgroundColor: position === shownIndex ? item.tint : day ? 'rgba(20,18,16,0.18)' : 'rgba(255,255,255,0.22)',
            }}
          />
        ))}
      </View>
    </View>
  );
});
