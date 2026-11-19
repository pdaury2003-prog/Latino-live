import { StyleSheet, View } from 'react-native';
import { tileValues } from '@/lib/domino';

/** Where the pips sit in each of the three rows and columns. */
const PIPS: Record<number, Array<[number, number]>> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [0, 2], [1, 0], [1, 2], [2, 0], [2, 2]],
};

function Pips({ value, width, height }: { value: number; width: number; height: number }) {
  const pad = Math.min(width, height) * 0.16;
  const dot = Math.max(3.5, Math.min(width, height) * 0.15);
  const stepX = (width - pad * 2 - dot) / 2;
  const stepY = (height - pad * 2 - dot) / 2;
  return (
    <View style={{ width, height }}>
      {(PIPS[value] ?? PIPS[0]).map(([row, col]) => (
        <View
          key={`${row}-${col}`}
          style={{
            position: 'absolute',
            left: pad + col * stepX,
            top: pad + row * stepY,
            width: dot,
            height: dot,
            borderRadius: dot / 2,
            backgroundColor: '#3A2C1C',
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 1,
            shadowOffset: { width: 0, height: 1 },
          }}
        />
      ))}
    </View>
  );
}

/**
 * A domino as the house draws it: ivory face, two halves and carved pips.
 * `highlight` lifts a tile that can be played right now.
 */
export function DominoTile({
  tile,
  width = 44,
  height = 82,
  dimmed = false,
  highlight = false,
  horizontal = false,
}: {
  tile: string;
  width?: number;
  height?: number;
  dimmed?: boolean;
  highlight?: boolean;
  /** A tile lying on the table: its halves sit left and right, not top and bottom. */
  horizontal?: boolean;
}) {
  const [a, b] = tileValues(tile);
  const half = (horizontal ? width : height) / 2;
  return (
    <View
      style={[
        styles.tile,
        {
          width,
          height,
          flexDirection: horizontal ? 'row' : 'column',
          opacity: dimmed ? 0.5 : 1,
          borderColor: highlight ? '#FFC24B' : '#C9B78E',
          shadowOpacity: highlight ? 0.45 : 0.3,
          shadowColor: highlight ? '#FFC24B' : '#000',
        },
      ]}>
      <Pips value={a} width={horizontal ? half - 5 : width} height={horizontal ? height : half - 5} />
      <View style={horizontal ? styles.dividerVertical : styles.divider} />
      <Pips value={b} width={horizontal ? half - 5 : width} height={horizontal ? height : half - 5} />
    </View>
  );
}

/** The back of a tile, for the hero art. */
export function DominoBack({ width = 42, height = 78 }: { width?: number; height?: number }) {
  return (
    <View style={[styles.back, { width, height, borderRadius: Math.max(7, width * 0.17) }]}>
      <View style={[styles.backDiamond, { width: width * 0.42, height: width * 0.42 }]} />
      <View style={[styles.backDot, { top: height * 0.18 }]} />
      <View style={[styles.backDot, { bottom: height * 0.18 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: '#F6EDDC',
    borderRadius: 9,
    borderWidth: 1.2,
    paddingTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  divider: { height: 1, alignSelf: 'stretch', marginHorizontal: 7, backgroundColor: '#D8C6A2' },
  dividerVertical: { width: 1, alignSelf: 'stretch', marginVertical: 7, backgroundColor: '#D8C6A2' },
  back: {
    backgroundColor: '#123A2C',
    borderWidth: 1.2,
    borderColor: 'rgba(255,194,75,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backDiamond: {
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.4)',
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  backDot: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,194,75,0.5)',
  },
});
