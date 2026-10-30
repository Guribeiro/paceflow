import {
  type RunSample,
  applySamples,
  currentPace,
  elapsedMs,
  finishRun,
  haversineMeters,
  parseRunState,
  pauseRun,
  resumeRun,
  splitDurations,
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

/** Linha reta a `speed` m/s de `fromS` a `toS`, saindo de `startMeters`; uma amostra por segundo. */
const straight = (fromS: number, toS: number, speed: number, startMeters = 0) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => north(startMeters + i * speed, fromS + i));

describe('haversineMeters', () => {
  it('mede ~1 km em 1/111,195 de grau de latitude por metro', () => {
    expect(haversineMeters(north(0, 0), north(1000, 0))).toBeCloseTo(1000, 0);
  });
});

describe('applySamples', () => {
  it('soma a distância de uma linha reta', () => {
    const state = applySamples(startRun(T0), straight(0, 100, 3));
    expect(state.distanceMeters).toBeCloseTo(300, 0);
  });

  it('descarta amostras imprecisas e saltos impossíveis', () => {
    const state = applySamples(startRun(T0), [
      north(0, 0),
      north(10, 3, 80), // imprecisa
      north(500, 4), // salto de 500 m em 4 s
      north(12, 5),
    ]);
    expect(state.distanceMeters).toBeCloseTo(12, 0);
  });

  it('não soma a tremida do GPS parado', () => {
    const jitter = Array.from({ length: 60 }, (_, i) => north(i % 2 === 0 ? 0 : 2, i));
    expect(applySamples(startRun(T0), jitter).distanceMeters).toBe(0);
  });

  it('fecha parciais com o instante interpolado', () => {
    // 4 m/s: o 1º km fecha em 250 s.
    const state = applySamples(startRun(T0), straight(0, 600, 4));
    expect(splitDurations(state)).toHaveLength(2);
    expect(splitDurations(state)[0]).toBeCloseTo(250, 3);
    expect(splitDurations(state)[1]).toBeCloseTo(250, 3);
  });

  it('parciais em milhas quando pedido', () => {
    const state = applySamples(startRun(T0, 1609.344), straight(0, 500, 4));
    expect(splitDurations(state)).toHaveLength(1);
    expect(splitDurations(state)[0]).toBeCloseTo(1609.344 / 4, 3);
  });
});

describe('pausar e retomar', () => {
  it('não conta o tempo nem a distância da pausa', () => {
    let state = applySamples(startRun(T0), straight(0, 100, 3));
    state = pauseRun(state, T0 + 100_000);
    state = applySamples(state, [north(600, 200)]); // ignorada: pausada
    state = resumeRun(state, T0 + 300_000);
    // Retoma 600 m adiante: esse deslocamento não conta.
    state = applySamples(state, straight(300, 400, 3, 600));

    expect(state.distanceMeters).toBeCloseTo(600, 0);
    expect(elapsedMs(state, T0 + 400_000)).toBe(200_000);
  });

  it('finalizar congela o tempo', () => {
    const state = finishRun(startRun(T0), T0 + 60_000);
    expect(state.status).toBe('finished');
    expect(elapsedMs(state, T0 + 999_000)).toBe(60_000);
  });
});

describe('currentPace', () => {
  it('usa os últimos 30 s', () => {
    // 3 m/s por 100 s e depois 4 m/s: o pace atual reflete só o trecho rápido.
    const state = applySamples(startRun(T0), [...straight(0, 100, 3), ...straight(101, 160, 4, 304)]);
    expect(currentPace(state)).toBeCloseTo(250, 0);
  });

  it('null parado ou pausado', () => {
    expect(currentPace(startRun(T0))).toBeNull();
    expect(currentPace(pauseRun(applySamples(startRun(T0), straight(0, 60, 3)), T0 + 60_000))).toBeNull();
  });
});

describe('haversineMeters (bordas)', () => {
  it('é zero no mesmo ponto e simétrica', () => {
    expect(haversineMeters(north(0, 0), north(0, 0))).toBe(0);
    expect(haversineMeters(north(0, 0), north(750, 0))).toBeCloseTo(haversineMeters(north(750, 0), north(0, 0)), 9);
  });
});

