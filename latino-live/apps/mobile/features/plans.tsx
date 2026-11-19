import { useState } from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { AccountGate, useAuth } from '@/features/auth';
import { paymentsAvailable, priceLabel, products, useOwnership, visitPayment, type Product } from '@/lib/payments';

/**
 * The project's Stripe products with a checkout button per price. Only the
 * server's entitlements prove ownership; checkout itself never grants access.
 */
export function usePlans() {
  const catalog = useQuery({ queryKey: ['products'], queryFn: products, enabled: paymentsAvailable() });
  const ownership = useOwnership();
  const [pending, setPending] = useState<string | null>(null), [error, setError] = useState<string | null>(null);
  async function visit(path: 'checkout' | 'portal', priceId?: string) {
    if (pending) return;
    setPending(priceId ?? path); setError(null);
    try { await visitPayment(path, priceId); await ownership.refetch(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No pudimos abrir el pago. Inténtalo otra vez.'); }
    finally { setPending(null); }
  }
  return { available: paymentsAvailable(), catalog, ownership, pending, error, visit };
}

export function Plans() {
  const { available, catalog, pending, error, visit } = usePlans();
  if (!available) return <Text className="text-muted-foreground">Los planes todavía no están disponibles.</Text>;
  return (
    <View className="gap-4">
      {catalog.isPending ? <Text className="text-muted-foreground">Cargando los planes…</Text> : null}
      {catalog.error ? (
        <View className="gap-3">
          <Text>{catalog.error.message}</Text>
          <Button variant="outline" onPress={() => void catalog.refetch()}><Text>Reintentar</Text></Button>
        </View>
      ) : null}
      {catalog.data?.items.map((product: Product) => (
        <Card key={product.id}>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            {product.description ? <CardDescription>{product.description}</CardDescription> : null}
          </CardHeader>
          <CardContent className="gap-3">
            {product.prices.map(price => (
              <Button key={price.id} disabled={pending !== null} onPress={() => void visit('checkout', price.id)}>
                <Text>{pending === price.id ? 'Abriendo…' : priceLabel(price)}</Text>
              </Button>
            ))}
          </CardContent>
        </Card>
      ))}
      {catalog.data && catalog.data.items.length === 0 ? <Text className="text-muted-foreground">No hay planes disponibles.</Text> : null}
      {error ? <Text accessibilityLiveRegion="polite" className="text-destructive">{error}</Text> : null}
      <Button variant="outline" disabled={pending !== null} onPress={() => void visit('portal')}><Text>Administrar mi pago</Text></Button>
    </View>
  );
}

export function PurchaseStatus() {
  const { session } = useAuth();
  if (!session) return <AccountGate><SignedInPurchaseStatus /></AccountGate>;
  return <SignedInPurchaseStatus />;
}

function SignedInPurchaseStatus() {
  const ownership = useOwnership();
  const ready = ownership.data.entitlements.length > 0;
  return (
    <View className="items-center gap-3">
      <Text role="heading" className="text-center text-2xl font-semibold tracking-tight">
        {ownership.isFetching ? 'Comprobando tu compra…' : ready ? 'Tu acceso está listo' : 'Esperando la confirmación'}
      </Text>
      <Text className="text-muted-foreground text-center">Tu acceso se activa en cuanto el pago queda confirmado.</Text>
      {ownership.error ? <Text className="text-destructive text-center">{ownership.error.message}</Text> : null}
      <Button variant={ready ? 'outline' : 'default'} className="w-full" disabled={ownership.isFetching} onPress={() => void ownership.refetch()}>
        <Text>Comprobar otra vez</Text>
      </Button>
    </View>
  );
}
