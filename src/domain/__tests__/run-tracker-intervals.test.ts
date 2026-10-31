import { DEFAULT_INTERVAL_PLAN, type IntervalPlan } from '../interval-plan';
import {
  type RunSample,
  applySamples,
  currentPhase,
  elapsedMs,
  finishRun,
  parseRunState,
  pauseRun,
  phaseProgress,
  resumeRun,
  skipPhase,
  startRun,
} from '../run-tracker';

const T0 = Date.UTC(2026, 10, 4, 9);
// ~1 m de latitude em graus.
const METER = 1 / 111_195;

/** Amostra a `meters` ao norte do ponto inicial, `seconds` depois de T0. */
const north = (meters: number, seconds: number, accuracy: number | null = 5): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy,
  timestamp: T0 + seconds * 1000,
});

/** Linha reta a `speed` m/s de `fromS` a `toS`, saindo de `startMeters`; uma amostra a cada `every` s. */
const straight = (fromS: number, toS: number, speed: number, startMeters = 0, every = 1) =>
  Array.from({ length: Math.floor((toS - fromS) / every) + 1 }, (_, i) =>
    north(startMeters + i * every * speed, fromS + i * every),
  );

/** Parado em `at` m, uma amostra por segundo. */
const still = (at: number, fromS: number, toS: number) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => north(at, fromS + i));

const plan = (change: Partial<IntervalPlan> = {}): IntervalPlan => ({
  warmup: null,
  reps: 2,
  work: { kind: 'distance', meters: 400 },
  recovery: null,
  cooldown: null,
  targetSecondsPerKm: null,
  ...change,
});

const begin = (p: IntervalPlan) => startRun(T0, 1000, false, false, p);

describe('startRun com plano', () => {
  it('começa na primeira fase, sem resultados', () => {
    expect(begin(DEFAULT_INTERVAL_PLAN).intervals).toEqual({
      plan: DEFAULT_INTERVAL_PLAN,
      index: 0,
      phaseStart: { movingMs: 0, distanceMeters: 0 },
      at: { movingMs: 0, distanceMeters: 0 },
      results: [],
      paceChecked: false,
      midPace: null,
    });
  });

  it('desliga a pausa automática no intervalado, e só nele', () => {
    expect(startRun(T0, 1000, true, false, DEFAULT_INTERVAL_PLAN).autoPause).toBe(false);
    expect(startRun(T0, 1000, true).autoPause).toBe(true);
  });

  it('corrida livre não tem intervalado', () => {
    expect(startRun(T0).intervals).toBeNull();
  });

  it('parado na recuperação, o tempo da fase continua contando (sem pausa automática)', () => {
    const p = plan({ reps: 2, work: { kind: 'distance', meters: 100 }, recovery: { kind: 'time', seconds: 60 } });
    // 104 m aos 26 s (o tiro fecha aos 100 m, 25 s); depois parado.
    let state = applySamples(startRun(T0, 1000, true, false, p), straight(0, 26, 4));
    state = applySamples(state, still(104, 27, 90));
    expect(state.autoPaused).toBe(false);
    expect(state.intervals?.results.map((r) => r.kind)).toEqual(['work', 'recovery']);
    expect(state.intervals?.results[1]).toEqual({
      kind: 'recovery',
      rep: 1,
      ms: 60_000,
      meters: expect.closeTo(4, 0),
      skipped: false,
    });
  });
});

describe('fases por distância', () => {
  it('fecha o tiro no instante interpolado entre as amostras', () => {
    // 4 m/s, uma amostra a cada 30 s: 360 m aos 90 s e 480 m aos 120 s; os 400 m caem aos 100 s.
    const state = applySamples(begin(plan()), straight(0, 120, 4, 0, 30));
    const intervals = state.intervals!;
    expect(intervals.index).toBe(1);
    expect(intervals.results).toEqual([
      { kind: 'work', rep: 1, ms: expect.closeTo(100_000, -1), meters: 400, skipped: false },
    ]);
    expect(intervals.phaseStart).toEqual({ movingMs: expect.closeTo(100_000, -1), distanceMeters: 400 });
    expect(intervals.at).toEqual({ movingMs: 120_000, distanceMeters: expect.closeTo(480, 0) });
  });

  it('não fecha antes de completar a distância', () => {
    const state = applySamples(begin(plan()), straight(0, 99, 4));
    expect(state.intervals).toMatchObject({ index: 0, results: [] });
  });

  it('o tiro seguinte conta a partir do fim do anterior', () => {
    const state = applySamples(begin(plan()), straight(0, 210, 4, 0, 30));
    // 840 m aos 210 s; o 2º tiro fecha aos 800 m, 200 s.
    expect(state.intervals?.results.map((r) => [r.rep, Math.round(r.ms), Math.round(r.meters)])).toEqual([
      [1, 100_000, 400],
      [2, 100_000, 400],
    ]);
  });
});

