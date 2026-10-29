import type { RaceGoal } from '../race-goal';
import { buildTrainingPlan, planProgress } from '../training-plan';
import type { Workout } from '../workout';

const local = (y: number, m: number, d: number, h = 0) => new Date(y, m - 1, d, h);
const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const now = local(2026, 10, 29, 12); // quinta; semana atual começa em 26/10
const weeksAhead = (n: number) => key(local(2026, 10, 29 + n * 7));

let seq = 0;
const workout = (date: Date, distanceMeters: number, durationSeconds = (distanceMeters / 1000) * 330): Workout => ({
  id: `w${++seq}`,
  date: date.toISOString(),
  distanceMeters,
  durationSeconds,
  terrain: 'rua',
  createdAt: date.toISOString(),
  updatedAt: date.toISOString(),
  deletedAt: null,
});

/** 4 semanas anteriores com ~30 km cada. */
const history = [0, 1, 2, 3].flatMap((w) => [
  workout(local(2026, 10, 20 - w * 7, 7), 10_000),
  workout(local(2026, 10, 22 - w * 7, 7), 8_000),
  workout(local(2026, 10, 25 - w * 7, 7), 12_000),
]);

const half = (weeks: number, target?: number): RaceGoal => ({
  distanceKm: 21.0975,
  date: weeksAhead(weeks),
  ...(target && { targetSeconds: target }),
});

describe('buildTrainingPlan', () => {
  it('vai da semana atual até a semana da prova, com polimento de 2 semanas na meia', () => {
    const plan = buildTrainingPlan(half(10, 6300), history, now)!;
    expect(plan.weeks).toHaveLength(11);
    expect(plan.weeks[0].weekStart).toBe(local(2026, 10, 26).toISOString());
    expect(plan.weeks.map((w) => w.phase)).toEqual([
      'base', 'base', 'base', 'build', 'build', 'build', 'build', 'peak', 'peak', 'taper', 'race',
    ]);
    expect(plan.shortNotice).toBe(false);
  });

  it('parte da média recente, progride ~8% e alivia a cada 4ª semana', () => {
    const weeks = buildTrainingPlan(half(10, 6300), history, now)!.weeks;
    expect(weeks[0].targetMeters).toBeCloseTo(30_000, -3);
    expect(weeks[1].targetMeters).toBeCloseTo(32_400, -3);
    expect(weeks[3].isCutback).toBe(true);
    expect(weeks[3].targetMeters).toBeLessThan(weeks[2].targetMeters);
    const peak = Math.max(...weeks.map((w) => w.targetMeters));
    expect(peak).toBeLessThanOrEqual(45_000); // início × 1,5
  });

  it.each([4, 6, 10, 20])('nenhuma semana sobe mais de 10% sobre a última semana normal (prova em %p semanas)', (weeks) => {
    for (const goal of [{ distanceKm: 5, date: weeksAhead(weeks) }, half(weeks)]) {
      // Compara com a última semana normal: voltar de um alívio ao nível
      // anterior é esperado, e a semana da prova inclui a própria prova.
      const plan = buildTrainingPlan(goal, history, now)!.weeks.filter((w) => !w.isRaceWeek);
      let reference = plan[0].targetMeters;
      for (const week of plan.slice(1)) {
        expect(week.targetMeters).toBeLessThanOrEqual(reference * 1.1 + 500);
        if (!week.isCutback) reference = week.targetMeters;
      }
    }
  });

  it('polimento reduz o volume e a semana da prova inclui a prova', () => {
    const weeks = buildTrainingPlan(half(10, 6300), history, now)!.weeks;
    const peak = weeks[8].targetMeters;
    expect(weeks[9].targetMeters).toBeCloseTo(peak * 0.7, -2);
    expect(weeks[10].isRaceWeek).toBe(true);
    expect(weeks[10].sessions[0]).toMatchObject({ kind: 'race', title: 'Prova: Meia Maratona' });
  });

  it('sem histórico usa o piso da distância', () => {
    const weeks = buildTrainingPlan({ distanceKm: 42.195, date: weeksAhead(20) }, [], now)!.weeks;
    expect(weeks[0].targetMeters).toBe(30_000);
    expect(Math.max(...weeks.map((w) => w.targetMeters))).toBeLessThanOrEqual(90_000);
    // Polimento da maratona: 3 semanas contando a da prova.
    expect(weeks.slice(-3).map((w) => w.phase)).toEqual(['taper', 'taper', 'race']);
  });

  it('longão entre 25% e 30% do volume e dentro do teto da distância', () => {
    const weeks = buildTrainingPlan({ distanceKm: 10, date: weeksAhead(12) }, history, now)!.weeks;
    for (const w of weeks.filter((x) => !x.isRaceWeek)) {
      expect(w.longRunMeters).toBeLessThanOrEqual(16_000);
      expect(w.longRunMeters).toBeLessThanOrEqual(w.targetMeters * 0.3 + 1);
    }
  });

  it('qualidade: limiar sempre; intervalado no 10 km e ritmo de prova na meia a partir da construção', () => {
    const tenK = buildTrainingPlan({ distanceKm: 10, date: weeksAhead(12), targetSeconds: 2700 }, history, now)!.weeks;
    expect(tenK[0].sessions.map((s) => s.kind)).toEqual(['long', 'threshold']);
    expect(tenK.find((w) => w.phase === 'build')!.sessions.map((s) => s.kind)).toEqual(['long', 'threshold', 'interval']);

    const halfPlan = buildTrainingPlan(half(10, 6300), history, now)!.weeks;
    expect(halfPlan.find((w) => w.phase === 'build')!.sessions.map((s) => s.kind)).toEqual(['long', 'threshold', 'racePace']);
  });

  it('paces vêm da meta; sem meta nem histórico, só as descrições', () => {
    const withGoal = buildTrainingPlan(half(10, 6300), history, now)!.weeks[0];
    const threshold = withGoal.sessions.find((s) => s.kind === 'threshold')!;
    expect(threshold.pace).toBeDefined();
    expect(threshold.pace!.fastest).toBeCloseTo(4 * 60 + 50, -1); // limiar para meia em 1:45:00

    const noPaces = buildTrainingPlan({ distanceKm: 10, date: weeksAhead(8) }, [], now)!.weeks[0];
    expect(noPaces.sessions.every((s) => s.pace === undefined)).toBe(true);
  });

  it('prova muito próxima vira só polimento, com aviso', () => {
    const plan = buildTrainingPlan(half(1, 6300), history, now)!;
    expect(plan.shortNotice).toBe(true);
    expect(plan.weeks.map((w) => w.phase)).toEqual(['taper', 'race']);
  });

  it('prova passada não tem plano', () => {
    expect(buildTrainingPlan({ distanceKm: 10, date: '2026-10-20' }, history, now)).toBeNull();
  });
});

describe('planProgress', () => {
  it('soma os km da semana e marca o longão feito', () => {
    const week = buildTrainingPlan(half(10, 6300), history, now)!.weeks[0];
    const thisWeek = [workout(local(2026, 10, 27, 7), 6_000), workout(local(2026, 10, 28, 7), week.longRunMeters * 0.9)];
    expect(planProgress(week, [...history, ...thisWeek])).toEqual({
      doneMeters: 6_000 + week.longRunMeters * 0.9,
      longRunDone: true,
    });
    expect(planProgress(week, [workout(local(2026, 10, 27, 7), 6_000)]).longRunDone).toBe(false);
  });
});
