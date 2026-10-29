import { randomUUID } from 'expo-crypto';

import { type Result, err, isPositiveFinite, ok } from '../../domain/pace/result';
import {
  NOTE_MAX_LENGTH,
  type Workout,
  isIsoDate,
  isTerrain,
  isValidRpe,
  parseWorkoutRecord,
} from '../../domain/workout';
import type { KeyValueStorage } from '../storage/key-value';

// Cada treino fica numa chave própria e um índice guarda os ids, para que salvar
// um treino não reserialize o histórico inteiro. O "v1" no prefixo é a versão do
// schema: uma migração futura lê v1 e grava v2.
const PREFIX = 'workouts:v1:';
const INDEX_KEY = `${PREFIX}index`;
const recordKey = (id: string) => `${PREFIX}${id}`;

export type NewWorkout = Pick<Workout, 'date' | 'distanceMeters' | 'durationSeconds' | 'terrain' | 'rpe' | 'note'>;

/** Campos omitidos ficam como estão; `null` limpa RPE ou nota. */
export type WorkoutPatch = Partial<Omit<NewWorkout, 'rpe' | 'note'>> & {
  rpe?: number | null;
  note?: string | null;
};

export type WorkoutError =
  | 'NOT_FOUND'
  | 'INVALID_DATE'
  | 'INVALID_DISTANCE'
  | 'INVALID_DURATION'
  | 'INVALID_TERRAIN'
  | 'INVALID_RPE'
  | 'INVALID_NOTE';

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
  subscribe(listener: () => void): () => void;
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
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    deletedAt: null,
  };
}

function parseWorkout(raw: string | undefined): Workout | null {
  if (raw === undefined) return null;
  try {
    return parseWorkoutRecord(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function createWorkoutRepository(
  storage: KeyValueStorage,
  { generateId = randomUUID, now = () => new Date().toISOString(), onLocalChange }: RepositoryDeps = {},
): WorkoutRepository {
  const listeners = new Set<() => void>();
  let cachedAll: Workout[] | null = null;
  let cachedActive: Workout[] | null = null;

  function readIndex(): string[] {
    try {
      const parsed: unknown = JSON.parse(storage.getString(INDEX_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  }

  function listAll(): Workout[] {
    if (!cachedAll) {
      cachedAll = readIndex()
        .map((id) => parseWorkout(storage.getString(recordKey(id))))
        .filter((w): w is Workout => w !== null)
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }
    return cachedAll;
  }

  function list(): Workout[] {
    if (!cachedActive) cachedActive = listAll().filter((w) => w.deletedAt === null);
    return cachedActive;
  }

  function changed(localIds: string[] = []) {
    cachedAll = null;
    cachedActive = null;
    if (localIds.length > 0) onLocalChange?.(localIds);
    listeners.forEach((listener) => listener());
  }

  return {
    list,
    listAll,

    getById(id) {
      const workout = parseWorkout(storage.getString(recordKey(id)));
      return workout && workout.deletedAt === null ? workout : undefined;
    },

    getRecord(id) {
      return parseWorkout(storage.getString(recordKey(id))) ?? undefined;
    },

    create(input) {
      const error = validate(input);
      if (error) return err(error);

      const timestamp = now();
      const workout = toRecord(input, { id: generateId(), createdAt: timestamp, updatedAt: timestamp });

      storage.set(recordKey(workout.id), JSON.stringify(workout));
      storage.set(INDEX_KEY, JSON.stringify([...readIndex(), workout.id]));
      changed([workout.id]);
      return ok(workout);
    },

    update(id, patch) {
      const current = parseWorkout(storage.getString(recordKey(id)));
      if (!current || current.deletedAt !== null) return err('NOT_FOUND');

      const merged: NewWorkout = {
        date: patch.date ?? current.date,
        distanceMeters: patch.distanceMeters ?? current.distanceMeters,
        durationSeconds: patch.durationSeconds ?? current.durationSeconds,
        terrain: patch.terrain ?? current.terrain,
        rpe: patch.rpe === null ? undefined : (patch.rpe ?? current.rpe),
        note: patch.note === null ? undefined : (patch.note ?? current.note),
      };
      const error = validate(merged);
      if (error) return err(error);

      const workout = toRecord(merged, { id, createdAt: current.createdAt, updatedAt: now() });
      storage.set(recordKey(id), JSON.stringify(workout));
      changed([id]);
      return ok(workout);
    },

    remove(id) {
      const workout = parseWorkout(storage.getString(recordKey(id)));
      if (!workout || workout.deletedAt !== null) return false;
      const timestamp = now();
      storage.set(recordKey(id), JSON.stringify({ ...workout, deletedAt: timestamp, updatedAt: timestamp }));
      changed([id]);
      return true;
    },

    importWorkouts(workouts, { origin = 'file' } = {}) {
      const summary: ImportSummary = { added: 0, updated: 0, unchanged: 0 };
      const changedIds: string[] = [];
      const index = readIndex();
      const known = new Set(index);

      for (const incoming of workouts) {
        const current = parseWorkout(storage.getString(recordKey(incoming.id)));
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
        storage.set(INDEX_KEY, JSON.stringify(index));
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
