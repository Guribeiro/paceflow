import type { KeyValueStorage } from '../storage/key-value';

export interface LastSync {
  at: string;
  error?: string;
}

/** Estado local do sync: fila de ids a enviar, cursor do pull e última execução. */
export interface SyncState {
  getDirty(): string[];
  markDirty(ids: readonly string[]): void;
  clearDirty(ids: readonly string[]): void;
  /** server_updated_at do último registro recebido. */
  getCursor(): string | null;
  setCursor(cursor: string): void;
  /** true depois da primeira sincronização completa da conta. */
  isBootstrapped(): boolean;
  setBootstrapped(): void;
  getLastSync(): LastSync | null;
  setLastSync(last: LastSync): void;
  /** Ao sair da conta: a próxima sincronização recomeça do zero. */
  reset(): void;
  subscribe(listener: () => void): () => void;
}

function readJson(storage: KeyValueStorage, key: string): unknown {
  try {
    return JSON.parse(storage.getString(key) ?? 'null');
  } catch {
    return null;
  }
}

/**
 * `prefix` separa o estado de cada coleção. Os treinos usam o padrão
 * 'sync:v1:' (as chaves originais, sem migração); os tênis, 'sync:v1:shoes:'.
 */
export function createSyncState(storage: KeyValueStorage, prefix = 'sync:v1:'): SyncState {
  const DIRTY_KEY = `${prefix}dirty`;
  const CURSOR_KEY = `${prefix}cursor`;
  const BOOTSTRAPPED_KEY = `${prefix}bootstrapped`;
  const LAST_KEY = `${prefix}last`;
  const listeners = new Set<() => void>();
  // Cache para o useSyncExternalStore receber a mesma referência até mudar.
  let cachedLast: LastSync | null | undefined;
  const notify = () => listeners.forEach((listener) => listener());

  function getDirty(): string[] {
    const value = readJson(storage, DIRTY_KEY);
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  }

  return {
    getDirty,

    markDirty(ids) {
      if (ids.length === 0) return;
      storage.set(DIRTY_KEY, JSON.stringify([...new Set([...getDirty(), ...ids])]));
    },

    clearDirty(ids) {
      const remove = new Set(ids);
      storage.set(DIRTY_KEY, JSON.stringify(getDirty().filter((id) => !remove.has(id))));
    },

    getCursor() {
      return storage.getString(CURSOR_KEY) ?? null;
    },

    setCursor(cursor) {
      storage.set(CURSOR_KEY, cursor);
    },

    isBootstrapped() {
      return storage.getString(BOOTSTRAPPED_KEY) === 'true';
    },

    setBootstrapped() {
      storage.set(BOOTSTRAPPED_KEY, 'true');
    },

    getLastSync() {
      if (cachedLast === undefined) {
        const value = readJson(storage, LAST_KEY) as Partial<LastSync> | null;
        cachedLast =
          value && typeof value.at === 'string'
            ? { at: value.at, ...(typeof value.error === 'string' && { error: value.error }) }
            : null;
      }
      return cachedLast;
    },

    setLastSync(last) {
      storage.set(LAST_KEY, JSON.stringify(last));
      cachedLast = undefined;
      notify();
    },

    reset() {
      for (const key of [DIRTY_KEY, CURSOR_KEY, BOOTSTRAPPED_KEY, LAST_KEY]) storage.remove(key);
      cachedLast = undefined;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
