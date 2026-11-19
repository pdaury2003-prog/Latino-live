import { SafeAreaView } from 'react-native-safe-area-context';
import { SvipStore } from '@/components/svip-store';

export default function TiendaSvip() {
  return (
    <SafeAreaView edges={['top']} className="flex-1" style={{ backgroundColor: '#08070A' }}>
      <SvipStore />
    </SafeAreaView>
  );
}
