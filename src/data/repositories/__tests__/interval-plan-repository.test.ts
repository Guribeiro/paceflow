import { DEFAULT_INTERVAL_PLAN, type IntervalPlan } from '../../../domain/interval-plan';
import { InMemoryStorage } from '../../storage/key-value';
import { createIntervalPlanRepository } from '../interval-plan-repository';

const KEY = 'run-interval-plan:v1';

const PLAN: IntervalPlan = {
  warmup: null,
  reps: 6,
  work: { kind: 'time', seconds: 120 },
  recovery: { kind: 'distance', meters: 200 },
  cooldown: { kind: 'distance', meters: 1000 },
  targetSecondsPerKm: 230,
};

describe('IntervalPlanRepository', () => {
  it('começa com o plano padrão', () => {
    expect(createIntervalPlanRepository(new InMemoryStorage()).get()).toEqual(DEFAULT_INTERVAL_PLAN);
  });

  it('guarda o último plano no aparelho', () => {
    const storage = new InMemoryStorage();
    createIntervalPlanRepository(storage).set(PLAN);
    expect(JSON.parse(storage.getString(KEY) ?? 'null')).toEqual(PLAN);
    expect(createIntervalPlanRepository(storage).get()).toEqual(PLAN);
  });

  it('mantém a referência até mudar', () => {
    const repo = createIntervalPlanRepository(new InMemoryStorage());
    const first = repo.get();
    expect(repo.get()).toBe(first);
    repo.set(PLAN);
    const changed = repo.get();
    expect(changed).not.toBe(first);
    expect(repo.get()).toBe(changed);
  });

  it.each([
    ['JSON quebrado', '{quebrado'],
    ['plano fora dos limites', JSON.stringify({ ...PLAN, reps: 0 })],
    ['valor que não é objeto', '42'],
  ])('volta ao padrão com %s gravado', (_, raw) => {
    const storage = new InMemoryStorage();
    storage.set(KEY, raw);
    expect(createIntervalPlanRepository(storage).get()).toEqual(DEFAULT_INTERVAL_PLAN);
  });

  it('ignora um plano inválido sem gravar nem avisar', () => {
    const storage = new InMemoryStorage();
    const repo = createIntervalPlanRepository(storage);
    const listener = jest.fn();
    repo.subscribe(listener);
    repo.set({ ...PLAN, work: { kind: 'distance', meters: 10 } });
    expect(storage.getString(KEY)).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  it('notifica assinantes até cancelarem', () => {
    const repo = createIntervalPlanRepository(new InMemoryStorage());
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.set(PLAN);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repo.set(DEFAULT_INTERVAL_PLAN);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
