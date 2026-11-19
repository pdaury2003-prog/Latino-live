import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { GameService, type GameStore, type OpenTableInput } from '../src/service.ts';

class FakeStore implements GameStore {
  opened: OpenTableInput[] = [];
  saves: Array<{ id: string; status: string; version: number }> = [];
  charges: Array<{ table: string; user: string; total: number }> = [];
  credits: Array<{ table: string; user: string; total: number }> = [];
  members: Record<string, string[]> = { r1: ['ana', 'leo'], r2: ['ana'] };
  failCharge = false;

  async openTable(input: OpenTableInput): Promise<string> {
    this.opened.push(input);
    return randomUUID();
  }

  async saveTable(
    id: string,
    _state: unknown,
    status: 'playing' | 'finished',
    _stake: number,
    version: number,
  ): Promise<number> {
    this.saves.push({ id, status, version });
    return version + 1;
  }

  async charge(tableId: string, userId: string, total: number): Promise<number> {
    if (this.failCharge) throw new Error('Te faltan diamantes');
    this.charges.push({ table: tableId, user: userId, total });
    return 0;
  }

  async credit(tableId: string, userId: string, total: number): Promise<number> {
    this.credits.push({ table: tableId, user: userId, total });
    return 0;
  }

  async people(ids: string[]): Promise<Map<string, string>> {
    return new Map(ids.map(id => [id, id === 'ana' ? 'Ana' : 'Leo']));
  }

  async roomMembers(roomId: string): Promise<Set<string>> {
    return new Set(this.members[roomId] ?? []);
  }
}

const ana = { userId: 'ana', name: 'Ana' };
const leo = { userId: 'leo', name: 'Leo' };

function service(store: FakeStore | null, rng = () => 0.99): GameService {
  return new GameService({ store, rng, onChange: () => undefined });
}

test('a table game needs a room', async () => {
  const store = new FakeStore();
  await assert.rejects(
    () => service(store).create(ana, { kind: 'chess', seats: ['ana', 'leo'] }),
    /sala/i,
  );
});

test('a chess table starts with two seated people and no money', async () => {
  const store = new FakeStore();
  const view = await service(store).create(ana, {
    kind: 'chess',
    roomId: 'r1',
    seats: ['ana', 'leo'],
  });
  assert.equal(view.status, 'playing');
  assert.equal(view.state?.kind, 'chess');
  assert.equal(store.opened.length, 1);
  assert.equal(store.saves.length, 1);
  assert.equal(store.charges.length, 0);
  assert.equal(view.seats[0]!.name, 'Ana');
});

test('a move is validated, saved and visible to both', async () => {
  const store = new FakeStore();
  const game = service(store);
  const created = await game.create(ana, { kind: 'chess', roomId: 'r1', seats: ['ana', 'leo'] });
  const moved = await game.act(ana, created.id, { type: 'move', userId: 'ana', from: 'e2', to: 'e4' });
  assert.equal(moved.state?.kind, 'chess');
  if (moved.state?.kind !== 'chess') return;
  assert.equal(moved.state.lastMove?.from, 52);
  assert.equal(moved.state.turn, 'b');
  assert.equal(store.saves.length, 2);
  assert.equal(moved.version, 2);
});

test('a move out of turn never reaches the base', async () => {
  const store = new FakeStore();
  const game = service(store);
  const created = await game.create(ana, { kind: 'chess', roomId: 'r1', seats: ['ana', 'leo'] });
  await assert.rejects(
    () => game.act(leo, created.id, { type: 'move', userId: 'leo', from: 'e7', to: 'e5' }),
    /turno/i,
  );
  assert.equal(store.saves.length, 1);
});

