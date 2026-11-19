import { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type Href } from 'expo-router';
import { pickPhotoFromLibrary } from '@/lib/pick-photo';
import { Camera, ImagePlus, Send, Sparkles, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { goBack } from '@/components/screen';
import { useAuth } from '@/features/auth';
import { publishMoment } from '@/lib/moments';
import { cn } from '@/lib/utils';

const IDEAS = [
  'La sala estaba increíble anoche.',
  '¿Quién se apunta al bingo de medianoche?',
  'Gracias por la conversación de hoy.',
];

export default function Publicar() {
  const { session } = useAuth();
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; mimeType?: string | null } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickPhoto() {
    setError(null);
    try {
      const picked = await pickPhotoFromLibrary({ aspect: [4, 3], quality: 0.8 });
      if (picked.status === 'unavailable') {
        setError('La galería no está disponible en esta versión. Instala la más reciente.');
        return;
      }
      if (picked.status === 'failed') {
        setError('No pudimos abrir la galería. Inténtalo de nuevo.');
        return;
      }
      if (picked.status !== 'picked') return;
      setPhoto(picked.photo);
    } catch {
      setError('No pudimos abrir la galería. Inténtalo de nuevo.');
    }
  }

  async function publish() {
    if (!session?.user.id || pending) return;
    if (!text.trim() && !photo) {
      setError('Escribe algo o elige una foto para publicar.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      await publishMoment(session.user.id, text, photo);
      router.replace('/momentos' as Href);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos publicar. Inténtalo otra vez.');
    } finally {
      setPending(false);
    }
  }

  return (
    <SafeAreaView className="bg-background flex-1" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-2">
        <Pressable accessibilityRole="button" accessibilityLabel="Volver" onPress={goBack} className="border-border bg-card size-10 items-center justify-center rounded-full border active:opacity-70">
          <Icon as={X} className="text-foreground size-4" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-foreground text-[17px] font-semibold">Nuevo momento</Text>
          <Text className="text-muted-foreground text-[11px]">Se verá en el círculo de la comunidad</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Publicar el momento"
          accessibilityState={{ disabled: pending || (!text.trim() && !photo) }}
          onPress={() => void publish()}
          disabled={pending || (!text.trim() && !photo)}
          className={cn('h-10 flex-row items-center gap-1.5 rounded-full px-4 active:opacity-90', text.trim() || photo ? 'bg-primary' : 'bg-muted')}>
          {pending ? <ActivityIndicator size="small" color="#1A1409" /> : <Icon as={Send} className={cn('size-3.5', text.trim() || photo ? 'text-primary-foreground' : 'text-muted-foreground')} />}
          <Text className={cn('text-[13px] font-semibold', text.trim() || photo ? 'text-primary-foreground' : 'text-muted-foreground')}>
            {pending ? 'Publicando…' : 'Publicar'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="gap-3 px-5 pb-8 pt-1" keyboardShouldPersistTaps="handled">
        {photo ? (
          <View className="border-border overflow-hidden rounded-2xl border">
            <Image source={{ uri: photo.uri }} resizeMode="cover" className="h-[220px] w-full" />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Quitar la foto"
              onPress={() => setPhoto(null)}
              className="bg-background/85 absolute right-2.5 top-2.5 size-9 items-center justify-center rounded-full active:opacity-80">
              <Icon as={X} className="text-foreground size-4" />
            </Pressable>
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Elegir una foto del dispositivo"
            onPress={() => void pickPhoto()}
            className="border-border bg-card h-[180px] items-center justify-center gap-2 rounded-2xl border border-dashed active:bg-muted">
            <View className="bg-primary/15 size-12 items-center justify-center rounded-full">
              <Icon as={ImagePlus} className="text-primary size-5" />
            </View>
            <Text className="text-foreground text-[13px] font-medium">Elegir una foto</Text>
            <Text className="text-muted-foreground text-[11px]">Desde la galería de tu teléfono</Text>
          </Pressable>
        )}

        <View className="border-border bg-card rounded-2xl border px-4 py-3">
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Cuéntale a la sala qué pasó…"
            placeholderTextColor="#8A8073"
            multiline
            maxLength={500}
            accessibilityLabel="Texto del momento"
            className="text-foreground min-h-[96px] text-[14px] leading-6"
            style={{ textAlignVertical: 'top' }}
          />
          <Text className="text-muted-foreground mt-1 self-end text-[11px] tabular-nums">{text.length}/500</Text>
        </View>

        {photo ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar la foto" onPress={() => void pickPhoto()} className="border-border h-11 flex-row items-center justify-center gap-1.5 rounded-full border active:bg-muted">
            <Icon as={Camera} className="text-foreground size-4" />
            <Text className="text-foreground text-[12px] font-medium">Cambiar la foto</Text>
          </Pressable>
        ) : null}

        <View className="flex-row flex-wrap gap-1.5">
          {IDEAS.map(idea => (
            <Pressable
              key={idea}
              accessibilityRole="button"
              accessibilityLabel={`Usar la idea ${idea}`}
              onPress={() => setText(idea)}
              className="border-border bg-card rounded-full border px-3 py-1.5 active:bg-muted">
              <Text className="text-muted-foreground text-[11px]">{idea}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text className="text-destructive text-center text-[11px]">{error}</Text> : null}

        <View className="flex-row items-start gap-2 rounded-2xl bg-muted/50 px-4 py-3">
          <Icon as={Sparkles} className="text-primary mt-0.5 size-3.5" />
          <Text className="text-muted-foreground flex-1 text-[11px] leading-4">
            Respeta a los demás. Nada de contenido para adultos, apuestas ni política. Tu foto se guarda en la nube y se ve en la comunidad.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
