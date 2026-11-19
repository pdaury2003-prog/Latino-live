import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { config } from './config';
import { getSupabase } from './supabase';

/**
 * Diamond packs bought inside Google Play.
 *
 * Google requires digital goods sold in an app to be paid with Play Billing.
 * The phone only takes the money and sends the receipt; the server asks Google
 * whether that receipt is real and adds the diamonds. So the app can be closed
 * mid-purchase and nothing is lost or duplicated: the next launch sends the
 * same receipt again and the server credits it at most once.
 */

/** The packs sold in Play. Their price is whatever Play Console says. */
export const PLAY_PACKS = ['diamonds_100', 'diamonds_500', 'diamonds_1200', 'diamonds_3000'] as const;

const AMOUNTS: Record<string, number> = {
  diamonds_100: 100,
  diamonds_500: 500,
  diamonds_1200: 1200,
  diamonds_3000: 3000,
};

export type PlayPack = { id: string; amount: number; price: string; title: string };

/** The module, loaded only on Android: on web it does not exist. */
type Iap = typeof import('expo-iap');
let loaded: Iap | null = null;
let missing = false;
function iap(): Iap | null {
  if (Platform.OS !== 'android') return null;
  if (loaded) return loaded;
  if (missing) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require('expo-iap') as Iap;
    return loaded;
  } catch {
    missing = true;
    return null;
  }
}

/** True when this phone can pay with Google Play. */
export function playBillingAvailable(): boolean {
  // Only the package published in Play can use its billing: the same app
  // installed from the direct link would fail at the first purchase.
  return config.storeBuild && Platform.OS === 'android' && Boolean(config.backend) && iap() !== null;
}

type Purchase = { productId?: string; purchaseToken?: string | null; transactionId?: string | null };

/**
 * Sends the receipt to the project's server, which asks Google and credits the
 * diamonds. Answers how many diamonds were added now (0 if already paid).
 */
async function confirm(purchase: Purchase): Promise<number> {
  const token = purchase.purchaseToken;
  const productId = purchase.productId;
  if (!token || !productId) throw new Error('La compra llegó sin comprobante.');
  const client = getSupabase();
  if (!client) throw new Error('Tu cuenta no está disponible en este teléfono.');
  const session = (await client.auth.getSession()).data.session;
  if (!session) throw new Error('Inicia sesión para recibir tus diamantes.');
  const response = await fetch(`${config.backend}/functions/v1/play-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: config.anonKey,
    },
    body: JSON.stringify({ productId, purchaseToken: token }),
  });
  const value = (await response.json().catch(() => null)) as { credited?: number; error?: string } | null;
  if (!response.ok) throw new Error(value?.error || 'No pudimos confirmar la compra.');
  return Number(value?.credited) || 0;
}

/**
 * The packs with the price Play shows the buyer, and the buying itself.
 * A purchase made while the app was closed is confirmed as soon as it opens.
 */
export function usePlayTopUp() {
  const supported = playBillingAvailable();
  const [ready, setReady] = useState(false);
  const [packs, setPacks] = useState<PlayPack[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  /** Diamonds added by a purchase that arrived while this screen was open. */
  const [credited, setCredited] = useState(0);
  const started = useRef(false);

  /** Takes every purchase Google still holds and asks the server about it. */
  const restore = useCallback(async () => {
    const module = iap();
    if (!module) return 0;
    try {
      const purchases = (await module.getAvailablePurchases()) as Purchase[];
      let total = 0;
      for (const purchase of purchases) {
        if (!purchase.productId || !AMOUNTS[purchase.productId]) continue;
        total += await confirm(purchase);
        await module.finishTransaction({ purchase: purchase as never, isConsumable: true }).catch(() => undefined);
      }
      if (total > 0) setCredited(current => current + total);
      return total;
    } catch {
      return 0;
    }
  }, []);

  useEffect(() => {
    if (!supported || started.current) return;
    started.current = true;
    let live = true;
    const module = iap();
    if (!module) return;
    void (async () => {
      try {
        await module.initConnection();
        const products = await module.fetchProducts({ skus: [...PLAY_PACKS], type: 'in-app' });
        if (!live) return;
        const list: PlayPack[] = [];
        for (const product of products as { id?: string; title?: string; displayPrice?: string; localizedPrice?: string }[]) {
          const amount = product?.id ? AMOUNTS[product.id] : undefined;
          if (!product?.id || !amount) continue;
          list.push({
            id: product.id,
            amount,
            price: product.displayPrice ?? product.localizedPrice ?? '',
            title: product.title ?? `${amount} diamantes`,
          });
        }
        // Cheapest first, the way the packs grow.
        list.sort((a, b) => a.amount - b.amount);
        setPacks(list);
        setReady(true);
        // Anything paid but not yet delivered (app closed, network went away).
        void restore();
      } catch {
        if (live) {
          setReady(true);
          setError('Google Play no respondió. Revisa tu conexión e inténtalo otra vez.');
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [supported, restore]);

  const buy = useCallback(async (id: string) => {
    const module = iap();
    if (!module) throw new Error('Este teléfono no puede pagar con Google Play.');
    setBusy(id);
    setError(null);
    try {
      await module.initConnection();
      const purchase = await new Promise<Purchase>((resolve, reject) => {
        const done = module.purchaseUpdatedListener((event: unknown) => {
          const value = event as Purchase;
          if (value.productId !== id) return;
          done.remove();
          failed.remove();
          resolve(value);
        });
        const failed = module.purchaseErrorListener((event: unknown) => {
          const value = event as { productId?: string; message?: string };
          if (value.productId && value.productId !== id) return;
          done.remove();
          failed.remove();
          reject(new Error(value.message || 'La compra no se completó.'));
        });
        void module
          .requestPurchase({ request: { google: { skus: [id] } }, type: 'in-app' })
          .catch((cause: unknown) => {
            done.remove();
            failed.remove();
            reject(cause instanceof Error ? cause : new Error('La compra no se completó.'));
          });
      });
      const added = await confirm(purchase);
      // Only after the server answered: a receipt that fails here stays owed
      // to the person and is retried by restore() on the next launch.
      await module.finishTransaction({ purchase: purchase as never, isConsumable: true }).catch(() => undefined);
      if (added > 0) setCredited(current => current + added);
      return added;
    } finally {
      setBusy(null);
    }
  }, []);

  return {
    supported,
    ready,
    packs,
    busy,
    error,
    credited,
    buy,
    restore,
    clearCredited: () => setCredited(0),
  };
}
