import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import type { Dragon3DHandle } from "@/components/dragon-3d-types";
import { DragonOverlay } from "@/modules/dragon-overlay";

type Props = { onError?: (message: string) => void };

type Box = { left: number; top: number; width: number; height: number };

/**
 * The room's dragon on Android: the native layer above the seats, drawn with
 * the page the phone carries inside it. Touches pass through it, so the seats
 * and the chat keep working underneath.
 *
 * When the native layer is not there (an older build, or a phone without the
 * module) the same page opens in a web view instead, so the dragon is never
 * simply missing.
 */
export const Dragon3D = forwardRef<Dragon3DHandle, Props>(function Dragon3D({ onError }, ref) {
  const page = useRef<WebView>(null);
  const ready = useRef(false);
  const waiting = useRef<string[]>([]);
  const errorRef = useRef(onError);
  errorRef.current = onError;
  // The layer covers the whole window, so the app has to say where each seat
  // is on the phone's screen and not only inside the room.
  const self = useRef<View>(null);
  const offset = useRef<{ x: number; y: number } | null>(null);
  /**
   * The native layer is the better path, but it is a web view of its own and
   * can fail to start on a busy phone. When it does not say it is ready, the
   * same page opens inside the room instead: the dragon, and the kiss, always
   * have somewhere to draw.
   */
  const [native, setNative] = useState(DragonOverlay.available);
  /**
   * The page's own web view runs in its own process. When a phone is out of
   * memory Android ends that process, and the standard web view answers by
   * closing the whole app. The dragon is decoration: it steps aside instead.
   */
  const [pageDown, setPageDown] = useState(false);

  useEffect(() => {
    if (!native) return;
    DragonOverlay.prepare();
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (DragonOverlay.isReady()) { clearInterval(timer); return; }
      // The page loads its two models from the phone: a slow phone needs more
      // than a few seconds, and switching too early would build a second copy
      // of the same scene beside the first.
      if (tries < 15) return;
      clearInterval(timer);
      DragonOverlay.destroy();
      setNative(false);
    }, 1200);
    return () => clearInterval(timer);
  }, [native]);

  /** Where the room sits on the phone's screen. */
  const measure = useCallback(
    () =>
      new Promise<{ x: number; y: number }>(resolve => {
        const node = self.current;
        if (!node) { resolve({ x: 0, y: 0 }); return; }
        node.measureInWindow((x, y) => {
          offset.current = { x, y };
          resolve({ x, y });
        });
      }),
    [],
  );

  useEffect(() => {
    void measure();
  }, [measure]);

  /** One seat, as the room measures it: its place and its size. */
  const seat = useCallback((box: Box) => ({
    x: box.left + box.width / 2,
    y: box.top + box.height / 2,
    size: box.width,
  }), []);

  /** The same seat, counted from the top of the phone's screen. */
  const seatInWindow = useCallback(async (box: Box) => {
    const place = offset.current ?? (await measure());
    return { x: box.left + place.x + box.width / 2, y: box.top + place.y + box.height / 2, size: box.width };
  }, [measure]);

  /**
   * A seat that has not been laid out yet has no width; a kiss drawn on it
   * would land in the corner of the screen.
   */
  const placed = (box: Box) => box.width > 0 && box.height > 0;

  /** A line of code for the page, kept until the page is ready. */
  const run = useCallback((code: string) => {
    if (!ready.current) {
      waiting.current.push(code);
      if (waiting.current.length > 6) waiting.current.shift();
      return;
    }
    page.current?.injectJavaScript(code);
  }, []);

  useImperativeHandle(ref, () => ({
    play: (box, clip) => {
      if (native) {
        void seatInWindow(box).then(place => {
          DragonOverlay.playEmotion(place.x, place.y, place.size, clip);
        });
        return;
      }
      const place = seat(box);
      run(`DragonLayer.play(${place.x.toFixed(1)},${place.y.toFixed(1)},${place.size.toFixed(1)},'${clip}')`);
    },
    pair: (left, right) => {
      if (!placed(left) || !placed(right)) return;
      if (native) {
        void Promise.all([seatInWindow(left), seatInWindow(right)]).then(([one, other]) => {
          DragonOverlay.playCouple(one.x, one.y, other.x, other.y, one.size);
        });
        return;
      }
      const one = seat(left);
      const other = seat(right);
      run(`DragonLayer.playCouple(${one.x.toFixed(1)},${one.y.toFixed(1)},${other.x.toFixed(1)},${other.y.toFixed(1)},${one.size.toFixed(1)})`);
    },
  }), [native, run, seat, seatInWindow]);

  useEffect(() => () => {
    ready.current = false;
    waiting.current = [];
    if (native) DragonOverlay.destroy();
  }, [native]);

  // Another app is in front: the dragon stops drawing, so the phone is not
  // rendering a scene nobody sees.
  useEffect(() => {
    if (!native) return;
    const activity = AppState.addEventListener("change", state => {
      if (state === "active") DragonOverlay.resume();
      else DragonOverlay.pause();
    });
    return () => activity.remove();
  }, [native]);

  /**
   * The page and its two models are copied into the app's own assets at build
   * time, so the fallback opens that same folder: the models sit beside the
   * page and the dragon finds them wherever the phone put them.
   */
  const uri = "file:///android_asset/dragon_layer.html";

  if (native) {
    // The native layer lives above the app's view: this box only tells it
    // where the room is on the screen.
    return <View ref={self} collapsable={false} pointerEvents="none" style={StyleSheet.absoluteFill} />;
  }

  if (pageDown) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { zIndex: 44 }]}>
      <WebView
        ref={page}
        source={{ uri }}
        originWhitelist={["*"]}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        javaScriptEnabled
        domStorageEnabled={false}
        scrollEnabled={false}
        overScrollMode="never"
        androidLayerType="hardware"
        style={{ flex: 1, backgroundColor: "transparent" }}
        containerStyle={{ flex: 1, backgroundColor: "transparent" }}
        onLoad={() => {
          ready.current = true;
          const queued = waiting.current;
          waiting.current = [];
          queued.forEach(code => page.current?.injectJavaScript(code));
        }}
        onError={() => errorRef.current?.("No pudimos abrir el dragón de la sala.")}
        onRenderProcessGone={() => {
          ready.current = false;
          waiting.current = [];
          setPageDown(true);
        }}
      />
    </View>
  );
});
