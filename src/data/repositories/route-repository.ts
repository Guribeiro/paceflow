import { type Route, parseRoute } from '../../domain/route';
import type { KeyValueStorage } from '../storage/key-value';

// Por aparelho, fora do sync: o trajeto nunca vai para o Supabase.
const PREFIX = 'routes:v1:';

export interface RouteRepository {
  /** Referência estável até mudar; null sem trajeto ou com o salvo corrompido. */
  get(workoutId: string): Route | null;
  /** Só confere se há algo salvo, sem ler (para decidir se mostra "Ver trajeto"). */
  has(workoutId: string): boolean;
  set(workoutId: string, route: Route): void;
  remove(workoutId: string): void;
  /** Grava os trajetos de treinos que ainda não têm um; devolve quantos entraram. */
  importRoutes(routes: Readonly<Record<string, Route>>): number;
  subscribe(listener: () => void): () => void;
}

export function createRouteRepository(storage: KeyValueStorage): RouteRepository {
  const listeners = new Set<() => void>();
  const cache = new Map<string, { raw: string | undefined; value: Route | null }>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    get(workoutId) {
      const raw = storage.getString(PREFIX + workoutId);
      const cached = cache.get(workoutId);
      if (cached && cached.raw === raw) return cached.value;
      let value: Route | null = null;
      try {
        value = raw === undefined ? null : parseRoute(JSON.parse(raw));
      } catch {
        value = null;
      }
      cache.set(workoutId, { raw, value });
      return value;
    },

    has(workoutId) {
      return storage.getString(PREFIX + workoutId) !== undefined;
    },

    set(workoutId, route) {
      storage.set(PREFIX + workoutId, JSON.stringify(route));
      notify();
    },

    remove(workoutId) {
      storage.remove(PREFIX + workoutId);
      cache.delete(workoutId);
      notify();
    },

    importRoutes(routes) {
      let added = 0;
      for (const [workoutId, route] of Object.entries(routes)) {
        if (storage.getString(PREFIX + workoutId) !== undefined) continue;
        storage.set(PREFIX + workoutId, JSON.stringify(route));
        added++;
      }
      if (added > 0) notify();
      return added;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
