import { InteractionManager, Image } from 'react-native';
import { Asset } from 'expo-asset';
import { GIFT_VIDEOS } from '@/components/gift-video-overlay';
import { ROOM_GIFTS, giftArt } from '@/lib/gift-store';
import { powerNow } from '@/lib/power';

/**
 * Deja listos los medios de los regalos antes de que hagan falta.
 *
 * Los clips y las imágenes de los regalos viajan dentro de la app, así que no
 * se descargan al enviar: se guardan en el teléfono la primera vez que la app
 * los abre. Hacerlo aquí, en un momento libre, es lo que hace que el regalo
 * salga al instante en la sala y siga saliendo sin conexión.
 *
 * Todo corre después de que la pantalla termina de dibujarse: nunca compite
 * con lo que la persona está mirando.
 */
let warming: Promise<void> | null = null;

async function store(moduleId: number | null | undefined) {
  if (!moduleId) return;
  try {
    const asset = Asset.fromModule(moduleId);
    if (!asset.downloaded) await asset.downloadAsync();
  } catch {
    // Un medio que no se pudo guardar se vuelve a intentar la próxima vez.
  }
}

/** Guarda en el teléfono los clips y las imágenes de todos los regalos. */
export function warmGiftMedia(): Promise<void> {
  if (warming) return warming;
  const { data, ready } = powerNow();
  // Con ahorro de datos la persona pidió que nada se descargue por detrás.
  if (ready && data) return Promise.resolve();
  warming = (async () => {
    const videos = Object.values(GIFT_VIDEOS).map(item => item.source);
    const art = ROOM_GIFTS.map(gift => giftArt(gift.key));
    await Promise.all([...videos, ...art].map(store));
  })().finally(() => {
    warming = null;
  });
  return warming;
}

/** Adelanta las fotos de una sala: caras de los asientos y fondo. */
export function warmRoomImages(urls: (string | null | undefined)[]) {
  const { data, ready } = powerNow();
  if (ready && data) return;
  for (const url of new Set(urls.filter((item): item is string => Boolean(item)))) {
    // prefetch guarda la imagen en la caché del teléfono; un fallo no rompe nada.
    void Image.prefetch(url).catch(() => undefined);
  }
}

/** Encola el precalentamiento para cuando la pantalla ya esté quieta. */
export function warmGiftMediaWhenIdle() {
  InteractionManager.runAfterInteractions(() => {
    // Un respiro más para no robarle cuadros a la primera animación.
    setTimeout(() => { void warmGiftMedia(); }, 700);
  });
}
