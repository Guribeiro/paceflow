import { parsePreferencesRecord } from '../preferences';

const valid = {
  id: 'preferences',
  unit: 'km',
  weeklyGoalMeters: 20000,
  raceGoal: { distanceKm: 21.0975, date: '2026-11-23', targetSeconds: 6300 },
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-02T00:00:00.000Z',
  deletedAt: null,
};

describe('parsePreferencesRecord', () => {
  it('aceita um registro válido, com ou sem meta e prova', () => {
    expect(parsePreferencesRecord(valid)).toEqual(valid);
    expect(parsePreferencesRecord({ ...valid, weeklyGoalMeters: null, raceGoal: null })).not.toBeNull();
  });

  it.each([
    { ...valid, id: 'outro' },
    { ...valid, unit: 'léguas' },
    { ...valid, weeklyGoalMeters: -1 },
    { ...valid, raceGoal: { distanceKm: 0, date: '2026-11-23' } },
    { ...valid, updatedAt: 'ontem' },
  ])('rejeita %p', (value) => {
    expect(parsePreferencesRecord(value)).toBeNull();
  });
});
