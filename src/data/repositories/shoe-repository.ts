import { randomUUID } from 'expo-crypto';

import { type Result, err, ok } from '../../domain/pace/result';
import { DEFAULT_SHOE_LIMIT_METERS, type Shoe, isValidShoeName, parseShoeRecord } from '../../domain/shoe';
import type { KeyValueStorage } from '../storage/key-value';
import { type ImportOptions, type ImportSummary, createRecordStore } from './record-store';

export interface NewShoe {
  name: string;
  initialMeters?: number;
  limitMeters?: number;
}

export interface ShoePatch {
  name?: string;
  initialMeters?: number;
  limitMeters?: number;
  retired?: boolean;
}

export type ShoeError = 'NOT_FOUND' | 'INVALID_NAME' | 'INVALID_INITIAL' | 'INVALID_LIMIT';

export interface ShoeRepository {
  /** Não excluídos (inclui aposentados), do mais antigo ao mais novo. */
  list(): Shoe[];
  listAll(): Shoe[];
  getRecord(id: string): Shoe | undefined;
  create(input: NewShoe): Result<Shoe, ShoeError>;
  update(id: string, patch: ShoePatch): Result<Shoe, ShoeError>;
  remove(id: string): boolean;
  importShoes(shoes: readonly Shoe[], options?: ImportOptions): ImportSummary;
  /** Mesmo que importShoes; nome comum usado pelo motor de sync. */
  importRecords(shoes: readonly Shoe[], options?: ImportOptions): ImportSummary;
  subscribe(listener: () => void): () => void;
}

interface Deps {
  generateId?: () => string;
  now?: () => string;
  onLocalChange?: (ids: string[]) => void;
}

function validate(s: Pick<Shoe, 'name' | 'initialMeters' | 'limitMeters'>): ShoeError | null {
  if (!isValidShoeName(s.name)) return 'INVALID_NAME';
  if (!Number.isFinite(s.initialMeters) || s.initialMeters < 0) return 'INVALID_INITIAL';
  if (!Number.isFinite(s.limitMeters) || s.limitMeters <= 0) return 'INVALID_LIMIT';
  return null;
}

export function createShoeRepository(
  storage: KeyValueStorage,
  { generateId = randomUUID, now = () => new Date().toISOString(), onLocalChange }: Deps = {},
): ShoeRepository {
  const store = createRecordStore<Shoe>(storage, {
    prefix: 'shoes:v1:',
    parse: parseShoeRecord,
    sort: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    onLocalChange,
  });

  return {
    list: store.list,
    listAll: store.listAll,
    getRecord: store.getRecord,
    subscribe: store.subscribe,
    importShoes: store.importRecords,
    importRecords: store.importRecords,

    create(input) {
      const fields = {
        name: input.name.trim(),
        initialMeters: input.initialMeters ?? 0,
        limitMeters: input.limitMeters ?? DEFAULT_SHOE_LIMIT_METERS,
      };
      const error = validate(fields);
      if (error) return err(error);
      const timestamp = now();
      const shoe: Shoe = {
        id: generateId(),
        ...fields,
        retiredAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      };
      store.write(shoe);
      return ok(shoe);
    },

    update(id, patch) {
      const current = store.getActive(id);
      if (!current) return err('NOT_FOUND');
      const timestamp = now();
      const next: Shoe = {
        ...current,
        name: patch.name?.trim() ?? current.name,
        initialMeters: patch.initialMeters ?? current.initialMeters,
        limitMeters: patch.limitMeters ?? current.limitMeters,
        retiredAt: patch.retired === undefined ? current.retiredAt : patch.retired ? timestamp : null,
        updatedAt: timestamp,
      };
      const error = validate(next);
      if (error) return err(error);
      store.write(next);
      return ok(next);
    },

    remove(id) {
      const current = store.getActive(id);
      if (!current) return false;
      const timestamp = now();
      store.write({ ...current, deletedAt: timestamp, updatedAt: timestamp });
      return true;
    },
  };
}