describe('fases por tempo', () => {
  it('fecha no tempo em movimento, com a distância interpolada', () => {
    // Aquecimento de 1 min a 4 m/s, uma amostra a cada 25 s: 200 m aos 50 s, 300 m aos 75 s; aos 60 s, 240 m.
    const state = applySamples(begin(plan({ warmup: { kind: 'time', seconds: 60 } })), straight(0, 75, 4, 0, 25));
    expect(state.intervals?.results).toEqual([
      { kind: 'warmup', ms: 60_000, meters: expect.closeTo(240, 0), skipped: false },
    ]);
    expect(state.intervals?.phaseStart).toEqual({ movingMs: 60_000, distanceMeters: expect.closeTo(240, 0) });
    expect(currentPhase(state.intervals!)).toEqual({ kind: 'work', measure: { kind: 'distance', meters: 400 }, rep: 1 });
  });

  it('o resultado da fase não tem número de tiro fora de tiros e recuperações', () => {
    const state = applySamples(begin(plan({ warmup: { kind: 'time', seconds: 60 } })), straight(0, 75, 4, 0, 25));
    expect(state.intervals?.results[0]).not.toHaveProperty('rep');
  });
});

describe('várias fases numa amostra', () => {
  it('fecha todas as fases cumpridas, cada uma no seu instante', () => {
    // 3 × 100 m com 100 m de recuperação; o GPS volta aos 60 s, 450 m adiante (7,5 m/s).
    const p = plan({ reps: 3, work: { kind: 'distance', meters: 100 }, recovery: { kind: 'distance', meters: 100 } });
    const state = applySamples(begin(p), [north(0, 0), north(450, 60)]);
    const intervals = state.intervals!;
    expect(intervals.results.map((r) => `${r.kind}${r.rep}`)).toEqual(['work1', 'recovery1', 'work2', 'recovery2']);
    intervals.results.forEach((r) => {
      expect(r.ms).toBeCloseTo(13_333, -1);
      expect(r.meters).toBeCloseTo(100, 6);
    });
    expect(intervals.index).toBe(4);
    expect(intervals.phaseStart).toEqual({ movingMs: expect.closeTo(53_333, -1), distanceMeters: 400 });
  });
});

describe('pausa manual', () => {
  const timed = plan({ reps: 1, work: { kind: 'time', seconds: 60 } });

  it('congela o tempo da fase e ignora as amostras durante a pausa', () => {
    let state = applySamples(begin(timed), straight(0, 30, 4));
    state = pauseRun(state, T0 + 30_000);
    state = applySamples(state, straight(31, 200, 4, 124));
    expect(state.intervals).toMatchObject({ index: 0, results: [] });
    expect(phaseProgress(state, T0 + 500_000)).toMatchObject({ remaining: 30, fraction: 0.5 });
  });

  it('ao retomar, a fase termina depois do tempo em movimento, sem o trecho da pausa', () => {
    let state = applySamples(begin(timed), straight(0, 30, 4));
    state = resumeRun(pauseRun(state, T0 + 30_000), T0 + 100_000);
    // Retoma 500 m adiante (o trecho da pausa não conta) e corre mais 40 s.
    state = applySamples(state, straight(100, 140, 4, 500));
    expect(state.intervals?.results).toEqual([
      { kind: 'work', rep: 1, ms: 60_000, meters: expect.closeTo(240, 0), skipped: false },
    ]);
  });
});

describe('fim do plano', () => {
  const short = plan({ reps: 1, work: { kind: 'distance', meters: 100 } });

  it('depois da última fase, não há fase atual nem progresso, e novas amostras não criam resultados', () => {
    let state = applySamples(begin(short), straight(0, 30, 4));
    expect(state.intervals?.index).toBe(1);
    expect(currentPhase(state.intervals!)).toBeNull();
    expect(phaseProgress(state, T0 + 30_000)).toBeNull();

    state = applySamples(state, straight(31, 60, 4, 124));
    expect(state.intervals?.results).toHaveLength(1);
    expect(state.distanceMeters).toBeCloseTo(240, 0);
  });

  it('pular fase depois do fim não muda nada', () => {
    const state = applySamples(begin(short), straight(0, 30, 4));
    expect(skipPhase(state, T0 + 31_000)).toBe(state);
  });
});

