/**
 * Prueba de humo: levanta el servidor real en un puerto libre, conecta dos
 * teléfonos simulados y juega una jugada de ajedrez. Se apaga sola.
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import WebSocket, { type RawData } from 'ws';

const port = 8899;
const base = `http://127.0.0.1:${port}`;

type Message = { type: string; [key: string]: unknown };

type Waiter = {
  match: (message: Message) => boolean;
  resolve: (message: Message) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

type Peer = {
  socket: WebSocket;
  queue: Message[];
  waiters: Waiter[];
};

function open(dev: string): Promise<Peer> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?dev=${dev}`);
    const peer: Peer = { socket, queue: [], waiters: [] };
    socket.on('message', (raw: RawData) => {
      const message = JSON.parse(raw.toString()) as Message;
      const index = peer.waiters.findIndex(waiter => waiter.match(message));
      if (index < 0) {
        peer.queue.push(message);
        return;
      }
      const [waiter] = peer.waiters.splice(index, 1);
      if (!waiter) return;
      clearTimeout(waiter.timer);
      waiter.resolve(message);
    });
    socket.once('open', () => resolve(peer));
    socket.once('error', reject);
  });
}

function next(peer: Peer, match: (message: Message) => boolean, timeout = 4_000): Promise<Message> {
  return new Promise((resolve, reject) => {
    const index = peer.queue.findIndex(match);
    if (index >= 0) {
      const [message] = peer.queue.splice(index, 1);
      resolve(message!);
      return;
    }
    const waiter: Waiter = {
      match,
      resolve,
      reject,
      timer: setTimeout(() => {
        peer.waiters = peer.waiters.filter(item => item !== waiter);
        reject(new Error('La respuesta no llegó'));
      }, timeout),
    };
    peer.waiters.push(waiter);
  });
}

async function main(): Promise<void> {
  const child = spawn(process.execPath, ['--experimental-strip-types', 'src/index.ts'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: { ...process.env, PORT: String(port), ALLOW_DEV_AUTH: '1' },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  try {
    let healthy = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      try {
        const response = await fetch(`${base}/health`);
        healthy = response.ok;
        if (healthy) break;
      } catch {
        await sleep(150);
      }
    }
    if (!healthy) throw new Error('El servidor no respondió');

    const ana = await open('a');
    const leo = await open('b');
    try {
      const readyA = await next(ana, message => message.type === 'ready');
      const readyB = await next(leo, message => message.type === 'ready');
      if (readyA.userId !== 'dev-a' || readyB.userId !== 'dev-b') throw new Error('Identidad equivocada');

      const room = '00000000-0000-0000-0000-000000000001';
      const joinedA = next(ana, message => message.type === 'table.list');
      ana.socket.send(JSON.stringify({ type: 'room.join', roomId: room }));
      await joinedA;
      const joinedB = next(leo, message => message.type === 'table.list');
      leo.socket.send(JSON.stringify({ type: 'room.join', roomId: room }));
      await joinedB;

      const createdOnBoth = Promise.all([
        next(ana, message => message.type === 'table.state'),
        next(leo, message => message.type === 'table.state'),
      ]);
      ana.socket.send(JSON.stringify({
        type: 'table.create',
        kind: 'chess',
        roomId: room,
        seats: ['dev-a', 'dev-b'],
      }));
      const [created] = await createdOnBoth;
      const table = created.table as { id: string; status: string; version: number; state?: { kind: string } };
      if (table.status !== 'playing' || table.state?.kind !== 'chess') throw new Error('La mesa no abrió');

      const movedOnBoth = Promise.all([
        next(ana, message => message.type === 'table.state' && (message.table as { version: number }).version > table.version),
        next(leo, message => message.type === 'table.state' && (message.table as { version: number }).version > table.version),
      ]);
      ana.socket.send(JSON.stringify({
        type: 'table.action',
        tableId: table.id,
        action: { type: 'move', from: 'e2', to: 'e4' },
      }));
      const [after] = await movedOnBoth;
      const moved = after.table as { state: { lastMove?: { from: number } } };
      if (moved.state.lastMove?.from !== 52) throw new Error('La jugada no llegó');

      const denied = next(ana, message => message.type === 'error');
      ana.socket.send(JSON.stringify({ type: 'table.create', kind: 'slots', stake: 50 }));
      const error = await denied;
      if (!/casino/i.test(String(error.message))) throw new Error('El casino debía estar cerrado sin base');

      process.stdout.write('smoke: dos conexiones, mesa, jugada y aviso de casino correctos\n');
    } finally {
      ana.socket.close();
      leo.socket.close();
    }
  } finally {
    child.kill('SIGTERM');
    await sleep(300);
    if (!child.killed) child.kill('SIGKILL');
  }
}

main().catch(error => {
  process.stderr.write(`smoke: ${error instanceof Error ? error.message : 'falló'}\n`);
  process.exit(1);
});
