import { SPLITS_MAX, type Workout, isValidSplits, parseWorkoutRecord, splitUnit } from '../workout';

const MILE = 1609.344;

const record = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'w-1',
  date: '2026-10-29T10:00:00.000Z',
  distanceMeters: 5000,
  durationSeconds: 1500,
  terrain: 'rua',
  createdAt: '2026-10-29T10:30:00.000Z',
  updatedAt: '2026-10-29T10:30:00.000Z',
  deletedAt: null,
  ...overrides,
});

describe('isValidSplits', () => {
  it('aceita a ausência das duas', () => {
    expect(isValidSplits(undefined, undefined)).toBe(true);
  });

  it.each([
    ['uma parcial em km', [310], 1000],
    ['várias parciais com décimos', [310, 305.4, 299.6], 1000],
    ['parciais em milha', [402, 398], MILE],
    [`exatamente ${SPLITS_MAX} parciais`, Array<number>(SPLITS_MAX).fill(300), 1000],
  ])('aceita %s', (_label, splits, splitMeters) => {
    expect(isValidSplits(splits, splitMeters)).toBe(true);
  });

  it.each([
    ['só as parciais, sem o tamanho', [310], undefined],
    ['só o tamanho, sem as parciais', undefined, 1000],
    ['lista vazia', [], 1000],
    [`mais de ${SPLITS_MAX} parciais`, Array<number>(SPLITS_MAX + 1).fill(300), 1000],
    ['parcial zero', [310, 0], 1000],
    ['parcial negativa', [310, -5], 1000],
    ['parcial NaN', [NaN], 1000],
    ['parcial infinita', [Infinity], 1000],
    ['parcial em texto', ['5:10'], 1000],
    ['parcial nula', [310, null], 1000],
    ['tamanho zero', [310], 0],
    ['tamanho negativo', [310], -1000],
    ['tamanho NaN', [310], NaN],
    ['tamanho em texto', [310], '1000'],
    ['parciais que não são lista', { 0: 310 }, 1000],
    ['parciais nulas com tamanho nulo', null, null],
  ])('rejeita %s', (_label, splits, splitMeters) => {
    expect(isValidSplits(splits, splitMeters)).toBe(false);
  });
});

describe('splitUnit', () => {
  it('1000 m é km e uma milha é mi', () => {
    expect(splitUnit(1000)).toBe('km');
    expect(splitUnit(MILE)).toBe('mi');
  });
});

describe('parseWorkoutRecord com parciais', () => {
  it('aceita o treino sem parciais', () => {
    expect(parseWorkoutRecord(record())).toEqual(record());
  });

  it('aceita o treino com parciais válidas', () => {
    const value = record({ splits: [310, 305.4], splitMeters: 1000 });
    expect(parseWorkoutRecord(value)).toEqual<Workout>(value as unknown as Workout);
  });

  it.each([
    ['só as parciais', { splits: [310] }],
    ['só o tamanho', { splitMeters: 1000 }],
    ['lista vazia', { splits: [], splitMeters: 1000 }],
    ['parcial zero', { splits: [0], splitMeters: 1000 }],
    ['parcial negativa', { splits: [-1], splitMeters: 1000 }],
    ['parcial NaN', { splits: [NaN], splitMeters: 1000 }],
    [`mais de ${SPLITS_MAX} parciais`, { splits: Array<number>(SPLITS_MAX + 1).fill(300), splitMeters: 1000 }],
  ])('rejeita %s', (_label, overrides) => {
    expect(parseWorkoutRecord(record(overrides))).toBeNull();
  });
});
