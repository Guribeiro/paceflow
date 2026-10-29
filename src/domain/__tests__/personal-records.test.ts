import { newRecords, personalRecords } from '../personal-records';
import type { Workout } from '../workout';

const local = (y: number, m: number, d: number) => new Date(y, m - 1, d, 7);

let seq = 0;
const workout = (date: Date, distanceMeters: number, durationSeconds: number, overrides: Partial<Workout> = {}): Workout => ({
  id: `w${++seq}`,
  date: date.toISOString(),
  distanceMeters,
  durationSeconds,
  terrain: 'rua',
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  deletedAt: null,
  ...overrides,
});

describe('personalRecords', () => {
  it('sem treinos, sem recordes', () => {
    expect(personalRecords([])).toEqual([]);
  });

  it('pega o melhor tempo por distância, em ordem de distância', () => {
    const records = personalRecords([
      workout(local(2026, 10, 1), 10_000, 50 * 60),
      workout(local(2026, 10, 5), 5_000, 26 * 60),
      workout(local(2026, 10, 9), 5_000, 24 * 60 + 30),
    ]);

    expect(records.map((r) => [r.id, r.seconds])).toEqual([
      ['5k', 24 * 60 + 30],
      ['10k', 50 * 60],
    ]);
    expect(records[0]).toMatchObject({ label: '5 km', distanceKm: 5, date: local(2026, 10, 9).toISOString() });
  });

  it('normaliza pelo pace quando o treino passa um pouco da distância', () => {
    // 5,10 km em 25:30 → 5:00/km → 25:00 nos 5 km.
    const [record] = personalRecords([workout(local(2026, 10, 1), 5_100, 25 * 60 + 30)]);
    expect(record.seconds).toBe(25 * 60);
  });

  it('aceita até 3% a mais e nada a menos', () => {
    const records = personalRecords([
      workout(local(2026, 10, 1), 4_990, 20 * 60), // curto demais
      workout(local(2026, 10, 2), 5_200, 22 * 60), // 4% a mais
      workout(local(2026, 10, 3), 5_150, 25 * 60), // 3% a mais: vale
    ]);
    expect(records).toHaveLength(1);
    expect(records[0].seconds).toBeCloseTo((25 * 60 * 5000) / 5150, 6);
  });

  it('reconhece meia e maratona', () => {
    const records = personalRecords([
      workout(local(2026, 9, 1), 21_100, 6300),
      workout(local(2026, 9, 20), 42_195, 4 * 3600),
    ]);
    expect(records.map((r) => r.id)).toEqual(['half', 'marathon']);
  });

  it('ignora treinos excluídos', () => {
    const deleted = workout(local(2026, 10, 1), 5_000, 20 * 60, { deletedAt: local(2026, 10, 2).toISOString() });
    expect(personalRecords([deleted, workout(local(2026, 10, 3), 5_000, 25 * 60)])[0].seconds).toBe(25 * 60);
  });

  it('em empate, vale o primeiro a fazer o tempo', () => {
    const first = workout(local(2026, 10, 1), 5_000, 25 * 60);
    const second = workout(local(2026, 10, 8), 5_000, 25 * 60);
    expect(personalRecords([second, first])[0].workoutId).toBe(first.id);
  });
});

describe('newRecords', () => {
  const base = [workout(local(2026, 10, 1), 5_000, 25 * 60)];

  it('aponta a distância em que o recorde melhorou', () => {
    const faster = workout(local(2026, 10, 2), 5_000, 24 * 60);
    const result = newRecords(personalRecords(base), personalRecords([...base, faster]));
    expect(result.map((r) => [r.id, r.seconds])).toEqual([['5k', 24 * 60]]);
  });

  it('a primeira marca numa distância também é recorde', () => {
    const tenK = workout(local(2026, 10, 2), 10_000, 55 * 60);
    expect(newRecords(personalRecords(base), personalRecords([...base, tenK])).map((r) => r.id)).toEqual(['10k']);
  });

  it('um treino mais lento não é recorde', () => {
    const slower = workout(local(2026, 10, 2), 5_000, 26 * 60);
    expect(newRecords(personalRecords(base), personalRecords([...base, slower]))).toEqual([]);
  });
});
