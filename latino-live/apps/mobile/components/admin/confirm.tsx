import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '@/components/ui/text';

export type ConfirmRequest = {
  title: string;
  body: string;
  action: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

/**
 * Una confirmación de la propia app, no del sistema: se ve y se comporta igual
 * en el teléfono y en la vista previa, y el botón muestra el trabajo en curso.
 */
export function ConfirmDialog({
  request,
  busy,
  onCancel,
  onConfirm,
}: {
  request: ConfirmRequest | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text className="text-foreground text-[17px] font-semibold">{request?.title ?? ''}</Text>
          <Text className="text-muted-foreground mt-1.5 text-[12.5px] leading-5">{request?.body ?? ''}</Text>
          <View className="mt-5 flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
              disabled={busy}
              onPress={onCancel}
              className="border-border h-12 flex-1 items-center justify-center rounded-full border active:bg-muted disabled:opacity-50">
              <Text className="text-foreground text-[13px] font-semibold">Cancelar</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={request?.action ?? 'Confirmar'}
              disabled={busy}
              onPress={onConfirm}
              className={`h-12 flex-1 flex-row items-center justify-center gap-2 rounded-full active:opacity-85 disabled:opacity-50 ${request?.destructive ? 'bg-destructive/15' : 'bg-primary'}`}>
              {busy ? <ActivityIndicator size="small" color={request?.destructive ? '#F0847C' : '#2A1B46'} /> : null}
              <Text className={`text-[13px] font-semibold ${request?.destructive ? 'text-destructive' : 'text-primary-foreground'}`}>
                {request?.action ?? 'Confirmar'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,5,0.76)', justifyContent: 'center', paddingHorizontal: 20 },
  sheet: {
    backgroundColor: '#14110E',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.24)',
    padding: 20,
  },
});
