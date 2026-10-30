import { randomUUID } from 'expo-crypto';

import { type Result, err, isPositiveFinite, ok } from '../../domain/pace/result';
import {
  NOTE_MAX_LENGTH,
  type Workout,
  isIsoDate,
  isSafeId,
  isTerrain,
  isValidRpe,
  isValidSplits,
  parseWorkoutRecord,
} from '../../domain/workout';
import type { KeyValueStorage } from '../storage/key-value';

import { type ImportOptions, type ImportSummary, createRecordStore } from './record-store';

export type { ImportOptions, ImportSummary } from './record-store';

export type NewWorkout = Pick<
  Workout,
  'date' | 'distanceMeters' | 'durationSeconds' | 'terrain' | 'rpe' | 'note' | 'shoeId' | 'splits' | 'splitMeters'
>;

/** Campos omitidos ficam como estão; `null` limpa RPE, nota ou tênis. As parciais vêm do GPS e não se editam. */
export type WorkoutPatch = Partial<Omit<NewWorkout, 'rpe' | 'note' | 'shoeId' | 'splits' | 'splitMeters'>> & {
  rpe?: number | null;
  note?: string | null;
  shoeId?: string | null;
};

export type WorkoutError =
  | 'NOT_FOUND'
  | 'INVALID_DATE'
  | 'INVALID_DISTANCE'
  | 'INVALID_DURATION'
  | 'INVALID_TERRAIN'
  | 'INVALID_RPE'
  | 'INVALID_NOTE'
  | 'INVALID_SHOE'
  | 'INVALID_SPLITS';

export interface WorkoutRepository {
  /** Treinos ativos, do mais recente para o mais antigo. Referência estável até a próxima escrita. */
  list(): Workout[];
  /** Inclui treinos removidos (soft delete). */
  listAll(): Workout[];
  getById(id: string): Workout | undefined;
  /** O registro como está gravado, inclusive se removido (o sync precisa propagar exclusões). */
  getRecord(id: string): Workout | undefined;
  create(input: NewWorkout): Result<Workout, WorkoutError>;
  update(id: string, patch: WorkoutPatch): Result<Workout, WorkoutError>;
  remove(id: string): boolean;
  /**
   * Mescla treinos de um backup: adiciona os novos e, para o mesmo id, fica a
   * versão com updatedAt mais recente (inclusive contra remoções locais).
   */
  importWorkouts(workouts: readonly Workout[], options?: ImportOptions): ImportSummary;
  /** Mesmo que importWorkouts; nome comum usado pelo motor de sync. */
  importRecords(workouts: readonly Workout[], options?: ImportOptions): ImportSummary;
  subscribe(listener: () => void): () => void;
}

export interface RepositoryDeps {
  generateId?: () => string;
  now?: () => string;
  /** Chamado com os ids alterados localmente (o sync os marca como pendentes). */
  onLocalChange?: (ids: string[]) => void;
}

function validate(input: NewWorkout): WorkoutError | null {
  if (!isIsoDate(input.date)) return 'INVALID_DATE';
  if (!isPositiveFinite(input.distanceMeters)) return 'INVALID_DISTANCE';
  if (!isPositiveFinite(input.durationSeconds)) return 'INVALID_DURATION';
  if (!isTerrain(input.terrain)) return 'INVALID_TERRAIN';
  if (input.rpe !== undefined && !isValidRpe(input.rpe)) return 'INVALID_RPE';
  if (input.note !== undefined && input.note.trim().length > NOTE_MAX_LENGTH) return 'INVALID_NOTE';
  if (input.shoeId !== undefined && !isSafeId(input.shoeId)) return 'INVALID_SHOE';
  if (!isValidSplits(input.splits, input.splitMeters)) return 'INVALID_SPLITS';
  return null;
}

function toRecord(
  input: NewWorkout,
  meta: Pick<Workout, 'id' | 'createdAt' | 'updatedAt'>,
): Workout {
  const note = input.note?.trim();
  return {
    id: meta.id,
    date: input.date,
    distanceMeters: input.distanceMeters,
    durationSeconds: input.durationSeconds,
    terrain: input.terrain,
    ...(input.rpe !== undefined && { rpe: input.rpe }),
    ...(note && { note }),
    ...(input.shoeId !== undefined && { shoeId: input.shoeId }),
    ...(input.splits !== undefined && { splits: [...input.splits], splitMeters: input.splitMeters }),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    deletedAt: null,
  };
}

export function createWorkoutRepository(
  storage: KeyValueStorage,
  { generateId = randomUUID, now = () => new Date().toISOString(), onLocalChange }: RepositoryDeps = {},
): WorkoutRepository {
  const store = createRecordStore<Workout>(storage, {
    prefix: 'workouts:v1:',
    parse: parseWorkoutRecord,
    sort: (a, b) => Date.parse(b.date) - Date.parse(a.date),
    onLocalChange,
  });

  return {
    list: store.list,
    listAll: store.listAll,
    getById: store.getActive,
    getRecord: store.getRecord,
    subscribe: store.subscribe,

    create(input) {
      const error = validate(input);
      if (error) return err(error);

      const timestamp = now();
      const workout = toRecord(input, { id: generateId(), createdAt: timestamp, updatedAt: timestamp });
      store.write(workout);
      return ok(workout);
    },

    update(id, patch) {
      const current = store.getActive(id);
      if (!current) return err('NOT_FOUND');

      const merged: NewWorkout = {
        date: patch.date ?? current.date,
        distanceMeters: patch.distanceMeters ?? current.distanceMeters,
        durationSeconds: patch.durationSeconds ?? current.durationSeconds,
        terrain: patch.terrain ?? current.terrain,
        rpe: patch.rpe === null ? undefined : (patch.rpe ?? current.rpe),
        note: patch.note === null ? undefined : (patch.note ?? current.note),
        shoeId: patch.shoeId === null ? undefined : (patch.shoeId ?? current.shoeId),
        splits: current.splits,
        splitMeters: current.splitMeters,
      };
      const error = validate(merged);
      if (error) return err(error);

      const workout = toRecord(merged, { id, createdAt: current.createdAt, updatedAt: now() });
      store.write(workout);
      return ok(workout);
    },

    remove(id) {
      const workout = store.getActive(id);
      if (!workout) return false;
      const timestamp = now();
      store.write({ ...workout, deletedAt: timestamp, updatedAt: timestamp });
      return true;
    },

    importWorkouts: store.importRecords,
    importRecords: store.importRecords,
  };
}
