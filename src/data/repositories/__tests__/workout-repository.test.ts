import { InMemoryStorage } from '../../storage/key-value';
import type { Workout } from '../../../domain/workout';
import { type NewWorkout, createWorkoutRepository } from '../workout-repository';

const base: NewWorkout = {
  date: '2026-10-29T07:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1500,
  terrain: 'rua',
};

function setup() {
  const storage = new InMemoryStorage();
  let seq = 0;
  let now = Date.parse('2026-10-29T10:00:00.000Z');
  const repo = createWorkoutRepository(storage, {
    generateId: () => `id-${++seq}`,
    now: () => new Date(now).toISOString(),
  });
  return { storage, repo, advance: (ms: number) => (now += ms) };
}

function created(result: ReturnType<ReturnType<typeof setup>['repo']['create']>) {
  if (!result.ok) throw new Error(`esperava ok, recebeu ${result.error}`);
  return result.value;
}

describe('WorkoutRepository', () => {
  it('cria um treino com id, timestamps e sem deletedAt', () => {
    const { repo } = setup();
    const workout = created(repo.create({ ...base, rpe: 7, note: 'Tiros 400 m' }));
    expect(workout).toEqual({
      ...base,
      rpe: 7,
      note: 'Tiros 400 m',
      id: 'id-1',
      createdAt: '2026-10-29T10:00:00.000Z',
      updatedAt: '2026-10-29T10:00:00.000Z',
      deletedAt: null,
    });
    expect(repo.getById('id-1')).toEqual(workout);
  });

  it('persiste entre instâncias do repositório', () => {
    const { storage, repo } = setup();
    created(repo.create(base));
    const other = createWorkoutRepository(storage);
    expect(other.list()).toHaveLength(1);
  });

  it('lista do treino mais recente para o mais antigo', () => {
    const { repo } = setup();
    created(repo.create({ ...base, date: '2026-10-27T07:00:00.000Z' }));
    created(repo.create({ ...base, date: '2026-10-29T07:00:00.000Z' }));
    created(repo.create({ ...base, date: '2026-10-28T07:00:00.000Z' }));
    expect(repo.list().map((w) => w.id)).toEqual(['id-2', 'id-3', 'id-1']);
  });

  it('descarta campos opcionais vazios', () => {
    const { repo } = setup();
    const workout = created(repo.create({ ...base, note: '   ' }));
    expect(workout).not.toHaveProperty('note');
    expect(workout).not.toHaveProperty('rpe');
  });

  it('remove com soft delete: some da listagem, mas fica marcado', () => {
    const { repo, advance } = setup();
    created(repo.create(base));
    advance(60_000);
    expect(repo.remove('id-1')).toBe(true);
    expect(repo.list()).toEqual([]);
    expect(repo.getById('id-1')).toBeUndefined();
    expect(repo.listAll()[0]).toMatchObject({
      deletedAt: '2026-10-29T10:01:00.000Z',
      updatedAt: '2026-10-29T10:01:00.000Z',
    });
  });

  it('remove retorna false para id inexistente ou já removido', () => {
    const { repo } = setup();
    expect(repo.remove('nope')).toBe(false);
    created(repo.create(base));
    repo.remove('id-1');
    expect(repo.remove('id-1')).toBe(false);
  });

  describe('update', () => {
    it('altera campos, atualiza updatedAt e mantém createdAt', () => {
      const { repo, advance } = setup();
      created(repo.create({ ...base, rpe: 5 }));
      advance(60_000);
      const result = repo.update('id-1', { terrain: 'pista', rpe: 8, note: 'Intervalado' });
      expect(result).toEqual({
        ok: true,
        value: expect.objectContaining({
          terrain: 'pista',
          rpe: 8,
          note: 'Intervalado',
          distanceMeters: 5000,
          createdAt: '2026-10-29T10:00:00.000Z',
          updatedAt: '2026-10-29T10:01:00.000Z',
        }),
      });
      expect(repo.getById('id-1')).toMatchObject({ terrain: 'pista', rpe: 8 });
    });

    it('null limpa RPE e nota', () => {
      const { repo } = setup();
      created(repo.create({ ...base, rpe: 5, note: 'Leve' }));
      const result = repo.update('id-1', { rpe: null, note: null });
      if (!result.ok) throw new Error(result.error);
      expect(result.value).not.toHaveProperty('rpe');
      expect(result.value).not.toHaveProperty('note');
    });

    it('nota só com espaços também limpa', () => {
      const { repo } = setup();
      created(repo.create({ ...base, note: 'Leve' }));
      const result = repo.update('id-1', { note: '   ' });
      if (!result.ok) throw new Error(result.error);
      expect(result.value).not.toHaveProperty('note');
    });

    it('valida o resultado e não grava se for inválido', () => {
      const { repo } = setup();
      created(repo.create(base));
      expect(repo.update('id-1', { distanceMeters: 0 })).toEqual({ ok: false, error: 'INVALID_DISTANCE' });
      expect(repo.update('id-1', { rpe: 11 })).toEqual({ ok: false, error: 'INVALID_RPE' });
      expect(repo.getById('id-1')).toMatchObject({ distanceMeters: 5000 });
    });

    it('retorna NOT_FOUND para id inexistente ou removido', () => {
      const { repo } = setup();
      expect(repo.update('nope', { rpe: 5 })).toEqual({ ok: false, error: 'NOT_FOUND' });
      created(repo.create(base));
      repo.remove('id-1');
      expect(repo.update('id-1', { rpe: 5 })).toEqual({ ok: false, error: 'NOT_FOUND' });
    });

    it('notifica assinantes e reordena a lista se a data mudar', () => {
      const { repo } = setup();
      created(repo.create({ ...base, date: '2026-10-28T07:00:00.000Z' }));
      created(repo.create({ ...base, date: '2026-10-29T07:00:00.000Z' }));
      const listener = jest.fn();
      repo.subscribe(listener);
      repo.update('id-1', { date: '2026-10-30T07:00:00.000Z' });
      expect(listener).toHaveBeenCalledTimes(1);
      expect(repo.list().map((w) => w.id)).toEqual(['id-1', 'id-2']);
    });
  });

  describe('importWorkouts', () => {
    const imported = (overrides: Partial<Workout> = {}): Workout => ({
      ...base,
      id: 'imp-1',
      createdAt: '2026-10-20T10:00:00.000Z',
      updatedAt: '2026-10-20T10:00:00.000Z',
      deletedAt: null,
      ...overrides,
    });

    it('adiciona treinos novos preservando id e timestamps', () => {
      const { repo } = setup();
      expect(repo.importWorkouts([imported()])).toEqual({ added: 1, updated: 0, unchanged: 0 });
      expect(repo.getById('imp-1')).toEqual(imported());
    });

    it('substitui quando o importado é mais recente', () => {
      const { repo } = setup();
      repo.importWorkouts([imported({ terrain: 'rua' })]);
      const summary = repo.importWorkouts([imported({ terrain: 'pista', updatedAt: '2026-10-21T10:00:00.000Z' })]);
      expect(summary).toEqual({ added: 0, updated: 1, unchanged: 0 });
      expect(repo.getById('imp-1')).toMatchObject({ terrain: 'pista' });
    });

    it('mantém o local quando ele é igual ou mais recente', () => {
      const { repo } = setup();
      repo.importWorkouts([imported({ terrain: 'pista', updatedAt: '2026-10-21T10:00:00.000Z' })]);
      const summary = repo.importWorkouts([imported({ terrain: 'rua' }), imported({ terrain: 'esteira', updatedAt: '2026-10-21T10:00:00.000Z' })]);
      expect(summary).toEqual({ added: 0, updated: 0, unchanged: 2 });
      expect(repo.getById('imp-1')).toMatchObject({ terrain: 'pista' });
    });

    it('não ressuscita treino removido depois do backup', () => {
      const { repo } = setup();
      created(repo.create(base)); // id-1, updatedAt 10:00
      repo.remove('id-1');
      const summary = repo.importWorkouts([
        { ...base, id: 'id-1', createdAt: '2026-10-29T09:00:00.000Z', updatedAt: '2026-10-29T09:30:00.000Z', deletedAt: null },
      ]);
      expect(summary).toEqual({ added: 0, updated: 0, unchanged: 1 });
      expect(repo.getById('id-1')).toBeUndefined();
    });

    it('notifica uma única vez e só se algo mudou', () => {
      const { repo } = setup();
      const listener = jest.fn();
      repo.subscribe(listener);
      repo.importWorkouts([imported(), imported({ id: 'imp-2' })]);
      expect(listener).toHaveBeenCalledTimes(1);
      repo.importWorkouts([imported()]);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('não duplica o id no índice', () => {
      const { storage, repo } = setup();
      repo.importWorkouts([imported()]);
      repo.importWorkouts([imported({ updatedAt: '2026-10-22T10:00:00.000Z' })]);
      expect(JSON.parse(storage.getString('workouts:v1:index')!)).toEqual(['imp-1']);
    });
  });

  describe('validação', () => {
    it.each([
      [{ distanceMeters: 0 }, 'INVALID_DISTANCE'],
      [{ distanceMeters: NaN }, 'INVALID_DISTANCE'],
      [{ durationSeconds: -1 }, 'INVALID_DURATION'],
      [{ terrain: 'trilha' }, 'INVALID_TERRAIN'],
      [{ rpe: 0 }, 'INVALID_RPE'],
      [{ rpe: 11 }, 'INVALID_RPE'],
      [{ rpe: 6.5 }, 'INVALID_RPE'],
      [{ date: 'ontem' }, 'INVALID_DATE'],
      [{ note: 'x'.repeat(281) }, 'INVALID_NOTE'],
    ])('%p → %s', (patch, error) => {
      const { repo } = setup();
      expect(repo.create({ ...base, ...patch } as NewWorkout)).toEqual({ ok: false, error });
      expect(repo.list()).toEqual([]);
    });
  });

  describe('robustez', () => {
    it('ignora registros corrompidos sem quebrar a listagem', () => {
      const { storage, repo } = setup();
      created(repo.create(base));
      created(repo.create(base));
      storage.set('workouts:v1:id-1', '{não é json');
      expect(repo.list().map((w) => w.id)).toEqual(['id-2']);
    });

    it('ignora registros com formato inválido', () => {
      const { storage, repo } = setup();
      created(repo.create(base));
      storage.set('workouts:v1:id-1', JSON.stringify({ id: 'id-1', distanceMeters: 'cinco' }));
      expect(repo.list()).toEqual([]);
    });

    it('ignora ids do índice sem registro', () => {
      const { storage, repo } = setup();
      created(repo.create(base));
      storage.remove('workouts:v1:id-1');
      expect(repo.list()).toEqual([]);
    });

    it('trata índice corrompido como vazio', () => {
      const { storage, repo } = setup();
      storage.set('workouts:v1:index', 'lixo');
      expect(repo.list()).toEqual([]);
      created(repo.create(base));
      expect(repo.list()).toHaveLength(1);
    });
  });

  describe('subscribe', () => {
    it('notifica em create e remove, e para após unsubscribe', () => {
      const { repo } = setup();
      const listener = jest.fn();
      const unsubscribe = repo.subscribe(listener);
      created(repo.create(base));
      repo.remove('id-1');
      expect(listener).toHaveBeenCalledTimes(2);
      unsubscribe();
      created(repo.create(base));
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('list devolve a mesma referência enquanto nada muda', () => {
      const { repo } = setup();
      created(repo.create(base));
      const first = repo.list();
      expect(repo.list()).toBe(first);
      created(repo.create(base));
      expect(repo.list()).not.toBe(first);
    });
  });
});
