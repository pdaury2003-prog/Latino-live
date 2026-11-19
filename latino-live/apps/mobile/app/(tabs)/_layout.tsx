import { Tabs } from 'expo-router';
import { CircleUserRound, Gamepad2, House, Images, MessageCircle } from 'lucide-react-native';
import { TabBar } from '@/components/tab-bar';
import { useDesignTheme } from '@/features/design-theme';

const icons = {
  // The billboard of rooms is the house; a moon said "night", not "salas".
  index: House,
  juegos: Gamepad2,
  // Momentos son fotos de la gente: una brújula no lo decía.
  momentos: Images,
  mensajes: MessageCircle,
  perfil: CircleUserRound,
};

export default function TabsLayout() {
  const { colorScheme } = useDesignTheme();
  // The navigator's own surface sits behind every tab; a transparent one would
  // show the phone's white window while a tab slides in.
  const surface = colorScheme === 'light' ? '#F1EFEA' : '#080607';
  return (
    <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: surface } }} tabBar={props => <TabBar {...props} icons={icons} />}>
      <Tabs.Screen name="index" options={{ title: 'Salas' }} />
      <Tabs.Screen name="juegos" options={{ title: 'Juegos' }} />
      <Tabs.Screen name="momentos" options={{ title: 'Momentos' }} />
      <Tabs.Screen name="mensajes" options={{ title: 'Mensajes' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
