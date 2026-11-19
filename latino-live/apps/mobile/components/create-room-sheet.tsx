import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ImageBackground, Modal, Pressable, ScrollView, TextInput, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, LayoutGrid, Mic, Plus, Users, Video, X } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { COVER_OPTIONS, coverSource, type CoverKey } from '@/lib/covers';
import { LayoutDots } from '@/components/room-layout-stage';
import { ROOM_LAYOUTS, layoutCapacity, roomLayout, type RoomLayout } from '@/lib/room-layouts';
import { cn } from '@/lib/utils';
import { useAccent } from '@/lib/theme-accent';

type Props = {
  visible: boolean;
  pending: boolean;
  defaultTitle: string;
  error: string | null;
  onClose: () => void;
  onCreate: (title: string, cover: CoverKey, shape: { layout: string | null; seats: number; mode: 'audio' | 'camera' }) => void;
};

/** The squares a camera hall is built from; a voice hall does not offer them. */
const CAMERA_SQUARES = ['square4', 'square6', 'square10'];

const SUGGESTIONS = ['Noche en el palacio', 'Café de la madrugada', 'Risas y confesiones'];

/** The sheet for naming a room and choosing the picture people see in the catalogue. */
export function CreateRoomSheet({ visible, pending, defaultTitle, error, onClose, onCreate }: Props) {
  const accent = useAccent();
  const { height } = useWindowDimensions();
  const [title, setTitle] = useState(defaultTitle);
  const [cover, setCover] = useState<CoverKey>('palace');
  /**
   * The kind of hall. A voice room keeps the round seats the app always had;
   * a camera room draws square places that hold a live picture.
   */
  const [mode, setMode] = useState<'audio' | 'camera'>('audio');
  // The seat arrangement: the plain grid of ten, or one of the drawn shapes
  // with its own number of places.
  const [layoutId, setLayoutId] = useState<string | null>(null);
  // The strip of shapes slides to whichever one was chosen, so the card the
  // person touched is never left half hidden at the edge.
  const shapes = useRef<ScrollView | null>(null);

  function choose(layout: string | null) {
    setLayoutId(layout);
    const index = layout === null ? 0 : ROOM_LAYOUTS.findIndex(item => item.id === layout) + 1;
    shapes.current?.scrollTo({ x: Math.max(0, index * 72 - 60), animated: true });
  }

  useEffect(() => {
    if (visible) setTitle(defaultTitle);
  }, [visible, defaultTitle]);

  const shape: RoomLayout | null = roomLayout(layoutId);
  const places = shape ? layoutCapacity(shape) : 10;
  // The camera hall is made of the squares of four, six and ten. Choosing it
  // points the shape row at such a square, so the room opens with one.
  function chooseMode(next: 'audio' | 'camera') {
    setMode(next);
    // The camera squares belong to the camera hall; the voice hall keeps the
    // shapes it had. Switching between them never leaves a shape behind that
    // the chosen hall cannot show.
    const isSquare = (id: string | null) => Boolean(id && CAMERA_SQUARES.includes(id));
    if (next === 'camera') {
      if (!isSquare(layoutId)) {
        const square = roomLayout('square6');
        setLayoutId(square ? square.id : null);
      }
      return;
    }
    if (isSquare(layoutId)) setLayoutId(null);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/60" onPress={onClose} accessibilityLabel="Cerrar creación de sala">
        <Pressable className="border-border bg-card rounded-t-[28px] border px-5 pb-8 pt-3" onPress={() => undefined}>
          <View className="bg-border mx-auto mb-4 h-1 w-10 rounded-full" />
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1">
              <Text className="text-foreground text-lg font-semibold">Abre tu sala</Text>
              <Text className="text-muted-foreground mt-1 text-xs">Ponle un nombre y elige la portada y la forma de los asientos.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} className="border-border bg-background size-9 items-center justify-center rounded-full border active:opacity-70">
              <Icon as={X} className="text-foreground size-4" />
            </Pressable>
          </View>

          {/* A short phone cannot show the whole sheet at once: the body
              scrolls while the button to open the room stays in place. */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: Math.max(300, height * 0.62) }}
            contentContainerStyle={{ paddingBottom: 6 }}
            keyboardShouldPersistTaps="handled">
          <View className="border-border bg-background mt-4 rounded-2xl border px-4 py-2.5">
            <Text className="text-muted-foreground text-[11px]">Nombre de la sala</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Por ejemplo, Noche de risas"
              placeholderTextColor="#8A8073"
              maxLength={60}
              autoFocus
              accessibilityLabel="Nombre de la sala"
              className="text-foreground mt-0.5 text-[15px] font-medium"
              style={{ paddingVertical: 2 }}
            />
          </View>

          {/* One line of names: the sheet has to leave room for the shapes
              without pushing its own button off a short phone. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2" contentContainerClassName="gap-1.5 pr-2">
            {SUGGESTIONS.map(suggestion => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                accessibilityLabel={`Usar el nombre ${suggestion}`}
                onPress={() => setTitle(suggestion)}
                className="border-border bg-background rounded-full border px-3 py-1.5 active:bg-muted">
                <Text className="text-muted-foreground text-[11px]">{suggestion}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text className="text-muted-foreground mb-2 mt-4 text-[11px] tracking-wide">PORTADA</Text>
          <View className="flex-row gap-2">
            {COVER_OPTIONS.map(option => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityState={{ selected: cover === option.key }}
                accessibilityLabel={`Portada ${option.label}`}
                onPress={() => setCover(option.key)}
                className={cn('flex-1 overflow-hidden rounded-xl border-2 active:opacity-80', cover === option.key ? 'border-primary' : 'border-transparent')}>
                <ImageBackground source={coverSource(option.key)} className="h-16 justify-end p-2">
                  <LinearGradient colors={['rgba(10,9,8,0)', 'rgba(10,9,8,0.85)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 34 }} />
                  <Text className="text-foreground text-[11px] font-medium">{option.label}</Text>
                </ImageBackground>
              </Pressable>
            ))}
          </View>

          {/* The two kinds of hall, side by side: the voice room with its round
              seats, and the camera room with its square picture places. */}
          <Text className="text-muted-foreground mb-2 mt-4 text-[11px] tracking-wide">MODO DE LA SALA</Text>
          <View className="flex-row gap-2">
            {([
              { key: 'audio' as const, label: 'Multi de audio', note: 'Asientos redondos', art: Mic },
              { key: 'camera' as const, label: 'Multi de cámara', note: 'Asientos cuadrados', art: Video },
            ]).map(option => {
              const active = mode === option.key;
              const Art = option.art;
              return (
                <Pressable
                  key={option.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${option.label}, ${option.note}`}
                  accessibilityState={{ selected: active }}
                  onPress={() => chooseMode(option.key)}
                  className={cn(
                    'flex-1 gap-1 rounded-xl border px-3 py-2.5 active:opacity-85',
                    active ? 'border-primary bg-primary/12' : 'border-border bg-background',
                  )}>
                  <View className="flex-row items-center gap-1.5">
                    <Art size={13} color={active ? accent.main : '#A79E8F'} />
                    <Text className={cn('text-[12px] font-semibold', active ? 'text-primary' : 'text-foreground')}>
                      {option.label}
                    </Text>
                  </View>
                  <Text className="text-muted-foreground text-[11px]">{option.note}</Text>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-4 flex-row items-center gap-1.5">
            <Icon as={mode === 'camera' ? Camera : LayoutGrid} className="text-primary size-3.5" />
            <Text className="text-muted-foreground text-[11px] tracking-wide">FORMA DE LOS ASIENTOS</Text>
            <View className="bg-muted ml-auto flex-row items-center gap-1 rounded-full px-2 py-0.5">
              <Icon as={Users} size={10} className="text-muted-foreground" />
              <Text className="text-muted-foreground text-[11px] font-medium tabular-nums">{places}</Text>
            </View>
          </View>
          {/* The shapes sit in one row that slides sideways, the way the room's
              own controls do: the sheet stays short and no name is cut. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mt-2"
            contentContainerClassName="gap-2 pr-2"
            ref={row => { shapes.current = row; }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Asientos en cuadrícula, diez lugares"
              accessibilityState={{ selected: layoutId === null }}
              onPress={() => choose(null)}
              className={cn(
                'w-[64px] items-center gap-1 rounded-xl border px-1 py-1.5 active:opacity-80',
                layoutId === null ? 'border-primary bg-primary/12' : 'border-border bg-background',
              )}>
              <View className="bg-secondary h-[46px] w-full items-center justify-center rounded-[10px]">
                <Icon as={Users} size={18} className={layoutId === null ? 'text-primary' : 'text-muted-foreground'} />
              </View>
              <Text
                numberOfLines={2}
                className={cn('text-center text-[11px] leading-[13px] font-medium', layoutId === null ? 'text-primary' : 'text-muted-foreground')}>
                Rejilla
              </Text>
            </Pressable>
            {ROOM_LAYOUTS.filter(item => mode === 'camera' || !CAMERA_SQUARES.includes(item.id)).map(item => {
              const active = layoutId === item.id;
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Asientos ${item.name}, ${layoutCapacity(item)} lugares`}
                  accessibilityState={{ selected: active }}
                  onPress={() => choose(item.id)}
                  className={cn(
                    'w-[64px] items-center gap-1 rounded-xl border px-1 py-1.5 active:opacity-80',
                    active ? 'border-primary bg-primary/12' : 'border-border bg-background',
                  )}>
                  <View className="h-[46px] w-full">
                    <LayoutDots layout={item} fill />
                  </View>
                  <Text
                    numberOfLines={2}
                    className={cn('text-center text-[11px] leading-[13px] font-medium', active ? 'text-primary' : 'text-muted-foreground')}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {error ? <Text className="text-destructive mt-3 text-[11px]">{error}</Text> : null}
          </ScrollView>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crear la sala"
            disabled={pending || !title.trim()}
            onPress={() => onCreate(title.trim(), cover, { layout: layoutId, seats: places, mode })}
            className={cn('mt-4 h-12 flex-row items-center justify-center gap-1.5 rounded-full active:opacity-90', title.trim() ? 'bg-primary' : 'bg-muted')}>
            {pending ? <ActivityIndicator size="small" color={accent.ink} /> : <Icon as={Plus} className={cn('size-4', title.trim() ? 'text-primary-foreground' : 'text-muted-foreground')} />}
            <Text className={cn('text-sm font-semibold', title.trim() ? 'text-primary-foreground' : 'text-muted-foreground')}>
              {pending ? 'Abriendo la sala…' : 'Crear sala'}
            </Text>
          </Pressable>

          <View className="mt-3 flex-row items-center gap-1.5">
            <Icon as={Mic} className="text-muted-foreground size-3.5" />
            <Text className="text-muted-foreground flex-1 text-[11px]">Después podrás compartir el enlace para que entren tus amigos.</Text>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
