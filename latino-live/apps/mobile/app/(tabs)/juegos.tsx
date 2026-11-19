import { CATALOG_MAX } from '@/lib/responsive';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import { Car, Clock, Crown, Dices, Fish, Flag, Grid3x3, Sparkles, Swords, Trophy } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { DominoTile } from '@/components/domino-tile';
import { TabHeader } from '@/components/state-views';

const GAMES = [
  { title: 'Ajedrez', detail: 'Duelo de estrategia', icon: Swords, tint: 'rgba(148,163,184,0.18)' },
  { title: 'Ludo', detail: 'Cuatro colores, una meta', icon: Flag, tint: 'rgba(96,165,250,0.18)' },
  { title: 'Bingo de la sala', detail: 'Con tus amigos', icon: Grid3x3, tint: 'rgba(94,180,150,0.16)' },
  { title: 'Reina del Salón', detail: 'Juego de mesa', icon: Crown, tint: 'rgba(255,194,75,0.16)' },
  { title: 'Superauto', detail: 'Carreras de lujo', icon: Car, tint: 'rgba(255,194,75,0.16)' },
  { title: 'Maestro de Pesca', detail: 'Atrapa la suerte', icon: Fish, tint: 'rgba(94,180,150,0.16)' },
] as const;

export default function Juegos() {
  return (
    <SafeAreaView edges={['top']} className="bg-background flex-1">
      <ScrollView contentContainerClassName="pb-28"
        contentContainerStyle={{ width: '100%', maxWidth: CATALOG_MAX, alignSelf: 'center' }} showsVerticalScrollIndicator={false}>
        <TabHeader
          title="Juegos"
          subtitle="Compite con la sala, comparte la risa"
          action={(
            <View className="border-border bg-card h-9 flex-row items-center gap-1.5 rounded-full border px-3">
              <Icon as={Trophy} className="text-primary size-3.5" />
              <Text className="text-foreground text-xs font-semibold">Sin apuestas</Text>
            </View>
          )}
        />

        <View className="px-5">
          <View className="border-primary/25 overflow-hidden rounded-[24px] border">
            <LinearGradient
              colors={['#1C4A36', '#12301F', '#0C1712']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            <View style={{ position: 'absolute', right: 16, top: 30, flexDirection: 'row', gap: 6 }}>
              <View style={{ transform: [{ rotate: '-13deg' }], opacity: 0.85 }}>
                <DominoTile tile="4-2" width={34} height={62} />
              </View>
              <View style={{ transform: [{ rotate: '9deg' }], marginTop: 12 }}>
                <DominoTile tile="6-6" width={34} height={62} />
              </View>
            </View>
            <View className="gap-3 p-5 pr-24">
              <View className="border-primary/35 bg-primary/15 flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1">
                <Icon as={Dices} className="text-primary size-3" />
                <Text className="text-primary text-[11px] font-semibold tracking-wide">YA SE PUEDE JUGAR</Text>
              </View>
              <Text className="text-foreground text-[23px] font-semibold leading-[1.15]">Dominó de la casa.</Text>
              <Text className="text-foreground/65 text-[12px] leading-5">
                Mesa de 2 o 4 jugadores, turnos de verdad y una mano privada. Abre la tuya y compártela con la sala.
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Jugar dominó"
                onPress={() => router.push('/juegos/domino' as Href)}
                className="bg-primary h-11 flex-row items-center justify-center gap-1.5 self-start rounded-full px-4 active:opacity-85">
                <Icon as={Dices} className="text-primary-foreground size-4" />
                <Text className="text-primary-foreground text-[13px] font-semibold">Jugar dominó</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View className="flex-row items-center gap-2 px-5 pb-3 pt-6">
          <Icon as={Clock} className="text-primary size-4" />
          <Text className="text-foreground text-base font-semibold">Próximamente</Text>
        </View>

        <View className="flex-row flex-wrap justify-between gap-y-3 px-5">
          {GAMES.map(game => (
            <View key={game.title} className="border-border bg-card w-[48.5%] rounded-[20px] border p-3.5">
              <View className="flex-row items-start justify-between">
                <View className="size-10 items-center justify-center rounded-full" style={{ backgroundColor: game.tint }}>
                  <Icon as={game.icon} className="text-primary size-4" />
                </View>
                <View className="border-border bg-background/60 rounded-full border px-2 py-0.5">
                  <Text className="text-muted-foreground text-[11px]">Pronto</Text>
                </View>
              </View>
              <Text className="text-foreground mt-3 text-[14px] font-semibold" numberOfLines={1}>{game.title}</Text>
              <Text className="text-muted-foreground mt-0.5 text-[11px]" numberOfLines={1}>{game.detail}</Text>
            </View>
          ))}
        </View>

        <View className="mx-5 mt-5 flex-row items-center gap-2 rounded-2xl bg-muted/50 px-4 py-3">
          <Icon as={Sparkles} className="text-primary size-3.5" />
          <Text className="text-muted-foreground flex-1 text-[11px] leading-4">
            Ajedrez y ludo llegan después. Todos los juegos son por diversión: no hay apuestas ni premios en dinero.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
