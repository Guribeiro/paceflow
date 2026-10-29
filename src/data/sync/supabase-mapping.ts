import type { Shoe } from '../../domain/shoe';
import type { Terrain, Workout } from '../../domain/workout';
import type { Database } from './database.types';
import type { Remote } from './sync-engine';

type Tables = Database['public']['Tables'];
export type WorkoutRow = Tables['workouts']['Row'];
export type WorkoutInsert = Tables['workouts']['Insert'];
export type ShoeRow = Tables['shoes']['Row'];
export type ShoeInsert = Tables['shoes']['Insert'];

/**
 * O Postgres devolve microssegundos e offset ("…00.123456+00:00"); o app grava
 * ISO em ms ("…00.123Z"). Corta a fração em 3 dígitos antes de parsear, porque
 * o Date.parse do Hermes não aceita mais casas.
 */
export function normalizeTimestamp(value: string): string {
  return new Date(value.replace(/(\.\d{3})\d+/, '$1')).toISOString();
}

const normalizeNullable = (value: string | null) => (value === null ? null : normalizeTimestamp(value));

export function fromWorkoutRow(row: WorkoutRow): Remote<Workout> {
  return {
    id: row.id,
    date: normalizeTimestamp(row.date),
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    // Validado de novo por parseWorkoutRecord no motor de sync.
    terrain: row.terrain as Terrain,
    ...(row.rpe !== null && { rpe: row.rpe }),
    ...(row.note !== null && { note: row.note }),
    ...(row.shoe_id !== null && { shoeId: row.shoe_id }),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    deletedAt: normalizeNullable(row.deleted_at),
    serverUpdatedAt: normalizeTimestamp(row.server_updated_at),
  };
}

/** Sem user_id: o trigger do banco define o dono como auth.uid(). */
export function toWorkoutRow(workout: Workout): WorkoutInsert {
  return {
    id: workout.id,
    date: workout.date,
    distance_meters: workout.distanceMeters,
    duration_seconds: workout.durationSeconds,
    terrain: workout.terrain,
    rpe: workout.rpe ?? null,
    note: workout.note ?? null,
    shoe_id: workout.shoeId ?? null,
    created_at: workout.createdAt,
    updated_at: workout.updatedAt,
    deleted_at: workout.deletedAt,
  };
}

export function fromShoeRow(row: ShoeRow): Remote<Shoe> {
  return {
    id: row.id,
    name: row.name,
    initialMeters: row.initial_meters,
    limitMeters: row.limit_meters,
    retiredAt: normalizeNullable(row.retired_at),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    deletedAt: normalizeNullable(row.deleted_at),
    serverUpdatedAt: normalizeTimestamp(row.server_updated_at),
  };
}

export function toShoeRow(shoe: Shoe): ShoeInsert {
  return {
    id: shoe.id,
    name: shoe.name,
    initial_meters: shoe.initialMeters,
    limit_meters: shoe.limitMeters,
    retired_at: shoe.retiredAt,
    created_at: shoe.createdAt,
    updated_at: shoe.updatedAt,
    deleted_at: shoe.deletedAt,
  };
}
