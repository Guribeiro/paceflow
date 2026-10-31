import type { IntervalPlan } from '../interval-plan';
import { type RunSample, type RunState, applySamples, finishRun, pauseRun, skipPhase, startRun } from '../run-tracker';
import {
  DEFAULT_VOICE_PREFERENCES,
  intervalAnnouncement,
  phaseStartText,
  spokenMeasure,
} from '../run-voice';

const T0 = Date.UTC(2026, 10, 4, 9);
const METER = 1 / 111_195;
const MILE = 1609.344;

const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});
/** Linha reta a `speed` m/s de `fromS` a `toS`, saindo de `startMeters`; uma amostra por segundo. */
const straight = (fromS: number, toS: number, speed: number, startMeters = 0) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => north(startMeters + i * speed, fromS + i));

const plan = (change: Partial<IntervalPlan> = {}): IntervalPlan => ({
  warmup: null,
  reps: 2,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'time', seconds: 60 },
  cooldown: null,
  targetSecondsPerKm: null,
  ...change,
});

/** Aplica as amostras uma a uma, como a tarefa do GPS, e junta o que a voz falaria. */
function announcements(state: RunState, samples: RunSample[], prefs = DEFAULT_VOICE_PREFERENCES) {
  const spoken: string[] = [];
  let current = state;
  for (const sample of samples) {
    const next = applySamples(current, [sample]);
    const text = intervalAnnouncement(current, next, prefs);
    if (text) spoken.push(text);
    current = next;
  }
  return { spoken, state: current };
}

const TIRO_100S = 'Tiro 1: 1 minuto e 40 segundos, pace 4 minutos e 10 segundos por quilômetro.';

describe('spokenMeasure', () => {
  it.each<[Parameters<typeof spokenMeasure>[0], string]>([
    [{ kind: 'distance', meters: 400 }, '400 metros'],
    [{ kind: 'distance', meters: 1000 }, '1 quilômetro'],
    [{ kind: 'distance', meters: 1500 }, '1,5 quilômetros'],
    [{ kind: 'time', seconds: 30 }, '30 segundos'],
    [{ kind: 'time', seconds: 90 }, '1 minuto e 30 segundos'],
  ])('%j vira "%s"', (measure, text) => {
    expect(spokenMeasure(measure)).toBe(text);
  });
});

describe('phaseStartText', () => {
  it.each<[Parameters<typeof phaseStartText>[0], string]>([
    [{ kind: 'warmup', measure: { kind: 'time', seconds: 600 } }, 'Aquecimento: 10 minutos.'],
    [{ kind: 'work', measure: { kind: 'distance', meters: 400 }, rep: 3 }, 'Tiro 3 de 8: 400 metros.'],
    [{ kind: 'recovery', measure: { kind: 'time', seconds: 60 }, rep: 3 }, 'Recuperação: 1 minuto.'],
    [{ kind: 'cooldown', measure: { kind: 'distance', meters: 2000 } }, 'Desaquecimento: 2 quilômetros.'],
  ])('%j', (phase, text) => {
    expect(phaseStartText(phase, 8)).toBe(text);
  });
});

describe('intervalAnnouncement: um treino inteiro', () => {
  it('fala o resultado de cada tiro com a fase seguinte, avisa 10 s antes do tiro e fecha com a média', () => {
    // 2 × 400 m a 4 m/s (1:40 cada) com 1 min de recuperação: 100 s + 60 s + 100 s.
    const { spoken } = announcements(startRun(T0, 1000, false, false, plan()), straight(0, 262, 4));
    expect(spoken).toEqual([
      `${TIRO_100S} Recuperação: 1 minuto.`,
      'Tiro em 10 segundos.',
      'Tiro 2 de 2: 400 metros.',
      'Tiro 2: 1 minuto e 40 segundos, pace 4 minutos e 10 segundos por quilômetro. ' +
        'Treino concluído. Média dos tiros: 1 minuto e 40 segundos. Pode finalizar a corrida.',
    ]);
  });

  it('com aquecimento por tempo e desaquecimento: avisa antes do 1º tiro e conclui depois do desaquecimento', () => {
    const p = plan({ reps: 1, warmup: { kind: 'time', seconds: 30 }, recovery: null, cooldown: { kind: 'time', seconds: 60 } });
    const { spoken } = announcements(startRun(T0, 1000, false, false, p), straight(0, 200, 4));
    expect(spoken).toEqual([
      'Tiro em 10 segundos.',
      'Tiro 1 de 1: 400 metros.',
      `${TIRO_100S} Desaquecimento: 1 minuto.`,
      'Treino concluído. Média dos tiros: 1 minuto e 40 segundos. Pode finalizar a corrida.',
    ]);
  });

  it('em milhas, fala o pace por milha', () => {
    const { spoken } = announcements(startRun(T0, MILE, false, false, plan()), straight(0, 101, 4));
    // 250 s/km × 1,609344 = 402 s/mi.
    expect(spoken).toEqual([
      'Tiro 1: 1 minuto e 40 segundos, pace 6 minutos e 42 segundos por milha. Recuperação: 1 minuto.',
    ]);
  });
});

