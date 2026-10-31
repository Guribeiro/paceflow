import type { IntervalPlan } from '../interval-plan';
import { completedWork, seriesNote } from '../interval-results';
import type { IntervalProgress, PhaseResult } from '../run-tracker';

const DISTANCE_PLAN: IntervalPlan = {
  warmup: { kind: 'time', seconds: 600 },
  reps: 4,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'time', seconds: 60 },
  cooldown: null,
  targetSecondsPerKm: null,
};
const TIME_PLAN: IntervalPlan = { ...DISTANCE_PLAN, work: { kind: 'time', seconds: 120 } };

const work = (rep: number, seconds: number, meters: number, skipped = false): PhaseResult => ({
  kind: 'work',
  rep,
  ms: seconds * 1000,
  meters,
  skipped,
});
const recovery = (rep: number): PhaseResult => ({ kind: 'recovery', rep, ms: 60_000, meters: 150, skipped: false });
const warmup: PhaseResult = { kind: 'warmup', ms: 600_000, meters: 1800, skipped: false };

const progress = (plan: IntervalPlan, results: PhaseResult[]): IntervalProgress => ({
  plan,
  index: results.length,
  phaseStart: { movingMs: 0, distanceMeters: 0 },
  at: { movingMs: 0, distanceMeters: 0 },
  results,
  paceChecked: false,
  midPace: null,
});

describe('completedWork', () => {
  it('fica só com os tiros não pulados', () => {
    const results = [warmup, work(1, 92, 400), recovery(1), work(2, 40, 180, true), recovery(2), work(3, 94, 400)];
    expect(completedWork(results)).toEqual([work(1, 92, 400), work(3, 94, 400)]);
  });
});

describe('seriesNote', () => {
  it('tiros por distância: a mesma nota do modo Tiros, sem aquecimento, recuperações e tiros pulados', () => {
    const results = [
      warmup,
      work(1, 92, 400),
      recovery(1),
      work(2, 90, 400),
      recovery(2),
      work(3, 30, 120, true),
      recovery(3),
      work(4, 94, 400),
    ];
    expect(seriesNote(progress(DISTANCE_PLAN, results), 'km')).toBe('3×400 m · média 1:32 (3:50/km) · variação 4 s');
  });

  it('tiros por distância em milhas', () => {
    // 1:32 nos 400 m = 230 s/km = 6:10/mi.
    expect(seriesNote(progress(DISTANCE_PLAN, [work(1, 92, 400)]), 'mi')).toBe('1×400 m · média 1:32 (6:10/mi) · variação 0 s');
  });

  it('tiros por tempo: quantidade, duração, distância média e pace', () => {
    // 1040 m em 240 s = 230,8 s/km.
    const results = [work(1, 120, 530), recovery(1), work(2, 120, 510)];
    expect(seriesNote(progress(TIME_PLAN, results), 'km')).toBe('2 × 2 min · média 520 m (3:51/km)');
    // 230,8 × 1,609344 = 371,4 s/mi.
    expect(seriesNote(progress(TIME_PLAN, results), 'mi')).toBe('2 × 2 min · média 520 m (6:11/mi)');
  });

  it('tiros por tempo sem distância: sem pace', () => {
    expect(seriesNote(progress(TIME_PLAN, [work(1, 120, 0)]), 'km')).toBe('1 × 2 min · média 0 m');
  });

  it('null sem tiro concluído', () => {
    expect(seriesNote(progress(DISTANCE_PLAN, []), 'km')).toBeNull();
    expect(seriesNote(progress(DISTANCE_PLAN, [warmup, work(1, 40, 180, true)]), 'km')).toBeNull();
  });
});