describe('applySamples (bordas)', () => {
  it('a primeira amostra só marca o ponto de partida', () => {
    const state = applySamples(startRun(T0), [north(0, 0)]);
    expect(state.distanceMeters).toBe(0);
    expect(state.lastPoint).toEqual({ latitude: -23.5, longitude: -46.6, movingMs: 0 });
  });

  it('fecha várias parciais num único passo, cada uma no seu instante', () => {
    // 2,5 km em 300 s (8,33 m/s): os km 1 e 2 fecham aos 120 s e 240 s.
    const state = applySamples(startRun(T0), [north(0, 0), north(2500, 300)]);
    expect(state.distanceMeters).toBeCloseTo(2500, 0);
    expect(state.splits).toHaveLength(2);
    expect(state.splits[0]).toBeCloseTo(120_000, 0);
    expect(state.splits[1]).toBeCloseTo(240_000, 0);
  });

  it('ordena amostras que chegam fora de ordem', () => {
    const ordered = straight(0, 100, 3);
    const shuffled = [...ordered.slice(50), ...ordered.slice(0, 50).reverse()];
    expect(applySamples(startRun(T0), shuffled)).toEqual(applySamples(startRun(T0), ordered));
  });

  it('aceita amostras sem precisão informada (accuracy null)', () => {
    const state = applySamples(startRun(T0), [north(0, 0, null), north(12, 5, null)]);
    expect(state.distanceMeters).toBeCloseTo(12, 0);
  });

  it('aceita precisão de 25 m e descarta a partir de 25,1 m', () => {
    expect(applySamples(startRun(T0), [north(0, 0), north(12, 5, 25)]).distanceMeters).toBeCloseTo(12, 0);
    expect(applySamples(startRun(T0), [north(0, 0), north(12, 5, 25.1)]).distanceMeters).toBe(0);
  });

  it('aceita 9,8 m/s e descarta 11 m/s', () => {
    expect(applySamples(startRun(T0), [north(0, 0), north(49, 5)]).distanceMeters).toBeCloseTo(49, 0);
    expect(applySamples(startRun(T0), [north(0, 0), north(55, 5)]).distanceMeters).toBe(0);
  });

  it('passos menores que 3 m acumulam até somar um passo válido', () => {
    // 2 m e depois mais 2 m: o segundo conta 4 m desde o último ponto aceito.
    const state = applySamples(startRun(T0), [north(0, 0), north(2, 1), north(4, 2)]);
    expect(state.distanceMeters).toBeCloseTo(4, 0);
    expect(state.lastPoint?.movingMs).toBe(2000);
  });

  it('descarta duas amostras no mesmo instante', () => {
    expect(applySamples(startRun(T0), [north(0, 0), north(5, 0)]).distanceMeters).toBe(0);
  });

  it('não altera corrida pausada ou finalizada', () => {
    const paused = pauseRun(startRun(T0), T0 + 1000);
    const finished = finishRun(startRun(T0), T0 + 1000);
    expect(applySamples(paused, straight(0, 10, 3))).toBe(paused);
    expect(applySamples(finished, straight(0, 10, 3))).toBe(finished);
  });

  it('ignora amostras com horário anterior à retomada', () => {
    let state = applySamples(startRun(T0), straight(0, 100, 3));
    state = pauseRun(state, T0 + 100_000);
    state = resumeRun(state, T0 + 300_000);
    // 570 m aos 290 s: chegou atrasada, de antes de retomar; não pode virar ponto de partida.
    state = applySamples(state, [north(570, 290), ...straight(300, 400, 3, 600)]);
    expect(state.distanceMeters).toBeCloseTo(600, 0);
  });
});

