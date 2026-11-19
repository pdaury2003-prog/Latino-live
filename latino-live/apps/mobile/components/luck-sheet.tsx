import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, View } from 'react-native';
import { Dices, RotateCw, Sparkles } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { diceLine, drawSeat, postLuck, rollDice, seatLine } from '@/lib/luck';
import { cn } from '@/lib/utils';
import { useAccent } from '@/lib/theme-accent';

type Props = {
  visible: boolean;
  onClose: () => void;
  roomId: string | null;
  myName: string;
  /** Seat numbers that exist in this room, in the order they are drawn. */
  seatNumbers: number[];
  /** Who sits where, for the line the room reads. */
  occupantOf: (seat: number) => string | null;
  /** Only a person in a seat can draw: the room reads it as a fact. */
  seated: boolean;
};

/**
 * Suerte: a die and a draw of the room's own seats.
 *
 * Both are free and neither wins anything: they are the room's way to pick who
 * starts, which is what people ask for before a game. The result is written to
 * the room's chat, so every phone shows the same number.
 */
export function LuckSheet({ visible, onClose, roomId, myName, seatNumbers, occupantOf, seated }: Props) {
  const accent = useAccent();
  const [busy, setBusy] = useState<'dice' | 'seat' | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: 'dice' | 'seat') {
    if (!roomId || busy || !seated) return;
    setBusy(kind);
    setError(null);
    try {
      if (kind === 'dice') {
        const values = rollDice(1, 6);
        const line = diceLine(myName, values);
        await postLuck(roomId, line);
        // Shown once the room has it: a number nobody else saw is not a result.
        setResult(values[0]!.toString());
      } else {
        const seat = drawSeat(seatNumbers);
        if (seat === null) throw new Error('Todavía no hay asientos para sortear.');
        await postLuck(roomId, seatLine(myName, seat, occupantOf(seat)));
        setResult(String(seat));
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No pudimos publicar el resultado.');
    } finally {
      setBusy(null);
    }
  }

  const seats = seatNumbers.length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }}
        onPress={onClose}
        accessibilityLabel="Cerrar la suerte">
        <Pressable
          onPress={() => undefined}
          style={{
            backgroundColor: accent.raised, borderTopLeftRadius: 26, borderTopRightRadius: 26,
            borderWidth: 1, borderColor: accent.line, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28,
          }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: accent.hairline, alignSelf: 'center', marginBottom: 14 }} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View className="size-9 items-center justify-center rounded-full" style={{ backgroundColor: accent.wash }}>
              <Icon as={Sparkles} size={16} color={accent.main} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: accent.text, fontSize: 17, fontWeight: '700' }}>Suerte de la sala</Text>
              <Text style={{ color: '#B3A897', fontSize: 11.5, marginTop: 2 }}>
                Nadie paga y nadie gana: se sortea quién empieza.
              </Text>
            </View>
          </View>

          {!seated ? (
            <View
              className="mt-4 rounded-2xl px-3 py-3"
              style={{ backgroundColor: accent.wash, borderWidth: 1, borderColor: accent.line }}>
              <Text style={{ color: accent.text, fontSize: 13, fontWeight: '600' }}>Siéntate para jugar</Text>
              <Text style={{ color: '#B3A897', fontSize: 11.5, marginTop: 3, lineHeight: 17 }}>
                La sala lee el resultado con tu nombre, así que primero tienes que ocupar un asiento.
              </Text>
            </View>
          ) : result ? (
            <View
              className="mt-4 items-center rounded-2xl py-4"
              style={{ backgroundColor: 'rgba(255,194,75,0.10)', borderWidth: 1, borderColor: 'rgba(255,194,75,0.35)' }}>
              <Text style={{ color: '#B3A897', fontSize: 11, letterSpacing: 1.6 }}>RESULTADO</Text>
              <Text style={{ color: accent.text, fontSize: 40, fontWeight: '800', lineHeight: 46 }}>{result}</Text>
              <Text style={{ color: '#B3A897', fontSize: 11.5 }}>Toda la sala lo vio en el chat</Text>
            </View>
          ) : null}

          {error && seated ? <Text style={{ color: '#F0847C', fontSize: 12, marginTop: 10 }}>{error}</Text> : null}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tirar un dado"
              accessibilityState={{ disabled: Boolean(busy) || !seated }}
              disabled={Boolean(busy) || !seated}
              onPress={() => void run('dice')}
              className={cn('flex-1 items-center justify-center gap-1 rounded-2xl py-3 active:opacity-85', busy || !seated ? 'opacity-40' : '')}
              style={{ backgroundColor: accent.main }}>
              {busy === 'dice' ? (
                <ActivityIndicator size="small" color={accent.ink} />
              ) : (
                <Icon as={Dices} size={20} color={accent.ink} />
              )}
              <Text style={{ color: accent.ink, fontSize: 12.5, fontWeight: '700' }}>Tirar dado</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Girar la ruleta entre ${seats} asientos`}
              accessibilityState={{ disabled: Boolean(busy) || seats === 0 || !seated }}
              disabled={Boolean(busy) || seats === 0 || !seated}
              onPress={() => void run('seat')}
              className={cn('flex-1 items-center justify-center gap-1 rounded-2xl border py-3 active:opacity-85', seats === 0 || !seated ? 'opacity-40' : '')}
              style={{ borderColor: 'rgba(255,194,75,0.45)', backgroundColor: 'rgba(255,194,75,0.10)' }}>
              {busy === 'seat' ? (
                <ActivityIndicator size="small" color={accent.main} />
              ) : (
                <Icon as={RotateCw} size={20} color={accent.main} />
              )}
              <Text style={{ color: accent.main, fontSize: 12.5, fontWeight: '700' }}>
                {seats > 0 ? `Ruleta de ${seats}` : 'Ruleta'}
              </Text>
            </Pressable>
          </View>

          <Text style={{ color: '#8A7A96', fontSize: 11, marginTop: 10, lineHeight: 15 }}>
            El dado va del 1 al 6. La ruleta elige uno de los asientos abiertos de esta sala y dice quién está en él.
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
