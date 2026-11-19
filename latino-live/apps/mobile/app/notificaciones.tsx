import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router, type Href } from 'expo-router';
import { Bell, Gift, MessageCircle, Radio, Settings2, Sparkles, UserPlus } from 'lucide-react-native';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { timeAgo } from '@/lib/activity';
import { getNotices } from '@/lib/notices-data';
import { loadNoticesSeen, saveNoticesSeen } from '@/lib/preferences';
import type { AppNotice } from '@/lib/notices';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/state-views';
import { RowSkeleton } from '@/components/ui/skeleton';
import { enablePush, pushCapability, sendTestPush, type PushState } from '@/lib/push';

const SEEN_KEY = 'sahar:notices:seen';

const LOOK = {
  gift: { icon: Gift, tint: 'text-primary', background: 'bg-primary/15', label: 'Regalo' },
  follow: { icon: UserPlus, tint: 'text-primary', background: 'bg-primary/15', label: 'Seguidor' },
  chat: { icon: MessageCircle, tint: 'text-primary', background: 'bg-primary/15', label: 'Mensaje' },
  invite: { icon: Sparkles, tint: 'text-primary', background: 'bg-primary/15', label: 'Invitación' },
  room: { icon: Radio, tint: 'text-primary', background: 'bg-primary/15', label: 'Sala nueva' },
} as const;

