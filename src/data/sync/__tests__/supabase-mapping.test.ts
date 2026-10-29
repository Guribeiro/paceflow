import type { Workout } from '../../../domain/workout';
import type { Database } from '../database.types';
import { parsePreferencesRecord } from '../../../domain/preferences';
import {
  fromPreferencesRow,
  fromShoeRow,
  fromWorkoutRow,
  normalizeTimestamp,
  toPreferencesRow,
  toShoeRow,
  toWorkoutRow,
} from '../supabase-mapping';

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
  shoe_id: null,
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

describe('fromWorkoutRow', () => {
  it('converte para o formato do app com datas ISO em ms', () => {
    expect(fromWorkoutRow(row)).toEqual({
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
    const w = fromWorkoutRow({ ...row, rpe: null, note: null, deleted_at: '2026-10-30T00:00:00+00:00' });
    expect(w).not.toHaveProperty('rpe');
    expect(w).not.toHaveProperty('note');
    expect(w.deletedAt).toBe('2026-10-30T00:00:00.000Z');
  });
});

describe('toWorkoutRow', () => {
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
    expect(toWorkoutRow(workout)).toEqual({
      id: 'abc-1',
      date: '2026-10-29T07:00:00.000Z',
      distance_meters: 5000,
      duration_seconds: 1500,
      terrain: 'rua',
      rpe: null,
      note: null,
      shoe_id: null,
      created_at: '2026-10-29T07:30:00.000Z',
      updated_at: '2026-10-29T08:00:00.000Z',
      deleted_at: null,
    });
  });
});

describe('shoe_id e tênis', () => {
  it('shoe_id vira shoeId e volta', () => {
    expect(fromWorkoutRow({ ...row, shoe_id: 'shoe-1' }).shoeId).toBe('shoe-1');
    expect(fromWorkoutRow(row)).not.toHaveProperty('shoeId');
  });

  it('tênis converte nos dois sentidos com datas normalizadas', () => {
    const shoeRow = {
      user_id: row.user_id,
      id: 'shoe-1',
      name: 'Pegasus',
      initial_meters: 120000,
      limit_meters: 700000,
      retired_at: null,
      created_at: '2026-10-01T10:00:00+00:00',
      updated_at: '2026-10-02T10:00:00.123456+00:00',
      deleted_at: null,
      server_updated_at: '2026-10-29T12:00:00+00:00',
    };
    const shoe = fromShoeRow(shoeRow);
    expect(shoe).toEqual({
      id: 'shoe-1',
      name: 'Pegasus',
      initialMeters: 120000,
      limitMeters: 700000,
      retiredAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-02T10:00:00.123Z',
      deletedAt: null,
      serverUpdatedAt: '2026-10-29T12:00:00.000Z',
    });
    const { serverUpdatedAt: _s, ...local } = shoe;
    expect(toShoeRow(local)).toMatchObject({ id: 'shoe-1', initial_meters: 120000, limit_meters: 700000, retired_at: null });
  });
});

describe('preferências', () => {
  const prefsRow = {
    user_id: row.user_id,
    id: 'preferences',
    unit: 'mi',
    weekly_goal_meters: 32186.88,
    race_goal: { distanceKm: 21.0975, date: '2026-11-23', targetSeconds: 6300 },
    created_at: '2026-10-01T10:00:00+00:00',
    updated_at: '2026-10-29T10:00:00.5+00:00',
    deleted_at: null,
    server_updated_at: '2026-10-29T12:00:00+00:00',
  };

  it('converte a linha e o resultado passa na validação do domínio', () => {
    const { serverUpdatedAt, ...record } = fromPreferencesRow(prefsRow);
    expect(serverUpdatedAt).toBe('2026-10-29T12:00:00.000Z');
    expect(parsePreferencesRecord(record)).toEqual({
      id: 'preferences',
      unit: 'mi',
      weeklyGoalMeters: 32186.88,
      raceGoal: { distanceKm: 21.0975, date: '2026-11-23', targetSeconds: 6300 },
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-29T10:00:00.500Z',
      deletedAt: null,
    });
    expect(toPreferencesRow(parsePreferencesRecord(record)!)).toMatchObject({
      id: 'preferences',
      unit: 'mi',
      weekly_goal_meters: 32186.88,
      race_goal: prefsRow.race_goal,
    });
  });

  it('prova-alvo malformada no servidor é rejeitada pela validação', () => {
    const { serverUpdatedAt: _s, ...record } = fromPreferencesRow({ ...prefsRow, race_goal: { distanceKm: -1 } });
    expect(parsePreferencesRecord(record)).toBeNull();
  });
});

