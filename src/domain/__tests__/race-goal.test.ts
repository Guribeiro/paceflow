import { bestRecentEffort, parseDateInput, parseRaceGoal, predictTimeForIndex, raceGoalSummary } from '../race-goal';
import { fitnessIndex } from '../pace/training-paces';
import type { Workout } from '../workout';

const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);
const now = local(2026, 10, 29, 12);

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

describe('predictTimeForIndex', () => {
  // Tabela de Daniels para o índice 50: 10 km 41:21, meia 1:31:35, maratona 3:10:49.
  it.each([
    [10, 41 * 60 + 21],
    [21.0975, 3600 + 31 * 60 + 35],
    [42.195, 3 * 3600 + 10 * 60 + 49],
  ])('índice 50 → %p km ≈ %p s', (km, expected) => {
    expect(Math.abs(predictTimeForIndex(fitnessIndex(5, 19 * 60 + 57), km) - expected)).toBeLessThanOrEqual(3);
  });

  it('é o inverso de fitnessIndex', () => {
    expect(predictTimeForIndex(fitnessIndex(10, 3000), 10)).toBeCloseTo(3000, 0);
  });
});

describe('bestRecentEffort', () => {
  it('escolhe o treino de maior índice nas últimas 8 semanas', () => {
    const easy = workout(local(2026, 10, 27), 10_000, 3600); // 6:00/km
    const race = workout(local(2026, 10, 12), 5000, 1260); // 21:00 em 5 km
    const old = workout(local(2026, 8, 1), 5000, 1100); // forte, mas fora da janela
    const tooShort = workout(local(2026, 10, 20), 400, 70); // tiro: não serve
    const removed = workout(local(2026, 10, 25), 5000, 1000, { deletedAt: now.toISOString() });
    const best = bestRecentEffort([easy, race, old, tooShort, removed], now);
    expect(best?.workout.id).toBe(race.id);
    expect(best?.index).toBeCloseTo(fitnessIndex(5, 1260), 9);
  });

  it('null sem treinos que sirvam', () => {
    expect(bestRecentEffort([workout(local(2026, 10, 20), 400, 70)], now)).toBeNull();
  });
});

describe('parseRaceGoal', () => {
  it('aceita meta válida com ou sem tempo-alvo', () => {
    expect(parseRaceGoal({ distanceKm: 21.0975, date: '2026-11-23', targetSeconds: 6300 })).toEqual({
      distanceKm: 21.0975,
      date: '2026-11-23',
      targetSeconds: 6300,
    });
    expect(parseRaceGoal({ distanceKm: 10, date: '2026-12-01' })).toEqual({ distanceKm: 10, date: '2026-12-01' });
  });

  it.each([null, {}, { distanceKm: 0, date: '2026-11-23' }, { distanceKm: 10, date: '23/11' }, { distanceKm: 10, date: '2026-11-23', targetSeconds: -1 }])(
    'rejeita %p',
    (value) => {
      expect(parseRaceGoal(value)).toBeNull();
    },
  );
});

describe('raceGoalSummary', () => {
  const effort = workout(local(2026, 10, 12), 5000, 1197); // índice 50

  it('contagem regressiva, pace-alvo, projeção e diferença', () => {
    const summary = raceGoalSummary({ distanceKm: 10, date: '2026-11-22', targetSeconds: 2400 }, [effort], now);
    expect(summary.daysLeft).toBe(24);
    expect(summary.weeksLeft).toBe(3);
    expect(summary.past).toBe(false);
    expect(summary.targetSecondsPerKm).toBe(240);
    expect(summary.projectedSeconds).toBeCloseTo(2482, -1);
    expect(summary.effort).toEqual({ date: effort.date, distanceMeters: 5000, durationSeconds: 1197 });
    expect(summary.deltaSeconds).toBeCloseTo(82, -1); // projeção 82 s mais lenta que a meta
    expect(summary.goalPaces?.threshold.fastest).toBeLessThan(summary.projectedPaces!.threshold.fastest);
  });

  it('sem tempo-alvo mostra só a projeção', () => {
    const summary = raceGoalSummary({ distanceKm: 10, date: '2026-11-22' }, [effort], now);
    expect(summary.targetSecondsPerKm).toBeNull();
    expect(summary.deltaSeconds).toBeNull();
    expect(summary.goalPaces).toBeNull();
    expect(summary.projectedPaces).not.toBeNull();
  });

  it('sem esforço recente não há projeção', () => {
    const summary = raceGoalSummary({ distanceKm: 10, date: '2026-11-22', targetSeconds: 2400 }, [], now);
    expect(summary.projectedSeconds).toBeNull();
    expect(summary.deltaSeconds).toBeNull();
    expect(summary.goalPaces).not.toBeNull();
  });

  it('prova no dia e prova passada', () => {
    expect(raceGoalSummary({ distanceKm: 10, date: '2026-10-29' }, [], now)).toMatchObject({ daysLeft: 0, past: false });
    expect(raceGoalSummary({ distanceKm: 10, date: '2026-10-28' }, [], now)).toMatchObject({ past: true });
  });
});

describe('parseDateInput', () => {
  it.each([
    ['23/11/2026', '2026-11-23'],
    ['1/2/2027', '2027-02-01'],
    [' 05/12/2026 ', '2026-12-05'],
  ])('"%s" → %s', (input, expected) => {
    expect(parseDateInput(input)).toBe(expected);
  });

  it.each(['', '31/02/2026', '23/13/2026', '2026-11-23', '23/11'])('rejeita "%s"', (input) => {
    expect(parseDateInput(input)).toBeNull();
  });
});
