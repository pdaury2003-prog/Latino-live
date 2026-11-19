import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Linking, Platform, Pressable, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { ExternalLink, FastForward, Pause, Play, Rewind, RotateCw, Volume2, VolumeX } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useDataSaver } from '@/lib/power';
import { playingFromReport, seekSecondsAt } from '@/lib/youtube-live';

/** The eleven-character id of a YouTube address, or null. */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  if (match) return match[1];
  const bare = url.match(/^([A-Za-z0-9_-]{11})$/);
  return bare ? bare[1] : null;
}

type Props = { url: string; title?: string; height?: number };

type Snapshot = { playing: boolean; time: number; duration: number; loaded: number; ready: boolean };

/**
 * YouTube refuses to play when it recognises the phone's web view by its "wv"
 * marker in the user agent: it shows "Video unavailable" instead. Presenting
 * the app as a normal mobile Chrome is what makes the video actually play
 * inside the room.
 */
const BROWSER_AGENT =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

const EMPTY: Snapshot = { playing: false, time: 0, duration: 0, loaded: 0, ready: false };

/**
 * The room's shared YouTube screen. It starts on its own, muted, because a
 * phone only lets sound begin after a touch; one big button turns the sound on
 * and the bar under the video pauses, moves and catches up with a live stream.
 */
