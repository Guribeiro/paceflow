import type { KeyValueStorage } from '../storage/key-value';

/** O mínimo que um registro sincronizável precisa ter. */
export interface StoredRecord {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ImportSummary {
  added: number;
  updated: number;
  unchanged: number;
}

export interface ImportOptions {
  /** 'remote' = veio do servidor: não conta como alteração local a enviar. */
  origin?: 'file' | 'remote';
}

export interface RecordStore<T extends StoredRecord> {
  /** Ativos, na ordem de `sort`. Referência estável até a próxima escrita. */
  list(): T[];
  /** Inclui removidos (soft delete). */
  listAll(): T[];
  /** O registro como está gravado, inclusive se removido. */
  getRecord(id: string): T | undefined;
  getActive(id: string): T | undefined;
  /** Grava um registro novo ou alterado localmente. */
  write(record: T): void;
  /** Mescla: adiciona os novos e, para o mesmo id, fica o updatedAt mais recente. */
  importRecords(records: readonly T[], options?: ImportOptions): ImportSummary;
  subscribe(listener: () => void): () => void;
}

interface Options<T> {
  /** Ex.: 'workouts:v1:'. O "v1" é a versão do schema. */
  prefix: string;
  parse: (value: unknown) => T | null;
  sort: (a: T, b: T) => number;
  /** Chamado com os ids alterados localmente (o sync os marca como pendentes). */
  onLocalChange?: (ids: string[]) => void;
}

/**
 * Cada registro numa chave própria e um índice com os ids, para que salvar um
 * não reserialize todos. Leituras toleram dados corrompidos (descartados).
 */
export function createRecordStore<T extends StoredRecord>(
  storage: KeyValueStorage,
  { prefix, parse, sort, onLocalChange }: Options<T>,
): RecordStore<T> {
  const indexKey = `${prefix}index`;
  const recordKey = (id: string) => `${prefix}${id}`;
  const listeners = new Set<() => void>();
  let cachedAll: T[] | null = null;
  let cachedActive: T[] | null = null;

  function read(id: string): T | null {
    const raw = storage.getString(recordKey(id));
    if (raw === undefined) return null;
    try {
      return parse(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  function readIndex(): string[] {
    try {
      const parsed: unknown = JSON.parse(storage.getString(indexKey) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  function listAll(): T[] {
    if (!cachedAll) {
      cachedAll = readIndex()
        .map(read)
        .filter((r): r is T => r !== null)
        .sort(sort);
    }
    return cachedAll;
  }

  function changed(localIds: string[]) {
    cachedAll = null;
    cachedActive = null;
    if (localIds.length > 0) onLocalChange?.(localIds);
    listeners.forEach((listener) => listener());
  }

  return {
    listAll,

    list() {
      if (!cachedActive) cachedActive = listAll().filter((r) => r.deletedAt === null);
      return cachedActive;
    },

    getRecord(id) {
      return read(id) ?? undefined;
    },

    getActive(id) {
      const record = read(id);
      return record && record.deletedAt === null ? record : undefined;
    },

    write(record) {
      const isNew = storage.getString(recordKey(record.id)) === undefined;
      storage.set(recordKey(record.id), JSON.stringify(record));
      if (isNew && !readIndex().includes(record.id)) {
        storage.set(indexKey, JSON.stringify([...readIndex(), record.id]));
      }
      changed([record.id]);
    },

    importRecords(records, { origin = 'file' } = {}) {
      const summary: ImportSummary = { added: 0, updated: 0, unchanged: 0 };
      const changedIds: string[] = [];
      const index = readIndex();
      const known = new Set(index);

      for (const incoming of records) {
        const current = read(incoming.id);
        if (current && Date.parse(current.updatedAt) >= Date.parse(incoming.updatedAt)) {
          summary.unchanged++;
          continue;
        }
        storage.set(recordKey(incoming.id), JSON.stringify(incoming));
        if (!known.has(incoming.id)) {
          index.push(incoming.id);
          known.add(incoming.id);
        }
        changedIds.push(incoming.id);
        if (current) summary.updated++;
        else summary.added++;
      }

      if (changedIds.length > 0) {
        storage.set(indexKey, JSON.stringify(index));
        changed(origin === 'remote' ? [] : changedIds);
      }
      return summary;
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