describe('pausar, retomar e finalizar (transições)', () => {
  it('retomar descarta o último ponto e a janela do pace', () => {
    const paused = pauseRun(applySamples(startRun(T0), straight(0, 60, 3)), T0 + 60_000);
    const resumed = resumeRun(paused, T0 + 90_000);
    expect(resumed).toMatchObject({ status: 'running', resumedAt: T0 + 90_000, lastPoint: null, recent: [] });
    expect(resumed.movingMs).toBe(60_000);
  });

  it('pausar e finalizar repetidos não mudam nada', () => {
    const paused = pauseRun(startRun(T0), T0 + 10_000);
    expect(pauseRun(paused, T0 + 50_000)).toBe(paused);
    const finished = finishRun(paused, T0 + 50_000);
    expect(finishRun(finished, T0 + 90_000)).toBe(finished);
  });

  it('não pausa nem retoma uma corrida finalizada', () => {
    const finished = finishRun(startRun(T0), T0 + 10_000);
    expect(pauseRun(finished, T0 + 20_000)).toBe(finished);
    expect(resumeRun(finished, T0 + 20_000)).toBe(finished);
  });

  it('retomar uma corrida em andamento não perde o último ponto', () => {
    const running = applySamples(startRun(T0), straight(0, 10, 3));
    expect(resumeRun(running, T0 + 20_000)).toBe(running);
  });

  it('finalizar uma corrida pausada mantém só o tempo em movimento', () => {
    const paused = pauseRun(startRun(T0), T0 + 40_000);
    expect(finishRun(paused, T0 + 500_000).movingMs).toBe(40_000);
  });

  it('elapsedMs não fica negativo com relógio antes do início', () => {
    expect(elapsedMs(startRun(T0), T0 - 5000)).toBe(0);
  });
});

describe('currentPace (bordas)', () => {
  const withRecent = (recent: { movingMs: number; distanceMeters: number }[]) => ({ ...startRun(T0), recent });

  it('exige ao menos 20 m na janela', () => {
    expect(currentPace(withRecent([{ movingMs: 0, distanceMeters: 0 }, { movingMs: 6000, distanceMeters: 19.9 }]))).toBeNull();
    expect(currentPace(withRecent([{ movingMs: 0, distanceMeters: 0 }, { movingMs: 6000, distanceMeters: 20 }]))).toBe(300);
  });

  it('a janela guarda um ponto de antes dos 30 s', () => {
    const state = applySamples(startRun(T0), straight(0, 100, 3));
    expect(state.recent[0].movingMs).toBe(70_000);
    expect(state.recent.at(-1)?.movingMs).toBe(100_000);
  });

  it('depois de retomar, fica sem leitura até haver dois pontos novos', () => {
    let state = pauseRun(applySamples(startRun(T0), straight(0, 60, 3)), T0 + 60_000);
    state = resumeRun(state, T0 + 100_000);
    state = applySamples(state, [north(500, 100)]);
    expect(currentPace(state)).toBeNull();
    state = applySamples(state, straight(101, 130, 4, 504));
    expect(currentPace(state)).toBeCloseTo(250, 0);
  });
});

describe('splitDurations', () => {
  it('vazio sem parciais fechadas', () => {
    expect(splitDurations(applySamples(startRun(T0), straight(0, 100, 3)))).toEqual([]);
  });
});

describe('parseRunState', () => {
  const valid = finishRun(applySamples(startRun(T0), straight(0, 300, 4)), T0 + 300_000);

  it('aceita um estado salvo em JSON', () => {
    expect(parseRunState(JSON.parse(JSON.stringify(valid)))).toEqual(valid);
    const running = applySamples(startRun(T0), straight(0, 10, 3));
    expect(parseRunState(JSON.parse(JSON.stringify(running)))).toEqual(running);
  });

  it.each([
    ['null', null],
    ['texto', 'run'],
    ['status desconhecido', { ...valid, status: 'walking' }],
    ['parcial de 0 m', { ...valid, splitMeters: 0 }],
    ['distância não finita', { ...valid, distanceMeters: Number.NaN }],
    ['tempo como texto', { ...valid, movingMs: '300000' }],
    ['resumedAt ausente', { ...valid, resumedAt: undefined }],
    ['parcial inválida', { ...valid, splits: [250_000, 'x'] }],
    ['lastPoint como número', { ...valid, lastPoint: 3 }],
    ['sem janela do pace', { ...valid, recent: undefined }],
  ])('rejeita %s', (_name, value) => {
    expect(parseRunState(value)).toBeNull();
  });
});
