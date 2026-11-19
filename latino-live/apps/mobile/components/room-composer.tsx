import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import { Camera, Send } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

type Props = {
  /** Sin sesión el campo solo invita a entrar. */
  signedIn: boolean;
  sending: boolean;
  photoBusy: boolean;
  /** Envía el texto; devuelve false si no salió, para no perder lo escrito. */
  onSend: (text: string) => Promise<boolean>;
  /** Manda una foto con el texto como pie; false deja el texto en su sitio. */
  onPhoto: (caption: string) => Promise<boolean>;
};

/**
 * El campo de chat de la sala vive en su propio componente: escribir cambia
 * solo este campo, no los veinte asientos ni el reproductor que están encima.
 */
export function RoomComposer({ signedIn, sending, photoBusy, onSend, onPhoto }: Props) {
  const [text, setText] = useState('');
  const canSend = Boolean(text.trim()) && !sending;

  async function send() {
    const clean = text.trim();
    if (!clean || sending) return;
    setText('');
    const sent = await onSend(clean);
    if (!sent) setText(clean);
  }

  async function photo() {
    if (sending || photoBusy) return;
    const caption = text.trim();
    const sent = await onPhoto(caption);
    if (sent) setText('');
  }

  return (
    <View className="border-border bg-card h-11 flex-1 flex-row items-center rounded-full border px-4">
      <TextInput
        value={text}
        onChangeText={setText}
        onSubmitEditing={() => void send()}
        placeholder={signedIn ? 'Di algo…' : 'Entra para escribir…'}
        placeholderTextColor="#8A8073"
        returnKeyType="send"
        maxLength={400}
        accessibilityLabel="Escribir un mensaje para la sala"
        className="text-foreground flex-1 text-[14px]"
        // minWidth lets the field shrink inside its row: without it the text
        // pushed the camera and send buttons out of the pill.
        style={{ paddingVertical: 0, minWidth: 0 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar una foto al chat"
        onPress={() => void photo()}
        disabled={photoBusy}
        className="mr-2 active:opacity-60">
        {photoBusy ? <ActivityIndicator size="small" color="#FFC24B" /> : <Icon as={Camera} className="text-muted-foreground size-4" />}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Enviar mensaje"
        onPress={() => void send()}
        disabled={!canSend}
        className="size-8 items-center justify-center rounded-full active:scale-95"
        style={{ backgroundColor: '#EAC386', opacity: canSend ? 1 : 0.35 }}>
        {sending ? <ActivityIndicator size="small" color="#302216" /> : <Icon as={Send} size={14} color="#302216" />}
      </Pressable>
    </View>
  );
}
