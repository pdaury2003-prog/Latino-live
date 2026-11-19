import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { Bell, Camera, Mic, ShieldCheck, Video } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  accessLabel,
  askMicrophone,
  askNotifications,
  askPhotos,
  askCamera,
  cameraState,
  microphoneState,
  notificationsState,
  photosState,
  type AccessState,
} from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { enablePush, pushCapability, type PushState } from '@/lib/push';

type Kind = 'microphone' | 'camera' | 'photos' | 'notifications';

const COPY: Record<Kind, { icon: typeof Mic; title: string; hint: string; ask: () => Promise<AccessState>; read: () => Promise<AccessState> }> = {
  microphone: {
    icon: Mic,
    title: 'Micrófono',
    hint: 'Para hablar en vivo cuando te sientas en un asiento.',
    ask: askMicrophone,
    read: microphoneState,
  },
  photos: {
    icon: Camera,
    title: 'Fotos',
    hint: 'Para tu foto de perfil, la portada, el fondo de tu sala y el chat.',
    ask: askPhotos,
    read: photosState,
  },
  camera: {
    icon: Video,
    title: 'Cámara',
    hint: 'Para salir en vivo con tu cámara en la sala.',
    ask: askCamera,
    read: cameraState,
  },
  notifications: {
    icon: Bell,
    title: 'Notificaciones',
    hint: 'Avisos de regalos, seguidores y mensajes en tus salas.',
    ask: askNotifications,
    read: notificationsState,
  },
};

const ORDER: Kind[] = ['microphone', 'camera', 'photos', 'notifications'];

export default function Permisos() {
  const [states, setStates] = useState<Record<Kind, AccessState>>({
    microphone: 'undetermined',
    camera: 'undetermined',
    photos: 'undetermined',
    notifications: 'undetermined',
  });
  const [busy, setBusy] = useState<Kind | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  /** Whether this phone can be reached while the app is closed. */
  const [push, setPush] = useState<PushState>('permission');

  const load = useCallback(async () => {
    const [microphone, camera, photos, notifications] = await Promise.all([
      microphoneState(),
      cameraState(),
      photosState(),
      notificationsState(),
    ]);
    setStates({ microphone, camera, photos, notifications });
    setPush(await pushCapability());
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function request(kind: Kind) {
    setBusy(kind);
    setNotice(null);
    const next = await COPY[kind].ask();
    setStates(current => ({ ...current, [kind]: next }));
    setBusy(null);
    // Allowance is only half of a notice: the phone also has to give the
    // account its address, or nothing arrives while the app is closed.
    if (next === 'granted' && kind === 'notifications') {
      const result = await enablePush();
      setPush(result);
      if (result === 'ready') setNotice('Listo: los avisos llegan aunque la app esté cerrada.');
      else if (result === 'firebase' || result === 'project') setNotice('El teléfono permite el aviso, pero esta versión no trae la configuración de Firebase y no puede recibirlo cerrada.');
      else if (result === 'unsupported') setNotice('Este teléfono no puede recibir avisos con la app cerrada.');
      else setNotice('No pudimos guardar el aviso del teléfono. Revisa tu conexión e inténtalo otra vez.');
      return;
    }
    if (next === 'granted') setNotice(`Permiso de ${COPY[kind].title.toLowerCase()} activado.`);
    else if (next === 'denied') setNotice('El teléfono lo bloqueó. Actívalo en los ajustes del sistema.');
    else if (next === 'unavailable') setNotice('Este permiso solo se puede activar en el teléfono.');
    else setNotice('El teléfono no mostró la solicitud. Inténtalo otra vez.');
  }

  return (
    <Screen back title="Permisos" description="Latino Live solo usa lo que necesita para las salas, tus fotos y tus avisos.">
      <View className="border-primary/25 bg-primary/10 flex-row items-start gap-3 rounded-2xl border p-4">
        <Icon as={ShieldCheck} className="text-primary mt-0.5 size-5" />
        <Text className="text-muted-foreground flex-1 text-[12px] leading-5">
          Puedes cambiar estos permisos cuando quieras. Si bloqueas uno, la app te lo dirá en el momento y seguirá funcionando sin él.
        </Text>
      </View>

      <View className="gap-3">
        {ORDER.map(kind => {
          const item = COPY[kind];
          const state = states[kind];
          const granted = state === 'granted';
          const unavailable = state === 'unavailable';
          return (
            <View key={kind} className="border-border bg-card rounded-2xl border p-4">
              <View className="flex-row items-center gap-3">
                <View className="bg-primary/15 size-10 items-center justify-center rounded-full">
                  <Icon as={item.icon} className="text-primary size-4" />
                </View>
                <View className="flex-1">
                  <Text className="text-foreground text-sm font-semibold">{item.title}</Text>
                  <Text className="text-muted-foreground mt-0.5 text-[11px] leading-4">{item.hint}</Text>
                </View>
                <View
                  className={cn(
                    'rounded-full px-2 py-0.5',
                    granted ? 'bg-success/15' : state === 'denied' ? 'bg-destructive/15' : 'bg-muted',
                  )}>
                  <Text
                    className={cn(
                      'text-[11px] font-semibold',
                      granted ? 'text-success' : state === 'denied' ? 'text-destructive' : 'text-muted-foreground',
                    )}>
                    {loading ? '…' : accessLabel(state)}
                  </Text>
                </View>
              </View>

              {kind === 'notifications' && granted && !loading ? (
                <Text className="text-muted-foreground mt-2 text-[11px] leading-4">
                  {push === 'ready'
                    ? 'El aviso llega aunque la app esté cerrada.'
                    : push === 'firebase' || push === 'project'
                      ? 'Esta versión no trae la configuración de Firebase; los avisos llegan al abrir Avisos.'
                      : push === 'unsupported'
                        ? 'Este teléfono no recibe avisos con la app cerrada; los verás al abrir Avisos.'
                      : 'Falta guardar el aviso de este teléfono. Toca Reintentar abajo.'}
                </Text>
              ) : null}

              {granted ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir los ajustes de ${item.title.toLowerCase()}`}
                  onPress={() => void Linking.openSettings()}
                  className="border-border mt-3 h-10 items-center justify-center rounded-full border active:bg-muted">
                  <Text className="text-foreground text-[12px] font-medium">Revisar en ajustes</Text>
                </Pressable>
              ) : unavailable ? (
                <Text className="text-muted-foreground mt-3 text-[11px]">Actívalo desde la app instalada en tu teléfono.</Text>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Permitir ${item.title.toLowerCase()}`}
                  disabled={busy === kind}
                  onPress={() => void (state === 'denied' ? Linking.openSettings() : request(kind))}
                  className="bg-primary mt-3 h-10 flex-row items-center justify-center gap-1.5 rounded-full active:bg-primary/80">
                  {busy === kind ? <ActivityIndicator size="small" color="#1A1409" /> : null}
                  <Text className="text-primary-foreground text-[12px] font-semibold">
                    {state === 'denied' ? 'Abrir ajustes' : `Permitir ${item.title.toLowerCase()}`}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {notice ? <Text className="text-muted-foreground text-center text-[11px] leading-4">{notice}</Text> : null}
    </Screen>
  );
}