test('slots charges the stake and credits the whole prize', async () => {
  const store = new FakeStore();
  const view = await service(store).create(ana, { kind: 'slots', stake: 50 });
  assert.equal(view.status, 'finished');
  assert.equal(store.charges.length, 1);
  assert.equal(store.charges[0]!.total, 50);
  assert.equal(store.credits.length, 1);
  if (view.state?.kind !== 'slots') return assert.fail('expected slots');
  assert.equal(store.credits[0]!.total, view.state.totalWin);
  assert.equal(view.state.totalWin, 1_700);
});

test('the casino refuses to open without the wallet connection', async () => {
  await assert.rejects(
    () => service(null).create(ana, { kind: 'slots', stake: 50 }),
    /casino/i,
  );
});

test('a failed charge aborts the table and leaves a closed row', async () => {
  const store = new FakeStore();
  store.failCharge = true;
  await assert.rejects(
    () => service(store).create(ana, { kind: 'slots', stake: 50 }),
    /faltan/i,
  );
  const closed = store.saves.find(save => save.status === 'finished');
  assert.ok(closed, 'the abandoned table is marked finished');
});

test('poker waits until every invited player confirms', async () => {
  const store = new FakeStore();
  const game = service(store);
  const waiting = await game.create(ana, {
    kind: 'poker',
    roomId: 'r1',
    seats: ['ana', 'leo'],
    stake: 100,
  });
  assert.equal(waiting.status, 'waiting');
  assert.equal(waiting.state, null);
  assert.equal(store.charges.length, 0);
  const playing = await game.ready(leo, waiting.id);
  assert.equal(playing.status, 'playing');
  assert.equal(playing.state?.kind, 'poker');
  assert.deepEqual(
    store.charges.map(item => [item.user, item.total]).sort(),
    [['ana', 1], ['leo', 2]],
  );
});

test('a private table is listed only for its owner', async () => {
  const store = new FakeStore();
  const game = service(store);
  await game.create(ana, { kind: 'roulette', stake: 50 });
  assert.equal(game.list('r1', 'ana').length, 1);
  assert.equal(game.list('r1', 'leo').length, 0);
});

test('a public table is listed to the room', async () => {
  const store = new FakeStore();
  const game = service(store);
  await game.create(ana, { kind: 'chess', roomId: 'r1', seats: ['ana', 'leo'] });
  assert.equal(game.list('r1', 'leo').length, 1);
  assert.equal(game.list('r2', 'leo').length, 0);
});

test('poker hides the other hands until the showdown', async () => {
  const store = new FakeStore();
  const game = service(store, () => 0.42);
  const waiting = await game.create(ana, {
    kind: 'poker',
    roomId: 'r1',
    seats: ['ana', 'leo'],
    stake: 100,
  });
  await game.ready(leo, waiting.id);
  const mine = game.get(waiting.id, 'ana');
  const theirs = game.get(waiting.id, 'leo');
  const stranger = game.get(waiting.id, 'nadie');
  if (mine.state?.kind !== 'poker' || theirs.state?.kind !== 'poker' || stranger.state?.kind !== 'poker') {
    return assert.fail('expected poker');
  }
  assert.equal(mine.state.hole[0]!.length, 2);
  assert.equal(mine.state.hole[1]!.length, 0);
  assert.equal(theirs.state.hole[0]!.length, 0);
  assert.equal(theirs.state.hole[1]!.length, 2);
  assert.equal(stranger.state.hole[0]!.length, 0);
});

test('only people from the room may open a table there', async () => {
  const store = new FakeStore();
  await assert.rejects(
    () => service(store).create(leo, {
      kind: 'chess',
      roomId: 'r2',
      seats: ['leo', 'ana'],
    }),
    /sala|jugadores/i,
  );
});

test('a table can be read back by id', async () => {
  const store = new FakeStore();
  const game = service(store);
  const created = await game.create(ana, { kind: 'chess', roomId: 'r1', seats: ['ana', 'leo'] });
  assert.equal(game.get(created.id, 'ana').id, created.id);
  assert.throws(() => game.get('no-existe', 'ana'), /no existe/i);
});
