import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, ShieldOff } from 'lucide-react-native';
import { useAuth } from '@/features/auth';
import { requireSupabase } from '@/lib/supabase';
import { myAccountBan, type AccountBan } from '@/lib/admin';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';

/**
 * Una cuenta suspendida no puede seguir usando la app aunque su sesión siga
 * abierta. Se comprueba al entrar y cada dos minutos; el servidor también corta
 * las escrituras, así que esto no es la única defensa.
 */
export function AccountSuspensionGate({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const [ban, setBan] = useState<AccountBan | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) {
      setBan(null);
      return;
    }
    let live = true;
    const check = () => {
      void myAccountBan()
        .then(value => { if (live) setBan(value); })
        .catch(() => undefined);
    };
    check();
    const timer = setInterval(check, 120_000);
    return () => { live = false; clearInterval(timer); };
  }, [userId]);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await requireSupabase().auth.signOut();
    } finally {
      setSigningOut(false);
      setBan(null);
    }
  }

  if (!ban) return <>{children}</>;

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="flex-1 items-center justify-center gap-4 px-7">
        <View className="bg-destructive/10 size-20 items-center justify-center rounded-full">
          <Icon as={ShieldOff} className="text-destructive size-8" />
        </View>
        <Text className="text-foreground text-center text-[22px] font-semibold">Tu cuenta está suspendida</Text>
        <Text className="text-muted-foreground text-center text-[13px] leading-5">
          La moderación cerró el acceso a esta cuenta. No puedes entrar a salas, escribir ni enviar regalos.
        </Text>
        <View className="border-destructive/25 bg-card w-full gap-1 rounded-[18px] border px-4 py-3">
          <Text className="text-muted-foreground text-[11px] font-semibold uppercase tracking-wide">Motivo</Text>
          <Text className="text-foreground text-[13px] leading-5">{ban.reason}</Text>
          <Text className="text-muted-foreground mt-1 text-[11.5px]">
            {ban.until ? `Hasta ${new Date(ban.until).toLocaleString('es-US')}` : 'Suspensión permanente'}
          </Text>
        </View>
        <Text className="text-muted-foreground text-center text-[11.5px] leading-4">
          Si crees que fue un error, habla con el dueño de la app o con el equipo de moderación.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cerrar sesión"
          onPress={() => void signOut()}
          disabled={signingOut}
          className="bg-primary mt-2 h-12 w-full flex-row items-center justify-center gap-2 rounded-full active:opacity-85 disabled:opacity-50">
          {signingOut ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={LogOut} size={15} className="text-primary-foreground" />}
          <Text className="text-primary-foreground text-[13.5px] font-semibold">Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
