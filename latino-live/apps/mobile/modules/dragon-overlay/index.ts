import { requireOptionalNativeModule } from "expo";

/**
 * The room's dragon on Android: a transparent layer above the seats that
 * plays the 3D model's own animations. The app measures the seats and hands
 * the layer their position; the layer never touches the room underneath.
 */
type DragonOverlayNative = {
  playEmotion: (x: number, y: number, size: number, emotion: string) => void;
  playCouple: (leftX: number, leftY: number, rightX: number, rightY: number, size: number) => void;
  isReady: () => boolean;
  prepare: () => void;
  pause: () => void;
  resume: () => void;
  destroy: () => void;
};

const native = requireOptionalNativeModule<DragonOverlayNative>("DragonOverlay");

export const DragonOverlay = {
  /** Whether this phone has the native layer. The browser never does. */
  available: native != null,
  /** One emotion over one seat, in window coordinates. */
  playEmotion: (x: number, y: number, size: number, emotion: string) => {
    native?.playEmotion(x, y, size, emotion);
  },
  /** The two dragons walk to each other and kiss. */
  playCouple: (leftX: number, leftY: number, rightX: number, rightY: number, size: number) => {
    native?.playCouple(leftX, leftY, rightX, rightY, size);
  },
  /** Whether the layer has loaded and can already draw. */
  isReady: (): boolean => native?.isReady() ?? false,
  /** Opens the layer ahead of the first dragon, so it is warm when asked. */
  prepare: () => {
    native?.prepare();
  },
  /** The app left the screen: the layer stops drawing until it comes back. */
  pause: () => {
    native?.pause();
  },
  /** The app is back: the layer draws again. */
  resume: () => {
    native?.resume();
  },
  destroy: () => {
    native?.destroy();
  },
};
