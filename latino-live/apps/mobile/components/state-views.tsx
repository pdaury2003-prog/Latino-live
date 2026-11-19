import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

/**
 * Las tres respuestas que una pantalla puede dar cuando no hay nada que
 * mostrar: todavía no hay nada, hay un aviso y hay un error.
 *
 * Todas se dibujan igual en toda la app —misma tarjeta, mismo icono, mismo
 * botón— para que la persona reconozca el mismo mensaje en cualquier sitio.
 */

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  hint: string;
  /** Una sola salida clara, cuando hay algo que hacer. */
  action?: { label: string; onPress: () => void };
  className?: string;
};

export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <View className={cn('border-border bg-card mx-5 items-center gap-2 rounded-[20px] border px-6 py-9', className)}>
      <View className="bg-primary/15 size-12 items-center justify-center rounded-full">
        <Icon as={icon} className="text-primary size-5" />
      </View>
      <Text className="text-foreground mt-1 text-center text-sm font-semibold">{title}</Text>
      <Text className="text-muted-foreground text-center text-[12px] leading-4">{hint}</Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          className="bg-primary mt-2 h-10 items-center justify-center rounded-full px-5 active:opacity-85">
          <Text className="text-primary-foreground text-[12px] font-semibold">{action.label}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

type NoticeTone = 'error' | 'success' | 'info';

const TONES: Record<NoticeTone, { icon: LucideIcon; box: string; ink: string }> = {
  error: { icon: AlertCircle, box: 'border-destructive/35 bg-destructive/10', ink: 'text-destructive' },
  success: { icon: CheckCircle2, box: 'border-success/35 bg-success/10', ink: 'text-success' },
  info: { icon: Info, box: 'border-primary/30 bg-primary/10', ink: 'text-primary' },
};

/**
 * Un aviso dentro de la pantalla, junto a la acción que lo provocó: un error
 * con su reintento, una confirmación o una explicación. Siempre el mismo
 * borde, el mismo icono y el mismo tamaño de letra.
 */
export function Notice({
  tone = 'info',
  text,
  onRetry,
  className,
}: {
  tone?: NoticeTone;
  text: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { icon, box, ink } = TONES[tone];
  return (
    <View className={cn('mx-5 mb-3 flex-row items-center gap-2 rounded-xl border px-3 py-2.5', box, className)}>
      <Icon as={icon} className={cn('size-3.5', ink)} />
      <Text className={cn('flex-1 text-[11.5px] leading-4', ink)}>{text}</Text>
      {onRetry ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reintentar"
          hitSlop={8}
          onPress={onRetry}
          className="active:opacity-70">
          <Text className={cn('text-[11.5px] font-semibold underline', ink)}>Reintentar</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** El encabezado de una pestaña: título, una línea y, si hace falta, una acción. */
export function TabHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <View className={cn('flex-row items-start justify-between gap-3 px-5 pt-2 pb-4', className)}>
      <View className="flex-1">
        <Text role="heading" className="text-foreground text-[26px] font-semibold tracking-tight" numberOfLines={1}>{title}</Text>
        <Text className="text-muted-foreground mt-1 text-[13px] leading-5">{subtitle}</Text>
      </View>
      {/* La acción queda arriba, a la altura del título, aunque el subtítulo
          ocupe dos líneas. */}
      {action ? <View className="shrink-0 self-start">{action}</View> : null}
    </View>
  );
}
