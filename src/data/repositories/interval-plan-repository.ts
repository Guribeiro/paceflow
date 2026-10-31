import { DEFAULT_INTERVAL_PLAN, type IntervalPlan, parseIntervalPlan } from '../../domain/interval-plan';
import type { KeyValueStorage } from '../storage/key-value';

// Por aparelho, fora do sync: o último treino montado pré-preenche o próximo.
const KEY = 'run-interval-plan:v1';

export interface IntervalPlanRepository {
  /** Referência estável até mudar (para useSyncExternalStore). */
  get(): IntervalPlan;
  set(plan: IntervalPlan): void;
  subscribe(listener: () => void): () => void;
}

export function createIntervalPlanRepository(storage: KeyValueStorage): IntervalPlanRepository {
  const listeners = new Set<() => void>();
  let cache: { raw: string | undefined; value: IntervalPlan } | null = null;

  return {
    get() {
      const raw = storage.getString(KEY);
      if (cache && cache.raw === raw) return cache.value;
      let value: IntervalPlan | null = null;
      try {
        value = raw === undefined ? null : parseIntervalPlan(JSON.parse(raw));
      } catch {
        value = null;
      }
      cache = { raw, value: value ?? DEFAULT_INTERVAL_PLAN };
      return cache.value;
    },

    set(plan) {
      const valid = parseIntervalPlan(plan);
      if (!valid) return;
      storage.set(KEY, JSON.stringify(valid));
      listeners.forEach((listener) => listener());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
