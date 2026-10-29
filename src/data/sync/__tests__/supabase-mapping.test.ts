import type { Workout } from '../../../domain/workout';
import type { Database } from '../database.types';
import { fromRow, normalizeTimestamp, toRow } from '../supabase-mapping';

type Row = Database['public']['Tables']['workouts']['Row'];

const row: Row = {
  user_id: '11111111-1111-1111-1111-111111111111',
  id: 'abc-1',
  date: '2026-10-29T07:00:00+00:00',
  distance_meters: 5000,
  duration_seconds: 1500,
  terrain: 'pista',
  rpe: 7,
  note: 'Tiros',
  created_at: '2026-10-29T07:30:00.123+00:00',
  updated_at: '2026-10-29T08:00:00.123456+00:00',
  deleted_at: null,
  server_updated_at: '2026-10-29T12:00:00.987654+00:00',
};

describe('normalizeTimestamp', () => {
  it.each([
    ['2026-10-29T08:00:00.123456+00:00', '2026-10-29T08:00:00.123Z'],
    ['2026-10-29T08:00:00+00:00', '2026-10-29T08:00:00.000Z'],
    ['2026-10-29T05:00:00.5-03:00', '2026-10-29T08:00:00.500Z'],
    ['2026-10-29T08:00:00.000Z', '2026-10-29T08:00:00.000Z'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTimestamp(input)).toBe(expected);
  });
});

describe('fromRow', () => {
  it('converte para o formato do app com datas ISO em ms', () => {
    expect(fromRow(row)).toEqual({
      id: 'abc-1',
      date: '2026-10-29T07:00:00.000Z',
      distanceMeters: 5000,
      durationSeconds: 1500,
      terrain: 'pista',
      rpe: 7,
      note: 'Tiros',
      createdAt: '2026-10-29T07:30:00.123Z',
      updatedAt: '2026-10-29T08:00:00.123Z',
      deletedAt: null,
      serverUpdatedAt: '2026-10-29T12:00:00.987Z',
    });
  });

  it('omite rpe e nota nulos e converte deleted_at', () => {
    const w = fromRow({ ...row, rpe: null, note: null, deleted_at: '2026-10-30T00:00:00+00:00' });
    expect(w).not.toHaveProperty('rpe');
    expect(w).not.toHaveProperty('note');
    expect(w.deletedAt).toBe('2026-10-30T00:00:00.000Z');
  });
});

describe('toRow', () => {
  it('converte para snake_case sem user_id (o servidor define o dono)', () => {
    const workout: Workout = {
      id: 'abc-1',
      date: '2026-10-29T07:00:00.000Z',
      distanceMeters: 5000,
      durationSeconds: 1500,
      terrain: 'rua',
      createdAt: '2026-10-29T07:30:00.000Z',
      updatedAt: '2026-10-29T08:00:00.000Z',
      deletedAt: null,
    };
    expect(toRow(workout)).toEqual({
      id: 'abc-1',
      date: '2026-10-29T07:00:00.000Z',
      distance_meters: 5000,
      duration_seconds: 1500,
      terrain: 'rua',
      rpe: null,
      note: null,
      created_at: '2026-10-29T07:30:00.000Z',
      updated_at: '2026-10-29T08:00:00.000Z',
      deleted_at: null,
    });
  });
});
