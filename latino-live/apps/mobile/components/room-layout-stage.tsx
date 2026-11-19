import { useState } from 'react';
import { View } from 'react-native';
import { layoutFrame, type RoomLayout } from '@/lib/room-layouts';

/**
 * The small picture of a layout for the host's list: one dot per place, the
 * host's in gold. It shows where the seats stand and nothing else, because
 * that is all a layout changes.
 *
 * With `fill` it takes the width of its box and measures it, so the same
 * drawing works in a fixed preview and in a card that grows with the sheet.
 */
export function LayoutDots({ layout, size = 58, fill = false }: { layout: RoomLayout; size?: number; fill?: boolean }) {
  const [measured, setMeasured] = useState(0);
  const box = fill ? measured : size;
  return (
    <View
      onLayout={fill ? event => setMeasured(event.nativeEvent.layout.width) : undefined}
      style={{
        width: fill ? '100%' : size,
        height: fill ? '100%' : size,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
      }}>
      {box > 0
        ? layoutFrame(layout).map((seat, index) => {
            const dot = Math.max(3, (seat.size / 100) * box * 0.92);
            return (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  left: (seat.x / 100) * box - dot / 2,
                  top: (seat.y / 100) * box - dot / 2,
                  width: dot,
                  height: dot,
                  borderRadius: dot / 2,
                  backgroundColor: seat.host ? '#FAC775' : 'rgba(255,255,255,0.66)',
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.4)',
                }}
              />
            );
          })
        : null}
    </View>
  );
}
