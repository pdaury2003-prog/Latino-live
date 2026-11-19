import { useEffect, useState, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { config } from '@/lib/config';
import { Text } from '@/components/ui/text';
import { timeoutSignal } from '@/lib/abort';

export function AppUpdateGate({ children }: { children: ReactNode }) {
  const [outdated, setOutdated] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web' || !config.statusUrl || config.versionCode <= 0) return;
    let live = true;
    try {
      void fetch(config.statusUrl, { signal: timeoutSignal(10_000) }).then(async response => {
        if (!response.ok) return;
        const value = await response.json();
        if (live && Number.isInteger(value.minimumVersionCode) && value.minimumVersionCode > config.versionCode) setOutdated(true);
      }).catch(() => { /* Offline or unreadable responses never lock out an installed app. */ });
    } catch {
      // A phone without the update endpoint simply keeps working.
    }
    return () => { live = false; };
  }, []);
  if (!outdated) return <>{children}</>;
  return <View className="flex-1 items-center justify-center gap-4 bg-background px-8">
    <Text variant="h3">Actualiza Latino Live</Text>
    <Text className="text-center text-muted-foreground">Esta versión ya no funciona. Abre el enlace con el que instalaste la app para descargar la más reciente.</Text>
  </View>;
}
