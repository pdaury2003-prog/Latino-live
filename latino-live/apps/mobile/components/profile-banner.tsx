import type { ReactNode } from 'react';
import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { profileBanner } from '@/lib/profile-banner';

type Props = {
  level: number | null | undefined;
  /** Width of the card the frame must cover. */
  width: number;
  children: (photoSize: number) => ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * The wide frame of a profile card, corner to corner.
 *
 * The artwork is drawn across the card's full width, so both wings touch its
 * edges and none of the metal is cropped. The photo fills the opening exactly
 * and the frame is drawn on top, so its rim covers the photo's edge.
 */
export function ProfileBanner({ level, width, children, style }: Props) {
  const banner = profileBanner(level);
  if (!banner) return null;

  const drawnWidth = width;
  const drawnHeight = drawnWidth * banner.aspect;
  // Just enough overlap to hide the artwork's softened edge, never more: the
  // photo stays inside the metal ring instead of spilling over it.
  const face = Math.max(banner.holeW * drawnWidth, banner.holeH * drawnHeight) * 1.01;

  // The artwork's opening is truly transparent, so the photo goes underneath
  // and the metal is drawn on top: the rim covers the photo's edge exactly.
  return (
    <View style={[{ width, height: drawnHeight, overflow: 'hidden' }, style]} pointerEvents="none">
      <View
        style={{
          position: 'absolute',
          left: width / 2 - face / 2,
          top: drawnHeight * banner.cy - face / 2,
          width: face,
          height: face,
          borderRadius: face / 2,
          overflow: 'hidden',
        }}>
        {children(face)}
      </View>
      <Image
        source={banner.art}
        resizeMode="stretch"
        style={{ position: 'absolute', left: width / 2 - drawnWidth * banner.cx, top: 0, width: drawnWidth, height: drawnHeight }}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** How tall the frame is when it covers a card of this width. */
export function profileBannerBox(level: number | null | undefined, width: number) {
  const banner = profileBanner(level);
  if (!banner) return null;
  const drawnWidth = width;
  const drawnHeight = drawnWidth * banner.aspect;
  const photo = Math.max(banner.holeW * drawnWidth, banner.holeH * drawnHeight) * 1.01;
  return { photo, height: drawnHeight, centre: drawnHeight * banner.cy };
}
