import { type Workout, parseWorkoutRecord } from '../../../domain/workout';
import { type Shoe, parseShoeRecord } from '../../../domain/shoe';
import { createShoeRepository } from '../../repositories/shoe-repository';
import { createWorkoutRepository } from '../../repositories/workout-repository';
import { InMemoryStorage } from '../../storage/key-value';
import { type Remote, type SyncRemote, createSyncEngine } from '../sync-engine';
import { createSyncState } from '../sync-state';

/** Servidor falso com as regras do trigger: LWW por updatedAt e relógio próprio. */
function createFakeServer() {
  const rows = new Map<string, Remote<Workout>>();
  let clock = Date.parse('2026-10-29T12:00:00.000Z');
  const tick = () => new Date((clock += 1000)).toISOString();
  let failNext: Error | null = null;
  const pushes: Workout[][] = [];

  const remote: SyncRemote<Workout> = {
    async push(workouts) {
      if (failNext) {
        const error = failNext;
        failNext = null;
        throw error;
      }
      pushes.push(workouts);
      for (const w of workouts) {
        const current = rows.get(w.id);
        if (current && Date.parse(w.updatedAt) <= Date.parse(current.updatedAt)) continue;
        rows.set(w.id, { ...w, createdAt: current?.createdAt ?? w.createdAt, serverUpdatedAt: tick() });
      }
    },
    async pull(since) {
      return [...rows.values()]
        .filter((r) => since === null || r.serverUpdatedAt > since)
        .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt));
    },
  };

  return {
    remote,
    rows,
    pushes,
    failOnce: (error: Error) => {
      failNext = error;
    },
    /** Simula outro aparelho gravando direto no servidor. */
    write: (w: Workout) => rows.set(w.id, { ...w, serverUpdatedAt: tick() }),
  };
}

function createDevice(server: ReturnType<typeof createFakeServer>, name: string) {
  const storage = new InMemoryStorage();
  const state = createSyncState(storage);
  let seq = 0;
  let clock = Date.parse('2026-10-29T10:00:00.000Z');
  const now = () => new Date((clock += 1000)).toISOString();
  const repo = createWorkoutRepository(storage, {
    generateId: () => `${name}-${++seq}`,
    now,
    onLocalChange: (ids) => state.markDirty(ids),
  });
  const engine = createSyncEngine({ repo, remote: server.remote, state, now, parse: parseWorkoutRecord });
  return { repo, state, engine, advance: (ms: number) => (clock += ms) };
}

const newWorkout = { date: '2026-10-29T07:00:00.000Z', distanceMeters: 5000, durationSeconds: 1500, terrain: 'rua' as const };

