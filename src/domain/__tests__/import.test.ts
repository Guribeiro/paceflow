import { workoutsToJson } from '../export';
import { parseWorkoutsBackup } from '../import';
import type { Workout } from '../workout';

const workout = (overrides: Partial<Workout> = {}): Workout => ({
  id: '3b241101-e2bb-4255-8caf-4136c566a962',
  date: '2026-10-29T10:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1500,
  terrain: 'rua',
  rpe: 6,
  note: 'Leve',
  createdAt: '2026-10-29T10:30:00.000Z',
  updatedAt: '2026-10-29T10:30:00.000Z',
  deletedAt: null,
  ...overrides,
});

const backup = (workouts: unknown[], extra: Record<string, unknown> = {}) =>
  JSON.stringify({ app: 'PaceFlow', schemaVersion: 1, exportedAt: '2026-10-29T12:00:00.000Z', workouts, ...extra });

describe('parseWorkoutsBackup', () => {
  it('lê de volta o que a exportação gera', () => {
    const original = [workout(), workout({ id: 'a1', date: '2026-10-30T10:00:00.000Z', rpe: undefined, note: undefined })];
    const result = parseWorkoutsBackup(workoutsToJson(original, new Date()));
    expect(result).toEqual({ ok: true, value: { workouts: original, shoes: [], invalid: 0 } });
  });

  it('ignora e conta registros inválidos', () => {
    const result = parseWorkoutsBackup(
      backup([
        workout(),
        { ...workout({ id: 'b2' }), distanceMeters: -1 },
        { ...workout({ id: 'c3' }), terrain: 'trilha' },
        'lixo',
      ]),
    );
    expect(result).toEqual({ ok: true, value: { workouts: [workout()], shoes: [], invalid: 3 } });
  });

  it('rejeita ids que não são seguros para usar como chave', () => {
    const result = parseWorkoutsBackup(backup([workout({ id: 'a\\b' }), workout({ id: '' }), workout({ id: 'x'.repeat(65) })]));
    expect(result).toEqual({ ok: true, value: { workouts: [], shoes: [], invalid: 3 } });
  });

  it('ignora deletedAt vindo do arquivo: importar nunca remove', () => {
    const result = parseWorkoutsBackup(backup([{ ...workout(), deletedAt: '2026-10-29T11:00:00.000Z' }]));
    expect(result.ok && result.value.workouts[0].deletedAt).toBeNull();
  });

  it.each(['', 'não é json', '[1,2]', 'null'])('INVALID_JSON ou formato inválido para %p', (input) => {
    const result = parseWorkoutsBackup(input);
    expect(result.ok).toBe(false);
  });

  it('INVALID_JSON para texto que não é JSON', () => {
    expect(parseWorkoutsBackup('{quebrado')).toEqual({ ok: false, error: 'INVALID_JSON' });
  });

  it.each([
    ['app diferente', backup([], { app: 'Strava' })],
    ['sem app', JSON.stringify({ schemaVersion: 1, workouts: [] })],
    ['versão futura', backup([], { schemaVersion: 3 })],
    ['workouts não é lista', backup([], { workouts: {} })],
  ])('UNSUPPORTED_FORMAT: %s', (_label, input) => {
    expect(parseWorkoutsBackup(input)).toEqual({ ok: false, error: 'UNSUPPORTED_FORMAT' });
  });
});

describe('parseWorkoutsBackup com tênis (versão 2)', () => {
  const shoe = {
    id: 'shoe-1',
    name: 'Pegasus 41',
    initialMeters: 50_000,
    limitMeters: 700_000,
    retiredAt: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  };

  it('lê tênis e shoeId; tênis inválidos contam como inválidos', () => {
    const result = parseWorkoutsBackup(
      backup([workout({ shoeId: 'shoe-1' })], { schemaVersion: 2, shoes: [shoe, { ...shoe, id: 'bad', name: '' }] }),
    );
    expect(result).toEqual({
      ok: true,
      value: { workouts: [workout({ shoeId: 'shoe-1' })], shoes: [{ ...shoe, deletedAt: null }], invalid: 1 },
    });
  });

  it('backup versão 1 continua aceito, sem tênis', () => {
    const result = parseWorkoutsBackup(backup([workout()]));
    expect(result.ok && result.value.shoes).toEqual([]);
  });
});

