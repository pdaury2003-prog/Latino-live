import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { Check, Clock, Receipt, Wallet } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { usePlans } from '@/features/plans';
import { useOwnership } from '@/lib/payments';
import { useAccent } from '@/lib/theme-accent';

/**
 * Vuelta del pago. Solo el servidor dice si la compra entró: aquí se lee su
 * respuesta y se explica con calma, sin dar por hecho nada. Desde aquí se
 * vuelve a la billetera o se comprueba otra vez.
 */
export default function PaymentReturn() {
  const { session, loading } = useAuth();
  const accent = useAccent();
  const ownership = useOwnership();
  const { available, pending, error, visit } = usePlans();
  const ready = ownership.data.entitlements.length > 0;
  const checking = loading || ownership.isFetching;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1" style={{ backgroundColor: accent.surface }}>
      <View className="flex-1 justify-center gap-6 px-6">
        <View className="items-center gap-4">
          <View
            className="size-20 items-center justify-center rounded-full"
            style={{
              backgroundColor: ready ? 'rgba(52,211,153,0.16)' : accent.wash,
              borderWidth: 1.5,
              borderColor: ready ? 'rgba(52,211,153,0.5)' : accent.edge,
            }}>
            {checking ? (
              <ActivityIndicator color={accent.main} />
            ) : (
              <Icon as={ready ? Check : Clock} size={30} color={ready ? '#34D399' : accent.main} />
            )}
          </View>

          <Text className="text-center text-[21px] font-bold" style={{ color: accent.text }}>
            {checking ? 'Comprobando tu compra…' : ready ? 'Tu compra está lista' : 'Esperando la confirmación'}
          </Text>
          <Text className="text-center text-[13px] leading-5" style={{ color: accent.muted }}>
            {checking
              ? 'Estamos mirando tu cuenta. Tarda solo un momento.'
              : ready
                ? 'Los diamantes ya están en tu cuenta y puedes usarlos en las salas.'
                : 'El banco todavía no nos avisó del pago. En cuanto llegue, tus diamantes aparecen solos: no hace falta volver a pagar.'}
          </Text>
        </View>

        {!session && !loading ? (
          <View className="gap-2 rounded-2xl border p-4" style={{ borderColor: accent.line, backgroundColor: accent.raised }}>
            <Text className="text-[12.5px] leading-5" style={{ color: accent.muted }}>
              Entra con la misma cuenta con la que pagaste para ver tu compra.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Entrar a mi cuenta"
              onPress={() => router.replace('/entrar' as Href)}
              className="h-11 items-center justify-center rounded-full active:opacity-85"
              style={{ backgroundColor: accent.main }}>
              <Text className="text-[13px] font-bold" style={{ color: accent.ink }}>Entrar</Text>
            </Pressable>
          </View>
        ) : null}

        {error ? <Text className="text-center text-[12px]" style={{ color: '#F0847C' }}>{error}</Text> : null}
        {ownership.error ? <Text className="text-center text-[12px]" style={{ color: '#F0847C' }}>{ownership.error.message}</Text> : null}

        <View className="gap-2.5">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Volver a mi billetera"
            onPress={() => router.replace('/billetera' as Href)}
            className="h-12 flex-row items-center justify-center gap-2 rounded-full active:opacity-85"
            style={{ backgroundColor: ready ? accent.main : accent.wash, borderWidth: ready ? 0 : 1, borderColor: accent.edge }}>
            <Icon as={Wallet} size={16} color={ready ? accent.ink : accent.main} />
            <Text className="text-[13.5px] font-bold" style={{ color: ready ? accent.ink : accent.main }}>Ir a mi billetera</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Comprobar otra vez si mi compra entró"
            disabled={checking}
            onPress={() => void ownership.refetch()}
            className="h-11 flex-row items-center justify-center gap-2 rounded-full active:opacity-80"
            style={{ backgroundColor: accent.wash, borderWidth: 1, borderColor: accent.line }}>
            {checking ? <ActivityIndicator size="small" color={accent.muted} /> : <Icon as={Receipt} size={15} color={accent.muted} />}
            <Text className="text-[12.5px] font-semibold" style={{ color: accent.text }}>Comprobar de nuevo</Text>
          </Pressable>

          {available ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Administrar mi pago"
              disabled={pending !== null}
              onPress={() => void visit('portal')}
              className="h-10 items-center justify-center rounded-full active:opacity-70">
              <Text className="text-[12px] font-semibold" style={{ color: accent.muted }}>
                {pending === 'portal' ? 'Abriendo…' : 'Administrar mi pago'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}