const remoteOnly = (id: string, overrides: Partial<Workout> = {}): Workout => ({
  ...newWorkout,
  id,
  createdAt: '2026-10-28T10:00:00.000Z',
  updatedAt: '2026-10-28T10:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('SyncEngine', () => {
  it('primeira sincronização sobe o histórico que existia antes do login', async () => {
    const server = createFakeServer();
    const storage = new InMemoryStorage();
    // Treino criado antes de existir rastreio (ex.: app antigo): não está na fila.
    createWorkoutRepository(storage, { generateId: () => 'old-1' }).create(newWorkout);
    const state = createSyncState(storage);
    const repo = createWorkoutRepository(storage);
    const engine = createSyncEngine({ repo, remote: server.remote, state, parse: parseWorkoutRecord });

    const result = await engine.sync();

    expect(result).toMatchObject({ ok: true, pushed: 1, pulled: 1 });
    expect(server.rows.has('old-1')).toBe(true);
    expect(state.getDirty()).toEqual([]);
  });

  it('não reenvia tudo nas sincronizações seguintes', async () => {
    const server = createFakeServer();
    const device = createDevice(server, 'a');
    device.repo.create(newWorkout);
    await device.engine.sync();

    const result = await device.engine.sync();
    expect(result).toMatchObject({ ok: true, pushed: 0 });
  });

  it('leva um treino de um aparelho para o outro', async () => {
    const server = createFakeServer();
    const phone = createDevice(server, 'phone');
    const web = createDevice(server, 'web');

    phone.repo.create({ ...newWorkout, note: 'Do celular' });
    await phone.engine.sync();
    await web.engine.sync();

    expect(web.repo.getById('phone-1')).toMatchObject({ note: 'Do celular' });
  });

  it('propaga exclusões', async () => {
    const server = createFakeServer();
    const phone = createDevice(server, 'phone');
    const web = createDevice(server, 'web');
    phone.repo.create(newWorkout);
    await phone.engine.sync();
    await web.engine.sync();

    web.repo.remove('phone-1');
    await web.engine.sync();
    await phone.engine.sync();

    expect(phone.repo.getById('phone-1')).toBeUndefined();
    expect(server.rows.get('phone-1')?.deletedAt).not.toBeNull();
  });

  it('a edição mais recente vence nos dois sentidos', async () => {
    const server = createFakeServer();
    const phone = createDevice(server, 'phone');
    const web = createDevice(server, 'web');
    phone.repo.create(newWorkout);
    await phone.engine.sync();
    await web.engine.sync();

    phone.repo.update('phone-1', { note: 'antiga' });
    web.advance(60_000); // a edição da web acontece depois
    web.repo.update('phone-1', { note: 'nova' });

    await web.engine.sync();
    await phone.engine.sync(); // envia a antiga (servidor ignora) e recebe a nova

    expect(server.rows.get('phone-1')?.note).toBe('nova');
    expect(phone.repo.getById('phone-1')?.note).toBe('nova');
  });

  it('dados recebidos do servidor não voltam para a fila', async () => {
    const server = createFakeServer();
    const device = createDevice(server, 'a');
    server.write(remoteOnly('remote-1'));

    await device.engine.sync();

    expect(device.repo.getById('remote-1')).toBeDefined();
    expect(device.state.getDirty()).toEqual([]);
  });

  it('erro de rede preserva a fila e reporta a falha', async () => {
    const server = createFakeServer();
    const device = createDevice(server, 'a');
    device.repo.create(newWorkout);
    server.failOnce(new Error('Network request failed'));

    const result = await device.engine.sync();

    expect(result).toEqual({ ok: false, error: 'Network request failed' });
    expect(device.state.getDirty()).toEqual(['a-1']);
    expect(device.state.getLastSync()).toMatchObject({ error: 'Network request failed' });

    expect(await device.engine.sync()).toMatchObject({ ok: true, pushed: 1 });
    expect(device.state.getDirty()).toEqual([]);
  });

  it('treino editado durante o envio continua pendente', async () => {
    const server = createFakeServer();
    const device = createDevice(server, 'a');
    device.repo.create(newWorkout);
    const originalPush = server.remote.push;
    server.remote.push = async (workouts) => {
      device.repo.update('a-1', { note: 'editado no meio do envio' });
      await originalPush(workouts);
    };

    await device.engine.sync();

    expect(device.state.getDirty()).toEqual(['a-1']);
  });

  it('puxa com margem de 1 minuto antes do cursor', async () => {
    const server = createFakeServer();
    const pull = jest.spyOn(server.remote, 'pull');
    const device = createDevice(server, 'a');
    server.write(remoteOnly('r1'));
    await device.engine.sync();
    const cursor = device.state.getCursor()!;

    await device.engine.sync();

    expect(pull).toHaveBeenLastCalledWith(new Date(Date.parse(cursor) - 60_000).toISOString());
  });

  it('ignora registros inválidos vindos do servidor', async () => {
    const server = createFakeServer();
    const device = createDevice(server, 'a');
    server.write(remoteOnly('ok-1'));
    server.write({ ...remoteOnly('bad-1'), distanceMeters: -5 });

    await device.engine.sync();

    expect(device.repo.getById('ok-1')).toBeDefined();
    expect(device.repo.getById('bad-1')).toBeUndefined();
  });

  it('envia em lotes', async () => {
    const server = createFakeServer();
    const storage = new InMemoryStorage();
    const state = createSyncState(storage);
    let seq = 0;
    const repo = createWorkoutRepository(storage, {
      generateId: () => `w-${++seq}`,
      onLocalChange: (ids) => state.markDirty(ids),
    });
    for (let i = 0; i < 5; i++) repo.create(newWorkout);
    const engine = createSyncEngine({ repo, remote: server.remote, state, batchSize: 2, parse: parseWorkoutRecord });

    await engine.sync();

    expect(server.pushes.map((b) => b.length)).toEqual([2, 2, 1]);
  });

  it('não roda duas sincronizações ao mesmo tempo', async () => {
    const server = createFakeServer();
    const pull = jest.spyOn(server.remote, 'pull');
    const device = createDevice(server, 'a');

    const [first, second] = await Promise.all([device.engine.sync(), device.engine.sync()]);

    expect(first).toBe(second);
    expect(pull).toHaveBeenCalledTimes(1);
  });

  it('funciona para outra coleção (tênis) com o mesmo motor', async () => {
    const storage = new InMemoryStorage();
    const state = createSyncState(storage, 'sync:v1:shoes:');
    const repo = createShoeRepository(storage, { generateId: () => 'shoe-1', onLocalChange: (ids) => state.markDirty(ids) });
    const rows = new Map<string, Remote<Shoe>>();
    const remote: SyncRemote<Shoe> = {
      async push(records) {
        records.forEach((r) => rows.set(r.id, { ...r, serverUpdatedAt: '2026-10-29T12:00:00.000Z' }));
      },
      async pull() {
        return [...rows.values()];
      },
    };
    repo.create({ name: 'Pegasus' });

    const result = await createSyncEngine({ repo, remote, state, parse: parseShoeRecord }).sync();

    expect(result).toMatchObject({ ok: true, pushed: 1 });
    expect(rows.get('shoe-1')?.name).toBe('Pegasus');
    expect(state.getDirty()).toEqual([]);
  });
});

