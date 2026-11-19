/**
 * Arranque del servidor de juegos: salud, WebSocket autenticado, latido y
 * limpieza de mesas. No imprime configuración ni llaves.
 */

import { createServer, type IncomingMessage } from 'node:http';
import { WebSocketServer } from 'ws';
import { Auth } from './auth.ts';
import { GameHub } from './hub.ts';
import { GameService } from './service.ts';
import { SupabaseStore } from './store.ts';
import { DEFAULT_LIMITS } from '../../packages/games/src/betting.ts';

const env = process.env;
const port = Number(env.PORT ?? 8787);
const supabaseUrl = env.SUPABASE_URL ?? '';
const anonKey = env.SUPABASE_ANON_KEY ?? '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const allowDevAuth = env.ALLOW_DEV_AUTH === '1';
const allowedOrigins = (env.ALLOWED_ORIGINS ?? '')
  .split(',')
  .map(value => value.trim())
  .filter(Boolean);

const store = supabaseUrl && serviceKey ? new SupabaseStore(supabaseUrl, serviceKey) : null;
const service = new GameService({
  store,
  limits: {
    min: Number(env.MIN_BET ?? DEFAULT_LIMITS.min),
    max: Number(env.MAX_BET ?? DEFAULT_LIMITS.max),
    maxDaily: Number(env.MAX_DAILY ?? DEFAULT_LIMITS.maxDaily),
  },
});
const hub = new GameHub(service);
const auth = supabaseUrl && anonKey ? new Auth(supabaseUrl, anonKey) : null;

const server = createServer((request, response) => {
  if (request.url === '/health' || request.url === '/') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      ok: true,
      tables: service.list(null, 'health').length,
      casino: service.casinoEnabled,
      sessions: hub.size,
      now: new Date().toISOString(),
    }));
    return;
  }
  response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end('No encontrado');
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 32_768 });

function tokenFrom(request: IncomingMessage): { token: string; devId: string } {
  const url = new URL(request.url ?? '/', 'http://localhost');
  const header = request.headers.authorization ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  return {
    token: bearer || url.searchParams.get('token') || '',
    devId: allowDevAuth ? url.searchParams.get('dev') || '' : '',
  };
}

server.on('upgrade', (request, socket, head) => {
  const origin = request.headers.origin;
  if (allowedOrigins.length > 0 && origin && !allowedOrigins.includes(origin)) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  const { token, devId } = tokenFrom(request);
  const finish = async () => {
    try {
      const actor = devId
        ? { userId: `dev-${devId}`, name: `Dev ${devId}` }
        : auth
          ? await auth.identify(token)
          : null;
      if (!actor) throw new Error('Sin autenticación.');
      wss.handleUpgrade(request, socket, head, ws => hub.attach(ws, actor));
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
    }
  };
  void finish();
});

const heartbeat = setInterval(() => hub.heartbeat(), 30_000);
const sweeper = setInterval(() => void hub.sweep(), 60_000);

server.listen(port, () => {
  process.stdout.write(`[games] escuchando en :${port} · casino ${service.casinoEnabled ? 'activo' : 'sin base'}\n`);
});

function shutdown(signal: string): void {
  process.stdout.write(`[games] cerrando por ${signal}\n`);
  clearInterval(heartbeat);
  clearInterval(sweeper);
  wss.close();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
