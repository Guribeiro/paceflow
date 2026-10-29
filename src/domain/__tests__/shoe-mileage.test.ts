import type { Shoe } from '../shoe';
import { shoeMileage, shoeStatus, suggestedShoeId } from '../shoe-mileage';
import type { Workout } from '../workout';

const shoe = (id: string, overrides: Partial<Shoe> = {}): Shoe => ({
  id,
  name: id,
  initialMeters: 0,
  limitMeters: 700_000,
  retiredAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  deletedAt: null,
  ...overrides,
});

let seq = 0;
const workout = (date: string, overrides: Partial<Workout> = {}): Workout => ({
  id: `w${++seq}`,
  date,
  distanceMeters: 10_000,
  durationSeconds: 3000,
  terrain: 'rua',
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  ...overrides,
});

describe('shoeMileage', () => {
  it('soma os km iniciais e os treinos ativos daquele tênis', () => {
    const workouts = [
      workout('2026-10-20T07:00:00.000Z', { shoeId: 'a' }),
      workout('2026-10-21T07:00:00.000Z', { shoeId: 'a', distanceMeters: 5000 }),
      workout('2026-10-22T07:00:00.000Z', { shoeId: 'b' }),
      workout('2026-10-23T07:00:00.000Z', { shoeId: 'a', deletedAt: '2026-10-24T00:00:00.000Z' }),
      workout('2026-10-24T07:00:00.000Z'),
    ];
    expect(shoeMileage(shoe('a', { initialMeters: 300_000 }), workouts)).toBe(315_000);
  });
});

describe('shoeStatus', () => {
  it.each([
    [500_000, 'ok'],
    [629_999, 'ok'],
    [630_000, 'attention'],
    [699_999, 'attention'],
    [700_000, 'replace'],
    [800_000, 'replace'],
  ] as const)('%p m de 700 km → %s', (meters, expected) => {
    expect(shoeStatus(meters, 700_000)).toBe(expected);
  });
});

describe('suggestedShoeId', () => {
  it('usa o tênis do treino mais recente, se ainda estiver ativo', () => {
    const shoes = [shoe('a'), shoe('b')];
    const workouts = [
      workout('2026-10-20T07:00:00.000Z', { shoeId: 'a' }),
      workout('2026-10-25T07:00:00.000Z', { shoeId: 'b' }),
      workout('2026-10-26T07:00:00.000Z'), // sem tênis: ignorado
    ];
    expect(suggestedShoeId(workouts, shoes)).toBe('b');
  });

  it('ignora tênis aposentados ou excluídos', () => {
    const shoes = [shoe('a'), shoe('b', { retiredAt: '2026-10-26T00:00:00.000Z' })];
    const workouts = [
      workout('2026-10-20T07:00:00.000Z', { shoeId: 'a' }),
      workout('2026-10-25T07:00:00.000Z', { shoeId: 'b' }),
    ];
    expect(suggestedShoeId(workouts, shoes)).toBe('a');
  });

  it('sem histórico, sugere o único tênis ativo; com vários, nenhum', () => {
    expect(suggestedShoeId([], [shoe('a')])).toBe('a');
    expect(suggestedShoeId([], [shoe('a'), shoe('b')])).toBeUndefined();
  });
});
