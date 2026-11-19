import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AccountGate, useAuth } from '@/features/auth';
import { goBack } from '@/components/screen';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ChevronLeft } from 'lucide-react-native';

export default function Entrar() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(goBack, 350);
    return () => clearTimeout(timer);
  }, [session]);

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="h-14 flex-row items-center px-2">
        <Button variant="ghost" size="icon" accessibilityLabel="Volver" onPress={goBack}>
          <Icon as={ChevronLeft} className="size-6" />
        </Button>
        <Text className="text-muted-foreground text-xs">Tu cuenta en Latino Live</Text>
      </View>
      <View className="flex-1 px-5 pb-6">
        <AccountGate>
          <View className="flex-1 items-center justify-center gap-3">
            <ActivityIndicator color="#FFC24B" />
            <Text className="text-foreground text-base font-semibold">Sesión iniciada</Text>
            <Text className="text-muted-foreground text-xs">Volviendo a la sala…</Text>
            <Button variant="outline" onPress={goBack}><Text>Volver ahora</Text></Button>
          </View>
        </AccountGate>
      </View>
    </SafeAreaView>
  );
}
