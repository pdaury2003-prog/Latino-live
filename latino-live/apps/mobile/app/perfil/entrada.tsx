import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Clapperboard, Clock, Play, Trash2 } from 'lucide-react-native';
import { router, type Href } from 'expo-router';
import { Screen } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useAuth } from '@/features/auth';
import { Notice } from '@/components/state-views';
import { getProfile, type ProfileRow } from '@/lib/rooms';
import { clearEntryVideo, ENTRY_VIDEO_DAYS, entryVideoDaysLeft, liveEntryVideo, uploadEntryVideo } from '@/lib/entry-video';
import { MAX_ENTRY_VIDEO_SECONDS, pickVideoFromLibrary } from '@/lib/pick-video';

/**
 * La entrada con video: un clip corto de la persona que se reproduce cuando
 * entra a una sala. Dura quince días y se puede apagar antes.
 */
export default function EntradaVideo() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = liveEntryVideo(profile);
  const daysLeft = entryVideoDaysLeft(profile);
  const player = useVideoPlayer(url, instance => {
    instance.loop = true;
    instance.muted = true;
  });

  const load = useCallback(async () => {
    if (!session?.user.id) { setLoading(false); return; }
    try {
      setProfile(await getProfile(session.user.id));
    } catch {
      setError('No pudimos cargar tu perfil. Revisa tu conexión.');
    } finally {
      setLoading(false);
    }
  }, [session?.user.id]);

  useEffect(() => { void load(); }, [load]);

  async function choose() {
    if (!session?.user.id || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const picked = await pickVideoFromLibrary();
      if (picked.status === 'canceled') return;
      if (picked.status === 'unavailable') throw new Error('Este teléfono no puede elegir videos.');
      if (picked.status === 'failed') throw new Error('No pudimos abrir tus videos. Inténtalo otra vez.');
      if (picked.tooLong) {
        throw new Error(`Ese video dura más de ${MAX_ENTRY_VIDEO_SECONDS} segundos. Elige uno más corto.`);
      }
      await uploadEntryVideo(session.user.id, picked.video);
      setNotice(`Tu entrada está activa por ${ENTRY_VIDEO_DAYS} días.`);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos guardar tu video.');
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await clearEntryVideo();
      setNotice('Tu entrada con video está apagada.');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos apagarla.');
    } finally {
      setBusy(false);
    }
  }

  if (!session) {
    return (
      <Screen back title="Entrada con video" description="Entra con tu propio clip en cualquier sala.">
        <View className="border-border bg-card items-center gap-3 rounded-[22px] border px-6 py-9">
          <Text className="text-foreground text-center text-[14px] font-semibold">Entra con tu cuenta</Text>
          <Text className="text-muted-foreground text-center text-[12.5px] leading-5">
            Tu video de entrada vive en tu perfil, así que necesitas una cuenta para guardarlo.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/entrar' as Href)}
            className="bg-primary mt-1 h-11 w-full items-center justify-center rounded-full active:opacity-85">
            <Text className="text-primary-foreground text-[13px] font-semibold">Entrar o crear cuenta</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen back title="Entrada con video" description="Un clip corto tuyo que se ve cuando entras a una sala.">
      {loading ? <ActivityIndicator className="mt-6" /> : null}

      {notice ? <Notice tone="success" text={notice} className="mx-0" /> : null}
      {error ? <Notice tone="error" text={error} className="mx-0" /> : null}

      {url ? (
        <View className="border-border bg-card overflow-hidden rounded-[22px] border">
          <View style={{ height: 220, backgroundColor: '#1E1529' }}>
            <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls={false} />
          </View>
          <View className="gap-1 p-4">
            <View className="flex-row items-center gap-1.5">
              <Icon as={Clock} size={13} className="text-primary" />
              <Text className="text-foreground text-[13px] font-semibold">
                {daysLeft > 0 ? `Activa · ${daysLeft} ${daysLeft === 1 ? 'día' : 'días'} restantes` : 'Activa'}
              </Text>
            </View>
            <Text className="text-muted-foreground text-[11.5px] leading-4">
              Se reproduce en silencio cuando alguien te ve entrar. Solo lo ve la sala, no se publica en tu perfil.
            </Text>
          </View>
        </View>
      ) : (
        <View className="border-border bg-card items-center gap-2 rounded-[22px] border px-6 py-8">
          <View className="bg-primary/15 size-14 items-center justify-center rounded-full">
            <Icon as={Clapperboard} className="text-primary size-6" />
          </View>
          <Text className="text-foreground text-center text-[15px] font-semibold">Todavía no tienes entrada</Text>
          <Text className="text-muted-foreground text-center text-[12.5px] leading-5">
            Elige un video de hasta {MAX_ENTRY_VIDEO_SECONDS} segundos y se verá cada vez que entres a una sala durante{' '}
            {ENTRY_VIDEO_DAYS} días.
          </Text>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={url ? 'Cambiar mi video de entrada' : 'Elegir mi video de entrada'}
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => void choose()}
        className="bg-primary mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full active:opacity-85">
        {busy ? <ActivityIndicator size="small" color="#2A1B46" /> : <Icon as={url ? Clapperboard : Play} className="text-primary-foreground size-4" />}
        <Text className="text-primary-foreground text-[13.5px] font-semibold">
          {url ? 'Cambiar el video' : 'Elegir un video'}
        </Text>
      </Pressable>

      {url ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Apagar mi video de entrada"
          disabled={busy}
          onPress={() => void clear()}
          className="border-border mt-2 h-12 flex-row items-center justify-center gap-2 rounded-full border active:bg-muted">
          <Icon as={Trash2} className="text-muted-foreground size-4" />
          <Text className="text-foreground text-[13px] font-semibold">Apagarla ahora</Text>
        </Pressable>
      ) : null}

      <Text className="text-muted-foreground mt-4 text-[11px] leading-4">
        El video se guarda en tu cuenta y se borra si eliminas la cuenta. Se reproduce en silencio, sin sonido, para no
        interrumpir la sala.
      </Text>
    </Screen>
  );
}
