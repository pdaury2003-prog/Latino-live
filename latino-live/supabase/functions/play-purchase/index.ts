// Verifies a Google Play purchase and credits its diamonds.
//
// The phone can never be trusted to say "I paid": anyone can send a made-up
// token. So this function asks Google about the token with the app owner's own
// service account, and only then adds the diamonds — once per token.
//
// Configure in Cloud → Keys:
//   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON   the whole JSON key file of the service
//                                      account, with access to this app in
//                                      Play Console (Users and permissions →
//                                      Financial data, orders and cancellations)
//   GOOGLE_PLAY_PACKAGE                optional; defaults to
//                                      com.latinolivechat.app
//
// Body: { productId, purchaseToken }
// Answer: { credited, amount, state } or { error, code }
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** The packs this app sells, and what each one is worth. Server-side truth. */
const PACKS: Record<string, number> = {
  diamonds_100: 100,
  diamonds_500: 500,
  diamonds_1200: 1200,
  diamonds_3000: 3000,
};

type ServiceAccount = { client_email: string; private_key: string; token_uri?: string };

const encoder = new TextEncoder();

function base64url(input: ArrayBuffer | Uint8Array | string): string {
  const bytes = typeof input === 'string'
    ? encoder.encode(input)
    : input instanceof Uint8Array ? input : new Uint8Array(input);
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A signed JWT, exchanged for an access token the Play API accepts. */
async function accessToken(account: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: account.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const pem = account.private_key.replace(/\\n/g, '\n');
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  const raw = Uint8Array.from(atob(body), character => character.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    raw,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch(account.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const value = await response.json().catch(() => null) as { access_token?: string } | null;
  if (!response.ok || !value?.access_token) throw new Error('Google no aceptó la cuenta de servicio');
  return value.access_token;
}

function readAccount(): ServiceAccount | null {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as ServiceAccount;
    if (!value?.client_email || !value?.private_key) return null;
    return value;
  } catch {
    return null;
  }
}

/** Google's own record of one purchase, as the Play Developer API returns it. */
type Purchase = {
  purchaseState?: number;
  acknowledgementState?: number;
  consumptionState?: number;
  orderId?: string;
  purchaseTimeMillis?: string;
  priceAmountMicros?: string;
  priceCurrencyCode?: string;
};

Deno.serve(async (request: Request) => {
  const reply = (body: object, status = 200) => Response.json(body, { status, headers: cors });
  if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
  if (request.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authorization = request.headers.get('authorization') || '';

  // The person: from their signed-in token, never from the body.
  const verified = await fetch(`${url}/auth/v1/user`, { headers: { apikey: admin, authorization } });
  if (!verified.ok) return reply({ error: 'Inicia sesión otra vez.', code: 'auth' }, 401);
  const user = await verified.json() as { id?: string };
  if (typeof user.id !== 'string') return reply({ error: 'Inicia sesión otra vez.', code: 'auth' }, 401);

  let body: { productId?: unknown; purchaseToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: 'Falta la compra.', code: 'body' }, 400);
  }
  const productId = typeof body.productId === 'string' ? body.productId.trim() : '';
  const token = typeof body.purchaseToken === 'string' ? body.purchaseToken.trim() : '';
  const amount = PACKS[productId];
  if (!amount) return reply({ error: 'Ese paquete no existe.', code: 'product' }, 400);
  if (token.length < 8) return reply({ error: 'Falta el comprobante de compra.', code: 'token' }, 400);

  const account = readAccount();
  if (!account) {
    return reply({ error: 'La app todavía no puede comprobar compras de Google.', code: 'not-configured' }, 503);
  }

  const pkg = Deno.env.get('GOOGLE_PLAY_PACKAGE') || 'com.latinolivechat.app';
  try {
    const access = await accessToken(account);
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(pkg)}/purchases/products/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(token)}`;
    const headers = { Authorization: `Bearer ${access}` };

    const check = await fetch(base, { headers });
    if (check.status === 404 || check.status === 400) {
      return reply({ error: 'Google no reconoce esta compra.', code: 'unknown-purchase' }, 402);
    }
    if (check.status === 401 || check.status === 403) {
      return reply({ error: 'La app no tiene permiso para leer compras.', code: 'forbidden' }, 503);
    }
    if (!check.ok) return reply({ error: 'Google no respondió. Inténtalo otra vez.', code: 'google' }, 502);

    const purchase = await check.json() as Purchase;
    // 0 = purchased, 1 = canceled, 2 = pending.
    if (purchase.purchaseState !== 0) {
      return reply({ error: 'Esa compra no está pagada.', code: 'not-paid' }, 402);
    }

    const credit = await fetch(`${url}/rest/v1/rpc/credit_play_purchase`, {
      method: 'POST',
      headers: { apikey: admin, Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_token: token,
        p_user: user.id,
        p_product: productId,
        p_amount: amount,
        p_order: purchase.orderId ?? null,
        p_price_micros: purchase.priceAmountMicros ? Number(purchase.priceAmountMicros) : null,
        p_currency: purchase.priceCurrencyCode ?? null,
        p_purchased_at: purchase.purchaseTimeMillis
          ? new Date(Number(purchase.purchaseTimeMillis)).toISOString()
          : null,
      }),
    });
    const credited = await credit.json().catch(() => null);
    if (!credit.ok) {
      const message = (credited as { message?: string } | null)?.message;
      return reply({ error: message || 'No pudimos acreditar la compra.', code: 'credit' }, 409);
    }

    // A consumable must be consumed or the person can never buy it again.
    // It happens after crediting: if this fails, the next attempt credits
    // nothing (same token) and tries again.
    const consume = await fetch(`${base}:consume`, { method: 'POST', headers });
    return reply({ credited: Number(credited) || 0, amount, state: consume.ok ? 'consumed' : 'credited' });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'unknown';
    return reply({ error: message, code: 'server' }, 502);
  }
});
