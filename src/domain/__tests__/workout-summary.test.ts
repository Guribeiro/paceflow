import type { Workout } from '../workout';
import { startOfWeek, summarizeWeek } from '../workout-summary';

// Datas criadas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

let seq = 0;
function workout(date: Date, overrides: Partial<Workout> = {}): Workout {
  return {
    id: `w${++seq}`,
    date: date.toISOString(),
    distanceMeters: 5000,
    durationSeconds: 1500,
    terrain: 'rua',
    createdAt: date.toISOString(),
    updatedAt: date.toISOString(),
    deletedAt: null,
    ...overrides,
  };
}

describe('startOfWeek', () => {
  it('começa na segunda-feira às 00:00', () => {
    // 29/10/2026 é quinta-feira
    expect(startOfWeek(local(2026, 10, 29, 15, 30))).toEqual(local(2026, 10, 26));
  });

  it('segunda-feira é o próprio início', () => {
    expect(startOfWeek(local(2026, 10, 26, 6))).toEqual(local(2026, 10, 26));
  });

  it('domingo pertence à semana que começou na segunda anterior', () => {
    expect(startOfWeek(local(2026, 11, 1, 23, 59))).toEqual(local(2026, 10, 26));
  });

  it('atravessa a virada de mês e de ano', () => {
    // 01/01/2027 é sexta-feira
    expect(startOfWeek(local(2027, 1, 1))).toEqual(local(2026, 12, 28));
  });
});

describe('summarizeWeek', () => {
  const now = local(2026, 10, 29, 12);

  it('soma distância, tempo e quantidade de treinos da semana atual', () => {
    const summary = summarizeWeek(
      [
        workout(local(2026, 10, 26, 6), { distanceMeters: 5000, durationSeconds: 1500 }),
        workout(local(2026, 10, 28, 19), { distanceMeters: 10000, durationSeconds: 3000 }),
      ],
      now,
    );
    expect(summary).toEqual({ count: 2, distanceMeters: 15000, durationSeconds: 4500 });
  });

  it('ignora treinos de semanas anteriores', () => {
    const summary = summarizeWeek([workout(local(2026, 10, 25, 23, 59)), workout(local(2026, 10, 27))], now);
    expect(summary.count).toBe(1);
  });

  it('ignora treinos removidos', () => {
    const summary = summarizeWeek([workout(local(2026, 10, 27), { deletedAt: now.toISOString() })], now);
    expect(summary).toEqual({ count: 0, distanceMeters: 0, durationSeconds: 0 });
  });

  it('semana vazia retorna zeros', () => {
    expect(summarizeWeek([], now)).toEqual({ count: 0, distanceMeters: 0, durationSeconds: 0 });
  });
});
