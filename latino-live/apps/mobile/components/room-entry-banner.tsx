import { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AvatarPhoto } from '@/components/avatar-photo';
import { SvipEntryArt } from '@/components/svip-pieces';
import { SvipKitAvatar, SvipKitBanner, SvipKitEmblem } from '@/components/svip-kit';
import { svipKit } from '@/lib/svip-kit';
import { svipTheme } from '@/lib/svip';

export type RoomEntry = {
  /** Bumped for every arrival, so the same person can enter twice. */
  key: number;
  name: string;
  avatar: string | null;
  svip: number;
  /** The clip that plays on arrival, when the person has one active. */
  video: string | null;
};

/** The banner keeps this exact size on every phone. */
const WIDTH = 260;
const HEIGHT = 46;
const SLIDE_IN = 380;
const HOLD = 2000;
const SLIDE_OUT = 340;

/**
 * The entrance of a person into the room: a slim gold banner that glides in
 * from the left, crosses the middle of the room, stays two seconds while
 * everyone reads the name, and leaves to the right.
 */
export function RoomEntryBanner({ entry, onDone }: { entry: RoomEntry | null; onDone: () => void }) {
  if (!entry) return null;
  const level = Math.min(10, Math.max(0, Math.round(entry.svip) || 0));
  // A new arrival mounts a fresh banner, so an animation left half way by the
  // previous one can never keep the screen busy.
  // The levels with their own art enter with it, not with the plain bar.
  if (svipKit(level)) return <KitBanner key={entry.key} entry={entry} level={level} onDone={onDone} />;
  return <Banner key={entry.key} entry={entry} onDone={onDone} />;
}

function Banner({ entry, onDone }: { entry: RoomEntry; onDone: () => void }) {
  const offset = useSharedValue(-WIDTH - 20);
  const opacity = useSharedValue(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    offset.value = -WIDTH - 20;
    opacity.value = 0;
    offset.value = withSequence(
      withTiming(0, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) }),
      withDelay(HOLD, withTiming(WIDTH + 20, { duration: SLIDE_OUT, easing: Easing.in(Easing.cubic) })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: SLIDE_IN * 0.7 }),
      withDelay(HOLD + SLIDE_OUT * 0.55, withTiming(0, { duration: SLIDE_OUT * 0.45 })),
    );
    // The banner always leaves, even if an animation frame is dropped on a
    // slower phone: the room never stays waiting behind it.
    const timer = setTimeout(() => done.current(), SLIDE_IN + HOLD + SLIDE_OUT + 120);
    return () => clearTimeout(timer);
    // One animation per arrival: a redraw never restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }],
    opacity: opacity.value,
  }));

  const level = Math.min(10, Math.max(0, Math.round(entry.svip) || 0));
  const theme = svipTheme(level);
  // Each level enters in its own colours; levels 1–3, 10 also carry their medal.
  const colors: [string, string, string] = theme
    ? [`${theme.background[0]}F5`, `${theme.background[1]}F5`, `${theme.background[2]}F5`]
    : ['rgba(46,34,18,0.96)', 'rgba(22,17,12,0.96)', 'rgba(56,41,20,0.96)'];
  const edge = theme ? theme.ring[0] : '#FFC24B';

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[{ width: WIDTH, height: HEIGHT }, slide]}>
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.banner, theme ? { borderColor: edge, shadowColor: theme.accent } : undefined]}>
          <View style={[styles.avatarRing, theme ? { borderColor: theme.ring[0] } : undefined]}>
            <View style={styles.avatarClip}>
              <AvatarPhoto uri={entry.avatar} name={entry.name} />
            </View>
          </View>

          <View style={styles.copy}>
            <Text numberOfLines={1} style={styles.name}>
              {entry.name}
            </Text>
            <Text numberOfLines={1} style={styles.caption}>
              entró a la sala
            </Text>
          </View>

          {level > 0 ? (
            <View style={styles.medal}>
              <SvipEntryArt level={level} size={26} />
            </View>
          ) : null}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

/**
 * The entrance of a level that came with its own art: the winged banner of the
 * level carries the name, the photo arrives inside the level's own ring and
 * the crest sits on top. The whole thing glides in, waits and leaves.
 */
function KitBanner({ entry, level, onDone }: { entry: RoomEntry; level: number; onDone: () => void }) {
  const kit = svipKit(level);
  const offset = useSharedValue(-WIDTH - 40);
  const opacity = useSharedValue(0);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    offset.value = -WIDTH - 40;
    opacity.value = 0;
    offset.value = withSequence(
      withTiming(0, { duration: SLIDE_IN, easing: Easing.out(Easing.cubic) }),
      withDelay(HOLD, withTiming(WIDTH + 40, { duration: SLIDE_OUT, easing: Easing.in(Easing.cubic) })),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: SLIDE_IN * 0.7 }),
      withDelay(HOLD + SLIDE_OUT * 0.55, withTiming(0, { duration: SLIDE_OUT * 0.45 })),
    );
    const timer = setTimeout(() => done.current(), SLIDE_IN + HOLD + SLIDE_OUT + 120);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { scale: 0.94 + opacity.value * 0.06 }],
    opacity: opacity.value,
  }));

  if (!kit) return null;

  return (
    <View pointerEvents="none" style={styles.layer}>
      <Animated.View style={[{ width: 320, alignItems: 'center' }, slide]}>
        <View style={{ width: 320, height: 88, alignItems: 'center', justifyContent: 'center' }}>
          <SvipKitBanner level={level} width={320} height={88} animated={false}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <SvipKitAvatar level={level} size={40} animated={false}>
                <AvatarPhoto uri={entry.avatar} name={entry.name} />
              </SvipKitAvatar>
              <View style={{ flexShrink: 1 }}>
                <Text numberOfLines={1} style={styles.kitName}>
                  {entry.name}
                </Text>
                <Text numberOfLines={1} style={styles.kitCaption}>
                  entró a la sala
                </Text>
              </View>
            </View>
          </SvipKitBanner>
        </View>
        <View style={{ marginTop: -6 }}>
          <SvipKitEmblem level={level} size={30} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  banner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingLeft: 6,
    paddingRight: 12,
    borderRadius: HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.75)',
    shadowColor: '#FFC24B',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  avatarRing: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: '#FFC24B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarClip: {
    width: 28,
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    color: '#FFF7E6',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  caption: {
    color: '#FFC24B',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  medal: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kitName: {
    color: '#FFFDF4',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  kitCaption: {
    color: '#F6E2B8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  levelPill: {
    paddingHorizontal: 8,
    height: 20,
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'rgba(255,194,75,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,194,75,0.55)',
  },
  levelText: {
    color: '#F6E2B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});
