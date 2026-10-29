import type { Terrain, Workout } from '../../domain/workout';
import type { Database } from './database.types';
import type { RemoteWorkout } from './sync-engine';

type Tables = Database['public']['Tables']['workouts'];
export type WorkoutRow = Tables['Row'];
export type WorkoutInsert = Tables['Insert'];

/**
 * O Postgres devolve microssegundos e offset ("…00.123456+00:00"); o app grava
 * ISO em ms ("…00.123Z"). Corta a fração em 3 dígitos antes de parsear, porque
 * o Date.parse do Hermes não aceita mais casas.
 */
export function normalizeTimestamp(value: string): string {
  return new Date(value.replace(/(\.\d{3})\d+/, '$1')).toISOString();
}

export function fromRow(row: WorkoutRow): RemoteWorkout {
  return {
    id: row.id,
    date: normalizeTimestamp(row.date),
    distanceMeters: row.distance_meters,
    durationSeconds: row.duration_seconds,
    // Validado de novo por parseWorkoutRecord no motor de sync.
    terrain: row.terrain as Terrain,
    ...(row.rpe !== null && { rpe: row.rpe }),
    ...(row.note !== null && { note: row.note }),
    createdAt: normalizeTimestamp(row.created_at),
    updatedAt: normalizeTimestamp(row.updated_at),
    deletedAt: row.deleted_at === null ? null : normalizeTimestamp(row.deleted_at),
    serverUpdatedAt: normalizeTimestamp(row.server_updated_at),
  };
}

/** Sem user_id: o trigger do banco define o dono como auth.uid(). */
export function toRow(workout: Workout): WorkoutInsert {
  return {
    id: workout.id,
    date: workout.date,
    distance_meters: workout.distanceMeters,
    duration_seconds: workout.durationSeconds,
    terrain: workout.terrain,
    rpe: workout.rpe ?? null,
    note: workout.note ?? null,
    created_at: workout.createdAt,
    updated_at: workout.updatedAt,
    deleted_at: workout.deletedAt,
  };
}
