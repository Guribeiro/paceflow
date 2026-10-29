import type { Workout } from '../workout';
import { averagePace, comparePace, summarizeTrends, weeklyTotals } from '../workout-trends';

// Datas no fuso local para os testes não dependerem do TZ da máquina.
const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);

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

const now = local(2026, 10, 29, 12); // quinta; semana atual começa em 26/10

describe('weeklyTotals', () => {
  it('devolve N semanas, da mais antiga à atual, incluindo semanas vazias', () => {
    const weeks = weeklyTotals([], now, 3);
    expect(weeks.map((w) => w.weekStart)).toEqual([
      local(2026, 10, 12).toISOString(),
      local(2026, 10, 19).toISOString(),
      local(2026, 10, 26).toISOString(),
    ]);
    expect(weeks.every((w) => w.count === 0 && w.distanceMeters === 0)).toBe(true);
  });

  it('soma cada treino na sua semana e ignora removidos e fora da janela', () => {
    const weeks = weeklyTotals(
      [
        workout(local(2026, 10, 26, 7), { distanceMeters: 10000, durationSeconds: 3000 }),
        workout(local(2026, 11, 1, 22), { distanceMeters: 5000, durationSeconds: 1500 }), // domingo: semana atual
        workout(local(2026, 10, 25, 23), { distanceMeters: 8000, durationSeconds: 2400 }), // semana anterior
        workout(local(2026, 10, 20), { deletedAt: now.toISOString() }),
        workout(local(2026, 9, 1)), // fora das 3 semanas
      ],
      now,
      3,
    );
    expect(weeks.map((w) => [w.count, w.distanceMeters, w.durationSeconds])).toEqual([
      [0, 0, 0],
      [1, 8000, 2400],
      [2, 15000, 4500],
    ]);
  });

  it('atravessa a virada de ano', () => {
    const weeks = weeklyTotals([workout(local(2026, 12, 31))], local(2027, 1, 6), 2);
    expect(weeks[0]).toMatchObject({ weekStart: local(2026, 12, 28).toISOString(), count: 1 });
  });
});

describe('averagePace', () => {
  it('é ponderado pela distância (tempo total / distância total)', () => {
    expect(averagePace({ distanceMeters: 15000, durationSeconds: 4500 })).toBeCloseTo(300, 9);
  });

  it('é null sem distância', () => {
    expect(averagePace({ distanceMeters: 0, durationSeconds: 0 })).toBeNull();
  });
});

describe('summarizeTrends', () => {
  it('média só das semanas com treino, melhor semana e comparação de pace', () => {
    // 8 semanas: 07/09 a 26/10. Anteriores = 07/09..28/09; recentes = 05/10..26/10.
    const weeks = weeklyTotals(
      [
        workout(local(2026, 9, 29), { distanceMeters: 10000, durationSeconds: 3300 }), // 5:30, semana 28/09
        workout(local(2026, 10, 1), { distanceMeters: 10000, durationSeconds: 3300 }), // 5:30, semana 28/09
        workout(local(2026, 10, 13), { distanceMeters: 10000, durationSeconds: 3000 }), // 5:00, semana 12/10
        workout(local(2026, 10, 27), { distanceMeters: 20000, durationSeconds: 6000 }), // 5:00, semana 26/10
      ],
      now,
      8,
    );
    const trends = summarizeTrends(weeks);
    expect(trends.activeWeeks).toBe(3);
    expect(trends.averageWeeklyMeters).toBeCloseTo(50000 / 3, 6);
    // Empate em 20 km (28/09 e 26/10): vale a mais recente.
    expect(trends.bestWeek?.weekStart).toBe(local(2026, 10, 26).toISOString());
    expect(trends.paceChange).toEqual({ recent: 300, previous: 330, deltaSeconds: -30 });
  });

  it('sem treinos não há média, melhor semana nem comparação', () => {
    expect(summarizeTrends(weeklyTotals([], now, 8))).toEqual({
      activeWeeks: 0,
      averageWeeklyMeters: null,
      bestWeek: null,
      paceChange: null,
    });
  });
});

describe('comparePace', () => {
  it('descreve a diferença em segundos por unidade', () => {
    expect(comparePace(-8)).toBe('8 s mais rápido');
    expect(comparePace(12.4)).toBe('12 s mais lento');
    expect(comparePace(0.3)).toBe('mesmo ritmo');
  });
});
