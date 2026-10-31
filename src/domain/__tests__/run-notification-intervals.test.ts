import type { IntervalPlan } from '../interval-plan';
import { runNotificationProps } from '../run-notification';
import { type RunSample, applySamples, skipPhase, startRun } from '../run-tracker';

const T0 = Date.UTC(2026, 10, 4, 9);
const METER = 1 / 111_195;

const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});
const straight = (toS: number, speed: number) => Array.from({ length: toS + 1 }, (_, i) => north(i * speed, i));

const plan = (change: Partial<IntervalPlan> = {}): IntervalPlan => ({
  warmup: null,
  reps: 8,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'time', seconds: 60 },
  cooldown: null,
  targetSecondsPerKm: null,
  ...change,
});
const begin = (p: IntervalPlan) => startRun(T0, 1000, false, false, p);

describe('runNotificationProps no intervalado', () => {
  it('tiro por distância: número do tiro, metros que faltam e a fração da fase', () => {
    // 166,5 m em 50 s a 3,33 m/s: faltam 233,5 m dos 400.
    const state = applySamples(begin(plan()), straight(50, 3.33));
    expect(runNotificationProps(state, T0 + 50_000)).toMatchObject({
      lastSplit: 'Tiro 1/8 · faltam 234 m',
      splitProgress: expect.closeTo(166.5 / 400, 3),
    });
  });

  it('fase por tempo: nome da fase e o tempo restante pelo relógio', () => {
    const state = begin(plan({ warmup: { kind: 'time', seconds: 60 } }));
    expect(runNotificationProps(state, T0 + 18_000)).toMatchObject({
      lastSplit: 'Aquecimento · 0:42',
      splitProgress: expect.closeTo(0.3, 6),
    });
  });

  it('recuperação depois de um tiro', () => {
    const state = skipPhase(begin(plan()), T0 + 10_000);
    expect(runNotificationProps(state, T0 + 28_000)).toMatchObject({
      lastSplit: 'Recuperação · 0:42',
      splitProgress: expect.closeTo(0.3, 6),
    });
  });

  it('desaquecimento', () => {
    const state = skipPhase(begin(plan({ reps: 1, cooldown: { kind: 'time', seconds: 300 } })), T0);
    expect(runNotificationProps(state, T0 + 60_000).lastSplit).toBe('Desaquecimento · 4:00');
  });

  it('depois da última fase: "Treino concluído" com a barra cheia', () => {
    const state = skipPhase(begin(plan({ reps: 1, recovery: null })), T0 + 5000);
    expect(runNotificationProps(state, T0 + 6000)).toMatchObject({ lastSplit: 'Treino concluído', splitProgress: 1 });
  });

  it('não mostra a parcial fechada no lugar da fase', () => {
    // 1,2 km a 4 m/s: fechou o km 1, mas o tiro de 2000 m ainda está em andamento.
    const state = applySamples(begin(plan({ work: { kind: 'distance', meters: 2000 } })), straight(300, 4));
    expect(state.splits).toHaveLength(1);
    expect(runNotificationProps(state, T0 + 300_000).lastSplit).toMatch(/^Tiro 1\/8 · faltam \d+ m$/);
  });
});