describe('intervalAnnouncement: transições', () => {
  it('várias fases numa amostra: fala o último tiro e a fase em que está', () => {
    const p = plan({ reps: 3, work: { kind: 'distance', meters: 100 }, recovery: { kind: 'distance', meters: 100 } });
    const before = applySamples(startRun(T0, 1000, false, false, p), [north(0, 0)]);
    const after = applySamples(before, [north(450, 60)]);
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toMatch(/^Tiro 2: 13 segundos, pace .+\. Tiro 3 de 3: 100 metros\.$/);
  });

  it('fase por distância antes de um tiro não tem aviso de 10 s', () => {
    // Aquecimento de 100 m caminhando a 0,8 m/s: dura 125 s, mais que "100" lido como segundos.
    const p = plan({ warmup: { kind: 'distance', meters: 100 }, recovery: null });
    const { spoken } = announcements(startRun(T0, 1000, false, false, p), straight(0, 130, 0.8));
    expect(spoken).toEqual(['Tiro 1 de 2: 400 metros.']);
  });

  it('tiro por tempo seguido de recuperação não tem aviso de 10 s', () => {
    const p = plan({ work: { kind: 'time', seconds: 60 } });
    const { spoken } = announcements(startRun(T0, 1000, false, false, p), straight(0, 60, 4));
    expect(spoken).toEqual([
      'Tiro 1: 1 minuto, pace 4 minutos e 10 segundos por quilômetro. Recuperação: 1 minuto.',
    ]);
  });

  it('tiro pulado não é falado como resultado nem entra na média', () => {
    const p = plan({ recovery: null });
    let state = applySamples(startRun(T0, 1000, false, false, p), straight(0, 20, 4));
    const skipped = skipPhase(state, T0 + 20_000);
    expect(intervalAnnouncement(state, skipped, DEFAULT_VOICE_PREFERENCES)).toBe('Tiro 2 de 2: 400 metros.');

    state = skipPhase(skipped, T0 + 21_000);
    expect(intervalAnnouncement(skipped, state, DEFAULT_VOICE_PREFERENCES)).toBe('Treino concluído. Pode finalizar a corrida.');
  });
});

describe('intervalAnnouncement: pace na metade do tiro', () => {
  /** Estado antes e depois da medida da metade do tiro, com o pace `midPace`. */
  function measured(midPace: number, target: number | null, splitMeters = 1000) {
    const before = startRun(T0, splitMeters, false, false, plan({ targetSecondsPerKm: target }));
    const after: RunState = { ...before, intervals: { ...before.intervals!, paceChecked: true, midPace } };
    return [before, after] as const;
  }

  it.each([
    ['no alvo', 240],
    ['2,9 % mais lento', 247],
    ['2,9 % mais rápido', 233],
  ])('%s: "No ritmo."', (_, midPace) => {
    const [before, after] = measured(midPace, 240);
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toBe('No ritmo.');
  });

  it.each([
    ['3,1 % mais lento', 247.5, /^Acelere: /],
    ['3,1 % mais rápido', 232.5, /^Segure: /],
  ])('%s já sai da tolerância', (_, midPace, expected) => {
    const [before, after] = measured(midPace, 240);
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toMatch(expected);
  });

  it('mais lento que o alvo: manda acelerar, com o pace e o alvo', () => {
    const [before, after] = measured(250, 240);
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toBe(
      'Acelere: 4 minutos e 10 segundos por quilômetro, alvo 4 minutos por quilômetro.',
    );
  });

  it('mais rápido que o alvo: manda segurar', () => {
    const [before, after] = measured(230, 240);
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toBe(
      'Segure: 3 minutos e 50 segundos por quilômetro, alvo 4 minutos por quilômetro.',
    );
  });

  it('em milhas, os dois paces por milha', () => {
    const [before, after] = measured(250, 240, MILE);
    // 250 e 240 s/km = 6:42 e 6:26/mi.
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toBe(
      'Acelere: 6 minutos e 42 segundos por milha, alvo 6 minutos e 26 segundos por milha.',
    );
  });

  it('com o tracker de verdade: mede na metade e fala uma vez', () => {
    const p = plan({ targetSecondsPerKm: 230 });
    const { spoken } = announcements(startRun(T0, 1000, false, false, p), straight(0, 90, 4));
    expect(spoken).toEqual(['Acelere: 4 minutos e 10 segundos por quilômetro, alvo 3 minutos e 50 segundos por quilômetro.']);
  });

  it('sem medida nova, não repete', () => {
    const [, after] = measured(250, 240);
    expect(intervalAnnouncement(after, after, DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });
});

describe('intervalAnnouncement: quando não fala', () => {
  const p = plan();
  const before = applySamples(startRun(T0, 1000, false, false, p), straight(0, 99, 4));
  const after = applySamples(before, straight(100, 101, 4, 400));

  it('fala na transição com a voz ligada (controle)', () => {
    expect(intervalAnnouncement(before, after, DEFAULT_VOICE_PREFERENCES)).toBe(`${TIRO_100S} Recuperação: 1 minuto.`);
  });

  it('com a voz desligada', () => {
    expect(intervalAnnouncement(before, after, { ...DEFAULT_VOICE_PREFERENCES, enabled: false })).toBeNull();
  });

  it('na corrida livre', () => {
    const free = startRun(T0);
    expect(intervalAnnouncement(free, applySamples(free, straight(0, 200, 4)), DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });

  it('com a corrida pausada ou finalizada', () => {
    expect(intervalAnnouncement(before, pauseRun(after, T0 + 101_000), DEFAULT_VOICE_PREFERENCES)).toBeNull();
    expect(intervalAnnouncement(before, finishRun(after, T0 + 101_000), DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });

  it('sem nada novo no meio de uma fase', () => {
    const mid = applySamples(before, []);
    expect(intervalAnnouncement(before, mid, DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });

  it('com o plano já concluído', () => {
    const done = applySamples(startRun(T0, 1000, false, false, plan({ reps: 1 })), straight(0, 101, 4));
    expect(intervalAnnouncement(done, applySamples(done, straight(102, 110, 4, 408)), DEFAULT_VOICE_PREFERENCES)).toBeNull();
  });
});