export default function Avisos() {
  const { session } = useAuth();
  const [notices, setNotices] = useState<AppNotice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seenAt, setSeenAt] = useState<string | null>(null);
  /** `ready` means the notice arrives even with the app closed. */
  const [push, setPush] = useState<PushState>('permission');
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const [rows, remoteSeen, localSeen] = await Promise.all([
        getNotices(session.user.id),
        loadNoticesSeen(),
        AsyncStorage.getItem(SEEN_KEY),
      ]);
      const seen = remoteSeen && (!localSeen || remoteSeen > localSeen) ? remoteSeen : localSeen;
      setNotices(rows);
      setSeenAt(seen);
    } catch {
      setError('No pudimos cargar tus avisos. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => { void pushCapability().then(setPush); }, []);

  async function turnOnPush() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushNote(null);
    const result = await enablePush();
    setPush(result);
    setPushBusy(false);
    if (result === 'ready') setPushNote('Listo: el aviso llega aunque la app esté cerrada.');
    else if (result === 'permission') setPushNote('El teléfono bloqueó los avisos. Actívalos en los ajustes del sistema.');
    else if (result === 'firebase' || result === 'project') setPushNote('Esta versión todavía no trae la configuración de Firebase, así que no puede recibirlos cerrada. Los verás aquí al abrir la app.');
    else if (result === 'unsupported') setPushNote('Este teléfono no puede recibir avisos con la app cerrada.');
    else setPushNote('No pudimos guardar el aviso del teléfono. Revisa tu conexión e inténtalo otra vez.');
  }

  /** One notice to this account's phones, to see that it really arrives. */
  async function tryPush() {
    if (testBusy || push !== 'ready') return;
    setTestBusy(true);
    setPushNote(null);
    const sent = await sendTestPush();
    setTestBusy(false);
    setPushNote(sent
      ? 'Aviso enviado. Cierra la app y espera unos segundos: te llegará abajo, junto a la hora.'
      : 'No pudimos enviar la prueba. Revisa tu conexión e inténtalo otra vez.');
  }

  useEffect(() => {
    if (!notices.length) return;
    const newest = notices[0].at;
    if (seenAt && seenAt >= newest) return;
    setSeenAt(newest);
    void AsyncStorage.setItem(SEEN_KEY, newest);
    void saveNoticesSeen(newest);
  }, [notices, seenAt]);

  const unread = seenAt ? notices.filter(item => item.at > seenAt).length : notices.length;

  return (
    <Screen
      back
      title="Avisos"
      description="Lo que pasó en tus salas mientras no estabas mirando."
      action={(
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Permisos y notificaciones"
          onPress={() => router.push('/perfil/permisos' as Href)}
          className="size-10 items-center justify-center rounded-full active:opacity-70">
          <Icon as={Settings2} className="text-foreground size-5" />
        </Pressable>
      )}>
      {loading ? (
        <View className="gap-2">{[0, 1, 2, 3].map(index => <RowSkeleton key={index} avatar={36} />)}</View>
      ) : error ? (
        <View className="border-destructive/30 bg-destructive/10 items-center gap-2 rounded-2xl border p-5">
          <Text className="text-foreground text-sm font-semibold">Sin conexión</Text>
          <Text className="text-muted-foreground text-center text-[12px] leading-4">{error}</Text>
          <Pressable accessibilityRole="button" onPress={() => void load()} className="bg-primary mt-1 h-10 items-center justify-center rounded-full px-5 active:bg-primary/80">
            <Text className="text-primary-foreground text-[12px] font-semibold">Reintentar</Text>
          </Pressable>
        </View>
      ) : notices.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Todavía no hay avisos"
          hint="Cuando alguien te envíe un regalo, te siga, abra una sala o escriba en la tuya, aparecerá aquí."
          className="mx-0"
        />
      ) : (
        <View className="gap-2">
          <Text className="text-muted-foreground ml-1 text-[11px]">
            {unread > 0 ? `${unread} nuevos` : 'Todo visto'}
          </Text>
          {notices.map(item => {
            const look = LOOK[item.kind];
            const fresh = seenAt ? item.at > seenAt : true;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${look.label}: ${item.title}. ${item.body}`}
                onPress={() => item.slug ? router.push(`/room/${item.slug}${item.code ? `?code=${item.code}` : ''}` as Href) : undefined}
                className={cn(
                  'border-border flex-row items-start gap-3 rounded-2xl border p-3.5 active:bg-muted',
                  fresh ? 'bg-card' : 'bg-background',
                )}>
                <View className={cn('size-9 items-center justify-center rounded-full', look.background)}>
                  <Icon as={look.icon} className={cn('size-4', look.tint)} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center gap-2">
                    <Text className="text-foreground flex-1 text-[13px] font-semibold" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-muted-foreground text-[11px]">{timeAgo(item.at)}</Text>
                  </View>
                  <Text className="text-muted-foreground mt-0.5 text-[12px] leading-4" numberOfLines={2}>{item.body}</Text>
                </View>
                {fresh ? <View className="bg-primary mt-1 size-2 rounded-full" /> : null}
              </Pressable>
            );
          })}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={push === 'ready' ? 'Los avisos del teléfono están activos. Abrir los permisos' : 'Activar los avisos del teléfono para recibirlos con la app cerrada'}
        disabled={pushBusy}
        onPress={() => { if (push === 'ready') router.push('/perfil/permisos' as Href); else void turnOnPush(); }}
        className="border-border bg-card flex-row items-center gap-3 rounded-2xl border p-4 active:bg-muted">
        <Icon as={Bell} className="text-primary size-4" />
        <View className="flex-1">
          <Text className="text-foreground text-[12px] font-medium">
            {push === 'ready'
              ? 'Avisos del teléfono activos'
              : push === 'firebase' || push === 'project'
                ? 'Falta Firebase en esta versión'
                : push === 'unsupported'
                  ? 'Avisos con la app cerrada'
                  : pushBusy
                    ? 'Activando…'
                    : 'Activar avisos del teléfono'}
          </Text>
          <Text className="text-muted-foreground mt-0.5 text-[11px] leading-4">
            {push === 'ready'
              ? 'Llegan aunque la app esté cerrada.'
              : push === 'firebase' || push === 'project'
                ? 'Esta versión no trae la configuración de Firebase.'
                : push === 'unsupported'
                  ? 'Este teléfono no los recibe cerrada.'
                : 'Para recibirlos aunque la app no esté abierta.'}
          </Text>
        </View>
        <Icon as={Settings2} className="text-muted-foreground size-4" />
      </Pressable>
      {pushNote ? (
        <Text className="text-muted-foreground mt-2 px-1 text-[11px] leading-4" role="alert">{pushNote}</Text>
      ) : null}
      {push === 'ready' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Enviar un aviso de prueba a este teléfono"
          disabled={testBusy}
          onPress={() => void tryPush()}
          className="border-border mt-2 h-10 items-center justify-center rounded-full border active:bg-muted">
          <Text className="text-foreground text-[12px] font-medium">
            {testBusy ? 'Enviando…' : 'Probar aviso en este teléfono'}
          </Text>
        </Pressable>
      ) : null}
    </Screen>
  );
}