export function RoomVideo({ url, height = 210 }: Props) {
  const id = youtubeId(url);
  const dataSaver = useDataSaver();
  const [armed, setArmed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  // What the person asked for. The player reports its own state every half
  // second, and that report used to arrive late and flip the button back, so
  // pause looked like it pressed itself twice. The person's own wish wins.
  const [playing, setPlaying] = useState(true);
  const intent = useRef(true);
  const lastPress = useRef(0);
  const player = useRef<WebView>(null);
  const frame = useRef<HTMLIFrameElement | null>(null);

  /**
   * The player's page is built once per video. It used to be rebuilt with the
   * current second inside it, and every state report (twice a second) gave the
   * phone a new page: the WebView reloaded, the video jumped back to the start
   * and the pause button flickered. The page must never depend on the clock;
   * moving inside the video happens through spkSeekBy and spkLive.
   */
  const page = useMemo(() => (id ? playerHtml(id) : ''), [id]);
  /**
   * The WebView reloads whenever it is handed a different `source` object,
   * even one with the same page inside. Building it once per video is what
   * keeps the video and its pause button still while the clock reports.
   */
  const pageSource = useMemo(
    () => ({ html: page, baseUrl: 'https://www.youtube-nocookie.com' }),
    [page],
  );

  const soundOn = !muted && volume > 0;

  // The sound and the volume are the first things a person needs: send both to
  // the page as soon as it is ready, so a tap is never lost while it loads.
  useEffect(() => {
    if (Platform.OS === 'web') {
      const target = frame.current?.contentWindow;
      if (!target) return;
      const post = (func: string, args: (number | boolean)[] = []) =>
        target.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
      post('setVolume', [volume]);
      post(soundOn ? 'unMute' : 'mute');
      return;
    }
    if (!snapshot.ready) return;
    player.current?.injectJavaScript(
      `window.spkVolume && window.spkVolume(${volume}); window.spkSound && window.spkSound(${soundOn}); true;`,
    );
  }, [soundOn, volume, snapshot.ready]);

  if (!id) return null;

  // Mobile data saving: the poster waits for a touch instead of loading the
  // whole player, and the smaller picture is enough for the preview.
  const gated = dataSaver && !armed;

  const watchUrl = `https://www.youtube.com/watch?v=${id}`;
  const live = snapshot.ready && snapshot.duration <= 0;
  const localTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  /** One command reaches the phone's player or, on the web, the same embed. */
  function command(name: 'playVideo' | 'pauseVideo' | 'seekBy' | 'seekTo' | 'goLive', value?: number) {
    if (Platform.OS === 'web') {
      const target = frame.current?.contentWindow;
      if (!target) return;
      const post = (func: string, args: (number | boolean)[] = []) =>
        target.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
      if (name === 'seekBy') {
        const next = Math.max(0, snapshot.time + (value ?? 0));
        setSnapshot(current => ({ ...current, time: next }));
        post('seekTo', [next, true]);
        return;
      }
      if (name === 'seekTo') {
        const next = Math.max(0, value ?? 0);
        setSnapshot(current => ({ ...current, time: next }));
        post('seekTo', [next, true]);
        return;
      }
      if (name === 'goLive') {
        post('seekTo', [snapshot.duration || 0, true]);
        post('playVideo');
        return;
      }
      post(name);
      return;
    }
    // El dedo manda: la barra se mueve ya, sin esperar el próximo informe del
    // reproductor medio segundo después.
    if (name === 'seekTo') {
      const next = Math.max(0, value ?? 0);
      setSnapshot(current => ({ ...current, time: next }));
    } else if (name === 'seekBy') {
      setSnapshot(current => ({ ...current, time: Math.max(0, current.time + (value ?? 0)) }));
    }
    const calls: Record<typeof name, string> = {
      playVideo: 'window.spkPlay && window.spkPlay()',
      pauseVideo: 'window.spkPause && window.spkPause()',
      seekBy: `window.spkSeekBy && window.spkSeekBy(${value ?? 0})`,
      seekTo: `window.spkSeekTo && window.spkSeekTo(${value ?? 0})`,
      goLive: 'window.spkLive && window.spkLive()',
    };
    player.current?.injectJavaScript(`${calls[name]}; true;`);
  }

  function reload() {
    setErrorCode(null);
    setSnapshot(EMPTY);
    setAttempt(value => value + 1);
  }

  return (
    <View className="border-border bg-black/80 mt-3 overflow-hidden rounded-2xl border">
      <View style={{ width: '100%', height, backgroundColor: '#000' }}>
        {/* The video's own picture stays behind the player: while the embed
            loads, or if a phone refuses it, the room still shows the video. */}
        <Image
          source={{ uri: `https://i.ytimg.com/vi/${id}/${dataSaver ? 'mqdefault' : 'hqdefault'}.jpg` }}
          resizeMode="cover"
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        />
        {gated ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cargar el video de la sala"
            onPress={() => setArmed(true)}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            className="items-center justify-center gap-2 bg-black/45 active:opacity-90">
            <View className="bg-primary size-12 items-center justify-center rounded-full">
              <Icon as={Play} className="text-primary-foreground size-5" />
            </View>
            <Text className="text-white text-[11px] font-semibold">Toca para cargar el video</Text>
            <Text className="text-white/70 text-[11px]">Ahorro de datos activo</Text>
          </Pressable>
        ) : Platform.OS === 'web' ? (
          // On the web the browser plays the same embed directly.
          <EmbedFrame key={attempt} frameRef={frame} src={embedUrl(id)} title="Video de la sala" />
        ) : (
          <WebView
            ref={player}
            key={attempt}
            source={pageSource}
            userAgent={BROWSER_AGENT}
            applicationNameForUserAgent="Chrome/120.0.0.0"
            originWhitelist={['*']}
            style={{ flex: 1, backgroundColor: '#000' }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            allowsProtectedMedia
            mediaPlaybackRequiresUserAction={false}
            mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            thirdPartyCookiesEnabled
            setSupportMultipleWindows={false}
            androidLayerType="hardware"
            onShouldStartLoadWithRequest={request => {
              const allowed = /^(https?:|about:|data:|blob:)/i.test(request.url);
              // A link to a channel or another video would leave the room.
              if (allowed && /youtube\.com\/(channel|user|c\/)/i.test(request.url)) return false;
              return allowed;
            }}
            onError={() => setErrorCode('red')}
            onRenderProcessGone={() => setErrorCode('red')}
            onMessage={event => {
              let message: { type?: string; playing?: boolean; state?: number; time?: number; duration?: number; loaded?: number; code?: string } | null = null;
              try {
                message = JSON.parse(event.nativeEvent.data);
              } catch {
                return;
              }
              if (!message) return;
              if (message.type === 'ready') {
                setSnapshot(current => ({ ...current, ready: true }));
              } else if (message.type === 'state') {
                // A report that contradicts a press from the last moment is
                // simply the old state arriving late; it is ignored.
                const settled = Date.now() - lastPress.current > 1500;
                // Buffering (3) and cued (5) are not a pause: a phone on mobile
                // data spends whole seconds there, and reading it as "paused"
                // is what made the pause button disappear and come back.
                const reported = playingFromReport(message.playing, message.state);
                if (settled && reported !== intent.current) {
                  intent.current = reported;
                  setPlaying(reported);
                }
                setSnapshot(current => ({
                  ready: true,
                  playing: settled ? reported : intent.current,
                  time: Number(message.time) || 0,
                  duration: Number(message.duration) || 0,
                  loaded: Math.min(1, Math.max(0, Number(message.loaded) || 0)),
                }));
              } else if (message.type === 'error') {
                setErrorCode(String(message.code ?? 'error'));
              }
            }}
          />
        )}

        {errorCode ? (
          <View
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            className="bg-black/85 items-center justify-center gap-2 px-5">
            <Text className="text-white text-center text-[12px] font-semibold">
              {embedded(errorCode)
                ? 'Este video no permite verse fuera de YouTube'
                : 'YouTube no dejó ver este video aquí'}
            </Text>
            <Text className="text-white/70 text-center text-[11px]">
              {embedded(errorCode)
                ? 'La discográfica lo bloquea dentro de la app. Pruébalo en YouTube o elige otro video.'
                : 'Prueba otra vez o ábrelo en YouTube; la sala sigue en modo video.'}
            </Text>
            <View className="mt-1 flex-row gap-2">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reintentar el video"
                onPress={reload}
                className="bg-white/15 h-8 flex-row items-center gap-1.5 rounded-full px-3 active:opacity-80">
                <Icon as={RotateCw} className="text-white size-3.5" />
                <Text className="text-white text-[11px] font-semibold">Reintentar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Ver el video en YouTube"
                onPress={() => void Linking.openURL(watchUrl)}
                className="bg-primary h-8 flex-row items-center gap-1.5 rounded-full px-3 active:opacity-85">
                <Icon as={ExternalLink} className="text-primary-foreground size-3.5" />
                <Text className="text-primary-foreground text-[11px] font-semibold">YouTube</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* Los controles de la sala: progreso para llegar a cualquier minuto,
          pausa, saltos de quince segundos y el volumen. Se quedan a la vista
          aunque YouTube esconda los suyos. */}
      <View className="border-border/60 border-t px-2 pb-1.5 pt-1" style={gated ? { opacity: 0.4 } : undefined}>
        {snapshot.duration > 0 ? (
          <View className="flex-row items-center gap-2">
            <Text
              className="text-muted-foreground text-[11px] font-medium"
              style={{ width: 34, fontVariant: ['tabular-nums'] }}>
              {localTime(snapshot.time)}
            </Text>
            <ProgressBar
              time={snapshot.time}
              duration={snapshot.duration}
              loaded={snapshot.loaded}
              onSeek={seconds => command('seekTo', seconds)}
            />
            <Text
              className="text-muted-foreground text-[11px] font-medium"
              style={{ width: 34, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
              {localTime(snapshot.duration)}
            </Text>
          </View>
        ) : live ? (
          <View className="flex-row items-center gap-1.5 px-1 pb-0.5">
            <View className="bg-destructive size-1.5 rounded-full" />
            <Text className="text-destructive text-[11px] font-bold tracking-[0.1em]">EN VIVO</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ponerme al día con la transmisión en vivo"
              onPress={() => command('goLive')}
              hitSlop={6}
              className="border-border ml-auto h-6 flex-row items-center gap-1 rounded-full border px-2 active:bg-muted">
              <Icon as={FastForward} className="text-foreground size-3" />
              <Text className="text-foreground text-[11px] font-semibold">Al día</Text>
            </Pressable>
          </View>
        ) : null}

        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? 'Pausar el video' : 'Reproducir el video'}
            accessibilityState={{ selected: playing }}
            onPress={() => {
              const next = !intent.current;
              intent.current = next;
              lastPress.current = Date.now();
              setPlaying(next);
              command(next ? 'playVideo' : 'pauseVideo');
            }}
            hitSlop={4}
            className="bg-primary size-9 items-center justify-center rounded-full active:opacity-85">
            <Icon as={playing ? Pause : Play} className="text-primary-foreground size-4" />
          </Pressable>

          {live ? null : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retroceder quince segundos"
                onPress={() => command('seekBy', -15)}
                hitSlop={6}
                className="size-9 items-center justify-center rounded-full active:bg-muted">
                <Icon as={Rewind} className="text-foreground size-4" />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Avanzar quince segundos"
                onPress={() => command('seekBy', 15)}
                hitSlop={6}
                className="size-9 items-center justify-center rounded-full active:bg-muted">
                <Icon as={FastForward} className="text-foreground size-4" />
              </Pressable>
            </>
          )}

          <View className="flex-1" />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={soundOn ? 'Silenciar el video' : 'Activar el sonido del video'}
            accessibilityState={{ selected: soundOn }}
            onPress={() => setMuted(value => !value)}
            hitSlop={8}
            className="size-8 items-center justify-center rounded-full active:bg-muted">
            <Icon as={soundOn ? Volume2 : VolumeX} className={soundOn ? 'text-foreground size-4' : 'text-muted-foreground size-4'} />
          </Pressable>
          {/* El nivel vive aquí, a un dedo del icono del sonido. */}
          <View style={{ width: 68 }}>
            <VolumeBar
              value={volume}
              onChange={next => {
                setVolume(next);
                setMuted(next === 0);
              }}
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reproducir el video otra vez"
            onPress={reload}
            hitSlop={6}
            className="size-8 items-center justify-center rounded-full active:bg-muted">
            <Icon as={RotateCw} className="text-muted-foreground size-4" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * La barra de progreso del video: muestra lo escuchado, lo ya cargado y deja
 * saltar a cualquier minuto arrastrando el dedo. Mientras el dedo está puesto
 * manda su posición, para que la barra no vuelva atrás al llegar el informe
 * del reproductor.
 */
function ProgressBar({
  time,
  duration,
  loaded,
  onSeek,
}: {
  time: number;
  duration: number;
  loaded: number;
  onSeek: (seconds: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const THUMB = 12;
  const travel = Math.max(0, width - THUMB);
  const shown = Math.min(duration, Math.max(0, scrub ?? time));
  const ratio = duration > 0 ? shown / duration : 0;
  const buffered = Math.min(1, Math.max(ratio, loaded));
  const centre = THUMB / 2 + ratio * travel;
  const place = (x: number) => seekSecondsAt(x, width, duration, THUMB);
  const commit = (x: number) => {
    const seconds = place(x);
    setScrub(seconds);
    onSeek(seconds);
    // El reproductor tarda en confirmar: la barra espera su respuesta.
    if (hold.current) clearTimeout(hold.current);
    hold.current = setTimeout(() => setScrub(null), 900);
  };
  useEffect(() => () => { if (hold.current) clearTimeout(hold.current); }, []);
  return (
    <View
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => setScrub(place(event.nativeEvent.locationX))}
      onResponderMove={event => setScrub(place(event.nativeEvent.locationX))}
      onResponderRelease={event => commit(event.nativeEvent.locationX)}
      onResponderTerminate={event => commit(event.nativeEvent.locationX)}
      accessibilityRole="adjustable"
      accessibilityLabel="Posición del video"
      accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(shown) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        const step = event.nativeEvent.actionName === 'increment' ? 15 : -15;
        const next = Math.min(duration, Math.max(0, shown + step));
        setScrub(next);
        onSeek(next);
        if (hold.current) clearTimeout(hold.current);
        hold.current = setTimeout(() => setScrub(null), 900);
      }}
      style={{ flex: 1, height: 24, justifyContent: 'center' }}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)' }}>
        <View style={{ width: buffered * travel, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.34)' }} />
        <View
          style={{
            position: 'absolute', left: 0, top: 0, width: centre, height: 4, borderRadius: 2,
            backgroundColor: '#FF3D7F',
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(width - THUMB, centre - THUMB / 2)),
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: '#FFFFFF',
        }}
      />
    </View>
  );
}

/**
 * A slim volume slider drawn by the app itself: the finger's place along the
 * track is the level, and it keeps moving while the finger is still down.
 */
function VolumeBar({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [width, setWidth] = useState(0);
  const level = Math.max(0, Math.min(100, value));
  const THUMB = 16;
  // The thumb travels inside the track's own ends, so at 0% and 100% its whole
  // circle stays visible instead of being cut by the player's border.
  const travel = Math.max(0, width - THUMB * 2);
  const filled = (level / 100) * travel;
  const apply = (x: number) => {
    if (width <= 0) return;
    const ratio = (x - THUMB) / travel;
    onChange(Math.round(Math.max(0, Math.min(1, ratio)) * 100));
  };
  return (
    <View
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={event => apply(event.nativeEvent.locationX)}
      onResponderMove={event => apply(event.nativeEvent.locationX)}
      accessibilityRole="adjustable"
      accessibilityLabel="Volumen del video"
      accessibilityValue={{ min: 0, max: 100, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => {
        const step = event.nativeEvent.actionName === 'increment' ? 10 : -10;
        onChange(Math.max(0, Math.min(100, value + step)));
      }}
      style={{ flex: 1, height: 30, justifyContent: 'center', paddingHorizontal: THUMB }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.2)' }}>
        <View style={{ width: filled, height: 6, borderRadius: 3, backgroundColor: '#FF3D7F' }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: THUMB + filled - THUMB / 2,
          width: THUMB,
          height: THUMB,
          borderRadius: THUMB / 2,
          backgroundColor: '#FFFFFF',
          borderWidth: 2,
          borderColor: '#FF3D7F',
        }}
      />
    </View>
  );
}

/** 101, 150 and 153 mean the owner forbids playing it outside YouTube. */
function embedded(code: string | null) {
  return code === '101' || code === '150' || code === '153';
}

/**
 * The plain embed the browser uses on the web build. It goes through
 * youtube-nocookie so the page works without third-party cookies, and it sends
 * the page address only, never the whole one: YouTube answers 153 otherwise.
 */
function embedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=1&fs=1&enablejsapi=1`;
}

/** One full-screen page running the YouTube player for this video. */
function playerHtml(id: string) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
    #player, #player iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
  </style>
</head>
<body>
  <div id="player"></div>
  <script>
    var player = null;
    var stoppedByHand = false;
    var ticking = null;
    function send(data) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(data));
    }
    /** Phones only allow a video to start with sound after a touch, so the
     *  room starts muted and the button turns the sound on without losing the
     *  second everyone is watching. */
    window.spkSound = function (on) {
      if (!player) return;
      try { on ? player.unMute() : player.mute(); } catch (e) {}
    };
    /** The slider's level, from 0 to 100, as the phone's own volume button. */
    window.spkVolume = function (level) {
      if (!player) return;
      try {
        player.setVolume(Math.max(0, Math.min(100, level)));
        if (level > 0) player.unMute();
      } catch (e) {}
    };
    window.spkPlay = function () {
      stoppedByHand = false;
      try { player.playVideo(); } catch (e) {}
    };
    window.spkPause = function () {
      stoppedByHand = true;
      try { player.pauseVideo(); } catch (e) {}
    };
    window.spkSeekBy = function (delta) {
      try {
        var now = player.getCurrentTime() || 0;
        player.seekTo(Math.max(0, now + delta), true);
      } catch (e) {}
    };
    /** La barra de progreso: un minuto exacto, el que pidió el dedo. */
    window.spkSeekTo = function (seconds) {
      try {
        var total = player.getDuration() || 0;
        var next = Math.max(0, total > 0 ? Math.min(total, seconds) : seconds);
        player.seekTo(next, true);
      } catch (e) {}
    };
    /** A live stream drifts behind while the phone sleeps: jump to its edge. */
    window.spkLive = function () {
      try { player.seekTo(player.getDuration() || 0, true); player.playVideo(); } catch (e) {}
    };
    function report() {
      if (!player || typeof player.getCurrentTime !== 'function') return;
      try {
        send({
          type: 'state',
          playing: player.getPlayerState() === 1,
          state: player.getPlayerState(),
          time: player.getCurrentTime() || 0,
          duration: player.getDuration() || 0,
          /* Lo ya cargado dibuja la parte clara de la barra. */
          loaded: typeof player.getVideoLoadedFraction === 'function' ? player.getVideoLoadedFraction() : 0
        });
      } catch (e) {}
    }
    function start() {
      player = new YT.Player('player', {
        /* The cookie-free host is the one that plays inside apps and web
           views: the normal one refuses with error 153 there. */
        host: 'https://www.youtube-nocookie.com',
        videoId: '${id}',
        playerVars: {
          autoplay: 1, mute: 1, playsinline: 1, rel: 0, modestbranding: 1, fs: 1, controls: 1,
          iv_load_policy: 3
        },
        events: {
          onReady: function (event) {
            try {
              event.target.mute();
              event.target.playVideo();
            } catch (e) {}
            send({ type: 'ready' });
            if (ticking) clearInterval(ticking);
            ticking = setInterval(report, 500);
            // A phone that ignored the first call gets one more, still muted.
            setTimeout(function () {
              // Never over a pause the person asked for.
              try { if (!stoppedByHand && player.getPlayerState() !== 1) player.playVideo(); } catch (e) {}
            }, 1200);
          },
          onStateChange: report,
          onError: function (event) {
            send({ type: 'error', code: String(event.data) });
          }
        }
      });
    }
    var tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = function () { send({ type: 'error', code: 'api' }); };
    document.head.appendChild(tag);
    window.onYouTubeIframeAPIReady = start;
  </script>
</body>
</html>`;
}

/** React Native Web has no WebView: an iframe is the same embed. */
function EmbedFrame({
  src,
  title,
  frameRef,
}: {
  src: string;
  title: string;
  frameRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const Frame = 'iframe' as unknown as (props: {
    ref?: React.RefObject<HTMLIFrameElement | null>;
    src: string;
    title: string;
    style: Record<string, unknown>;
    allow: string;
    allowFullScreen: boolean;
    referrerPolicy: string;
  }) => React.ReactElement;
  return (
    <Frame
      ref={frameRef}
      src={src}
      title={title}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      // Only the page address travels, never the whole one: YouTube needs this
      // to accept the embed and answers error 153 without it.
      referrerPolicy="strict-origin-when-cross-origin"
      // Absolute fill: an iframe in normal flow can push the room off screen.
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderWidth: 0 }}
    />
  );
}