describe('pace na metade do tiro', () => {
  const targeted = plan({ targetSecondsPerKm: 240 });

  it('mede uma vez, ao passar da metade do tiro, só com pace-alvo', () => {
    // 4 m/s = 250 s/km; metade dos 400 m aos 50 s (a 1ª amostra depois dela, aos 51 s).
    let state = applySamples(begin(targeted), straight(0, 49, 4));
    expect(state.intervals).toMatchObject({ paceChecked: false, midPace: null });

    state = applySamples(state, straight(50, 51, 4, 200));
    expect(state.intervals?.paceChecked).toBe(true);
    expect(state.intervals?.midPace).toBeCloseTo(250, 3);

    // Mais rápido depois: o pace medido não muda.
    state = applySamples(state, straight(52, 60, 8, 212));
    expect(state.intervals?.midPace).toBeCloseTo(250, 3);
  });

  it('sem pace-alvo, não mede', () => {
    const state = applySamples(begin(plan()), straight(0, 60, 4));
    expect(state.intervals).toMatchObject({ paceChecked: false, midPace: null });
  });

  it('zera a medição no tiro seguinte', () => {
    const state = applySamples(begin(targeted), straight(0, 101, 4));
    expect(state.intervals).toMatchObject({ index: 1, paceChecked: false, midPace: null });
  });

  it('em tiros por tempo, espera ao menos 50 m antes de medir', () => {
    // 1 min a 1,6 m/s, passos aceitos a cada 2 s (3,2 m): na metade (30 s) são 48 m e aos 31 s
    // ainda 48 m; a medida sai aos 32 s, com 51,2 m.
    const p = plan({ work: { kind: 'time', seconds: 60 }, targetSecondsPerKm: 240 });
    let state = applySamples(begin(p), straight(0, 31, 1.6));
    expect(state.intervals?.paceChecked).toBe(false);
    state = applySamples(state, straight(32, 32, 1.6, 51.2));
    expect(state.intervals?.paceChecked).toBe(true);
    expect(state.intervals?.midPace).toBeCloseTo(32 / 0.0512, 0);
  });

  it('não mede fora dos tiros', () => {
    const p = plan({ warmup: { kind: 'distance', meters: 400 }, targetSecondsPerKm: 240 });
    const state = applySamples(begin(p), straight(0, 60, 4));
    expect(state.intervals).toMatchObject({ index: 0, paceChecked: false });
  });
});

describe('skipPhase', () => {
  it('encerra a fase atual agora, marcada como pulada', () => {
    const state = applySamples(begin(plan({ targetSecondsPerKm: 240 })), straight(0, 50, 4));
    const skipped = skipPhase(state, T0 + 52_000);
    expect(skipped.intervals).toEqual({
      ...state.intervals,
      index: 1,
      phaseStart: { movingMs: 52_000, distanceMeters: expect.closeTo(200, 0) },
      at: { movingMs: 52_000, distanceMeters: expect.closeTo(200, 0) },
      results: [{ kind: 'work', rep: 1, ms: 52_000, meters: expect.closeTo(200, 0), skipped: true }],
      paceChecked: false,
      midPace: null,
    });
  });

  it('a fase seguinte conta a partir do pulo', () => {
    let state = applySamples(begin(plan()), straight(0, 50, 4));
    state = skipPhase(state, T0 + 50_000);
    // Mais 400 m a 4 m/s a partir dos 200 m: o 2º tiro fecha aos 150 s.
    state = applySamples(state, straight(51, 151, 4, 204));
    expect(state.intervals?.results[1]).toEqual({
      kind: 'work',
      rep: 2,
      ms: expect.closeTo(100_000, -1),
      meters: 400,
      skipped: false,
    });
  });

  it('não faz nada sem plano nem com a corrida finalizada', () => {
    const free = applySamples(startRun(T0), straight(0, 10, 4));
    expect(skipPhase(free, T0 + 10_000)).toBe(free);
    const done = finishRun(applySamples(begin(plan()), straight(0, 10, 4)), T0 + 10_000);
    expect(skipPhase(done, T0 + 20_000)).toBe(done);
  });
});

describe('phaseProgress', () => {
  it('fase por distância: o que falta em metros e a fração', () => {
    const state = applySamples(begin(plan()), straight(0, 75, 4));
    expect(phaseProgress(state, T0 + 75_000)).toEqual({
      phase: { kind: 'work', measure: { kind: 'distance', meters: 400 }, rep: 1 },
      number: 1,
      total: 2,
      remaining: expect.closeTo(100, 0),
      fraction: expect.closeTo(0.75, 3),
    });
  });

  it('fase por tempo: segundos que faltam pelo relógio, sem passar de 0', () => {
    const state = begin(DEFAULT_INTERVAL_PLAN);
    expect(phaseProgress(state, T0 + 150_000)).toEqual({
      phase: { kind: 'warmup', measure: { kind: 'time', seconds: 600 } },
      number: 1,
      // Aquecimento + 8 tiros + 7 recuperações + desaquecimento.
      total: 17,
      remaining: 450,
      fraction: 0.25,
    });
    expect(phaseProgress(state, T0 + 900_000)).toMatchObject({ remaining: 0, fraction: 1 });
  });

  it('null na corrida livre', () => {
    expect(phaseProgress(startRun(T0), T0 + 1000)).toBeNull();
  });

  it('conta o relógio com elapsedMs (pausada, congela)', () => {
    const paused = pauseRun(begin(DEFAULT_INTERVAL_PLAN), T0 + 60_000);
    expect(elapsedMs(paused, T0 + 999_000)).toBe(60_000);
    expect(phaseProgress(paused, T0 + 999_000)?.remaining).toBe(540);
  });
});

describe('parseRunState com intervalado', () => {
  const withPlan = applySamples(begin(plan({ warmup: { kind: 'time', seconds: 60 }, targetSecondsPerKm: 240 })), straight(0, 150, 4));
  const saved = () => JSON.parse(JSON.stringify(withPlan));

  it('aceita o andamento salvo em JSON', () => {
    expect(withPlan.intervals?.results).toHaveLength(1);
    expect(parseRunState(saved())).toEqual(withPlan);
  });

  it('corrida sem o campo (livre ou de antes do intervalado) fica com intervals null', () => {
    const { intervals: _, ...old } = applySamples(startRun(T0), straight(0, 10, 4));
    expect(parseRunState(JSON.parse(JSON.stringify(old)))).toEqual({ ...old, intervals: null });
    expect(parseRunState({ ...old, intervals: null })?.intervals).toBeNull();
  });

  it.each<[string, (i: Record<string, unknown>) => unknown]>([
    ['texto no lugar do andamento', () => 'intervalado'],
    ['plano inválido', (i) => ({ ...i, plan: { ...(i.plan as object), reps: 0 } })],
    ['índice além do fim', (i) => ({ ...i, index: 4 })],
    ['índice negativo', (i) => ({ ...i, index: -1 })],
    ['índice fracionado', (i) => ({ ...i, index: 1.5 })],
    ['início da fase sem distância', (i) => ({ ...i, phaseStart: { movingMs: 0 } })],
    ['última amostra ausente', (i) => ({ ...i, at: undefined })],
    ['resultados ausentes', (i) => ({ ...i, results: undefined })],
    ['resultado com tipo desconhecido', (i) => ({ ...i, results: [{ kind: 'sprint', ms: 1, meters: 1, skipped: false }] })],
    ['resultado sem "pulado"', (i) => ({ ...i, results: [{ kind: 'work', rep: 1, ms: 1, meters: 1 }] })],
    ['resultado com tiro fracionado', (i) => ({ ...i, results: [{ kind: 'work', rep: 1.5, ms: 1, meters: 1, skipped: false }] })],
    ['paceChecked ausente', (i) => ({ ...i, paceChecked: undefined })],
    ['midPace em texto', (i) => ({ ...i, midPace: '250' })],
  ])('rejeita a corrida com %s', (_, change) => {
    const value = saved();
    expect(parseRunState({ ...value, intervals: change(value.intervals) })).toBeNull();
  });

  it('aceita o índice no fim (plano concluído)', () => {
    const value = saved();
    expect(parseRunState({ ...value, intervals: { ...value.intervals, index: 3 } })?.intervals?.index).toBe(3);
  });
});
