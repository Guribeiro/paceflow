import {
  type RunSample,
  applySamples,
  currentPace,
  elapsedMs,
  finishRun,
  haversineMeters,
  isAutoPaused,
  MOVING_SPEED_MPS,
  parseRunState,
  pauseRun,
  resumeRun,
  splitDurations,
  startRun,
} from '../run-tracker';
import { ROUTE_MAX_POINTS } from '../route';

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

describe('pausa automática', () => {
  /** 120 m a 4 m/s (0–30 s), com a pausa automática ligada: sai do raio de parada pela última vez aos 30 s. */
  const ran = (autoPause = true) => applySamples(startRun(T0, 1000, autoPause), straight(0, 30, 4));
  /** Parado em `at`, uma amostra por segundo. */
  const still = (at: number, fromS: number, toS: number) =>
    Array.from({ length: toS - fromS + 1 }, (_, i) => north(at, fromS + i));
  /** Parado com a tremida do GPS: `at + amp`, `at - amp`, alternando. */
  const jitter = (at: number, fromS: number, toS: number, amp = 2) =>
    Array.from({ length: toS - fromS + 1 }, (_, i) => north(at + (i % 2 === 0 ? amp : -amp), fromS + i));
  /** Tremida que soma distância: `at + 4`, `at`, alternando (passos de 4 m, dentro do raio de 6 m). */
  const swing = (at: number, fromS: number, toS: number) =>
    Array.from({ length: toS - fromS + 1 }, (_, i) => north(at + (i % 2 === 0 ? 4 : 0), fromS + i));
  /** Parou nos 120 m aos 30 s e ficou tremendo até os 60 s. */
  const autoPaused = () => applySamples(ran(), jitter(120, 31, 60));

  it('começa desligada, a menos que pedida', () => {
    expect(startRun(T0)).toMatchObject({
      autoPause: false,
      autoPaused: false,
      lastMoveAt: T0,
      anchor: null,
      resumePending: false,
    });
    expect(startRun(T0, 1000, true).autoPause).toBe(true);
  });

  it('correndo, não pausa', () => {
    const state = ran();
    expect(state.autoPaused).toBe(false);
    expect(isAutoPaused(state, T0 + 30_000)).toBe(false);
    expect(elapsedMs(state, T0 + 30_000)).toBe(30_000);
  });

  it('parado com a tremida do GPS, pausa depois de 8 s e esses 8 s contam', () => {
    const before = applySamples(ran(), jitter(120, 31, 38));
    expect(before.autoPaused).toBe(false);
    expect(elapsedMs(before, T0 + 38_000)).toBe(38_000);

    const state = applySamples(before, jitter(120, 39, 60));
    expect(state).toMatchObject({ status: 'running', autoPaused: true, movingMs: 38_000, resumedAt: null });
    expect(state.lastPoint?.movingMs).toBe(30_000);
    expect(elapsedMs(state, T0 + 600_000)).toBe(38_000);
    expect(isAutoPaused(state, T0 + 60_000)).toBe(true);
  });

  it('sem amostras (GPS calado), o relógio congela 8 s depois da última saída do raio', () => {
    const state = ran();
    expect(isAutoPaused(state, T0 + 38_000)).toBe(false);
    expect(isAutoPaused(state, T0 + 38_001)).toBe(true);
    expect(elapsedMs(state, T0 + 38_000)).toBe(38_000);
    expect(elapsedMs(state, T0 + 300_000)).toBe(38_000);
    // A pausa só fica gravada quando chega a próxima amostra, com o mesmo tempo.
    expect(state.autoPaused).toBe(false);
    expect(applySamples(state, [north(120, 300)])).toMatchObject({ autoPaused: true, movingMs: 38_000 });
  });

  it('caminhando a 1 m/s não pausa', () => {
    const state = applySamples(startRun(T0, 1000, true), straight(0, 120, 1));
    expect(state.autoPaused).toBe(false);
    expect(isAutoPaused(state, T0 + 120_000)).toBe(false);
    expect(elapsedMs(state, T0 + 120_000)).toBe(120_000);
    expect(state.distanceMeters).toBeCloseTo(120, 0);
  });

  it('com a pausa automática desligada, o tempo parado conta', () => {
    const state = applySamples(ran(false), jitter(120, 31, 120));
    expect(state.autoPaused).toBe(false);
    expect(isAutoPaused(state, T0 + 120_000)).toBe(false);
    expect(elapsedMs(state, T0 + 120_000)).toBe(120_000);
  });

  it('a primeira amostra a 10 m de onde parou só pede confirmação', () => {
    const state = applySamples(autoPaused(), [north(131, 61)]);
    expect(state).toMatchObject({ autoPaused: true, resumePending: true, movingMs: 38_000, resumedAt: null });
    expect(elapsedMs(state, T0 + 61_000)).toBe(38_000);
  });

  it('volta a contar na segunda amostra seguida a 10 m, sem somar o trecho de saída', () => {
    const paused = autoPaused();
    const resumed = applySamples(paused, [north(131, 61), north(135, 62)]);
    // Retoma na amostra que confirmou: o segundo entre as duas não conta.
    expect(resumed).toMatchObject({ autoPaused: false, resumePending: false, resumedAt: T0 + 62_000, movingMs: 38_000 });
    expect(resumed.distanceMeters).toBe(paused.distanceMeters);
    expect(resumed.lastPoint?.latitude).toBe(north(135, 62).latitude);

    const state = applySamples(resumed, straight(63, 72, 4, 139));
    expect(elapsedMs(state, T0 + 72_000)).toBe(48_000);
    expect(state.distanceMeters).toBeCloseTo(paused.distanceMeters + 40, 0);
    expect(currentPace(state)).toBeCloseTo(250, 0);
  });

  describe('salto do GPS parado', () => {
    /** Aplica uma amostra por vez e devolve se ficou pausada depois de cada uma. */
    const timeline = (samples: RunSample[]) => {
      let state = autoPaused();
      const paused = samples.map((sample) => {
        state = applySamples(state, [sample]);
        return state.autoPaused;
      });
      return { state, paused };
    };

    it.each([
      ['20 m com precisão de 20 m', north(140, 61, 20)],
      ['500 m', north(620, 61, 10)],
    ])('um salto único de %s não retoma', (_name, spike) => {
      const { state, paused } = timeline([spike, ...jitter(120, 62, 100)]);
      expect(paused.every(Boolean)).toBe(true);
      expect(state).toMatchObject({ autoPaused: true, resumePending: false, movingMs: 38_000 });
      expect(state.distanceMeters).toBe(autoPaused().distanceMeters);
    });

    it('uma amostra perto depois de uma longe zera a confirmação', () => {
      let state = applySamples(autoPaused(), [north(140, 61)]);
      expect(state.resumePending).toBe(true);
      state = applySamples(state, [north(121, 62)]);
      expect(state).toMatchObject({ autoPaused: true, resumePending: false });
      // Longe de novo: começa outra confirmação, não retoma.
      state = applySamples(state, [north(140, 63)]);
      expect(state).toMatchObject({ autoPaused: true, resumePending: true });
      state = applySamples(state, [north(144, 64)]);
      expect(state).toMatchObject({ autoPaused: false, resumedAt: T0 + 64_000 });
    });

    it('amostra imprecisa não pede nem desfaz a confirmação', () => {
      expect(applySamples(autoPaused(), [north(200, 61, 40)]).resumePending).toBe(false);
      const state = applySamples(autoPaused(), [north(140, 61), north(120, 62, 40), north(144, 63)]);
      expect(state).toMatchObject({ autoPaused: false, resumedAt: T0 + 63_000 });
    });

    it('depois de retomar, uma nova parada também exige duas amostras', () => {
      let state = applySamples(autoPaused(), [north(131, 61), north(135, 62)]);
      state = applySamples(state, [...straight(63, 72, 4, 139), ...jitter(175, 73, 90)]);
      expect(state.autoPaused).toBe(true);
      expect(applySamples(state, [north(200, 91)])).toMatchObject({ autoPaused: true, resumePending: true });
    });
  });

  it('a tremida e passos de menos de 10 m não retomam', () => {
    const state = applySamples(autoPaused(), [...jitter(120, 61, 120, 3), north(129, 121)]);
    expect(state).toMatchObject({ autoPaused: true, movingMs: 38_000, resumedAt: null });
  });

  it('pausada, o pace atual fica sem leitura', () => {
    expect(currentPace(ran())).toBeCloseTo(250, 0);
    expect(currentPace(autoPaused())).toBeNull();
  });

  it('a tremida somada dentro do raio sai da distância', () => {
    const swinging = applySamples(ran(), swing(120, 31, 38));
    expect(swinging.distanceMeters).toBeCloseTo(152, 0); // 8 passos de 4 m somados enquanto parado

    const paused = applySamples(swinging, swing(120, 39, 39));
    expect(paused.autoPaused).toBe(true);
    // Volta ao mesmo valor de uma parada sem tremida alguma.
    expect(paused.distanceMeters).toBe(applySamples(ran(), still(120, 31, 39)).distanceMeters);
  });

  it('parar sem tremida não tira distância já corrida', () => {
    const state = applySamples(ran(), still(120, 31, 39));
    expect(state.autoPaused).toBe(true);
    expect(state.distanceMeters).toBeCloseTo(ran().distanceMeters, 3);
  });

  it('não devolve a distância se uma parcial fechou com a tremida dentro do raio', () => {
    // Centro do raio nos 992 m (248 s); a tremida passa dos 1000 m e fecha o 1º km.
    const run = applySamples(startRun(T0, 1000, true), straight(0, 248, 4));
    const state = applySamples(run, swing(992, 249, 257));
    expect(state.autoPaused).toBe(true);
    expect(state.splits).toHaveLength(1);
    expect(state.distanceMeters).toBeCloseTo(1024, 0);
  });

  it('uma parcial fechada antes de parar não impede a volta da distância', () => {
    // 1104 m: o 1º km fechou correndo, antes do centro do raio.
    const run = applySamples(startRun(T0, 1000, true), straight(0, 276, 4));
    const state = applySamples(run, swing(1104, 277, 285));
    expect(state.autoPaused).toBe(true);
    expect(state.splits).toHaveLength(1);
    expect(state.distanceMeters).toBe(applySamples(run, still(1104, 277, 285)).distanceMeters);
  });

  describe('amostras imprecisas (> 25 m)', () => {
    it('não gravam a pausa nem contam como movimento', () => {
      const state = applySamples(ran(), [...still(120, 31, 60).map((s) => ({ ...s, accuracy: 30 })), north(200, 61, 40)]);
      expect(state.autoPaused).toBe(false);
      expect(elapsedMs(state, T0 + 61_000)).toBe(38_000);
    });

    it('não retomam', () => {
      const state = applySamples(autoPaused(), [north(200, 61, 40), north(300, 62, 25.1)]);
      expect(state).toMatchObject({ autoPaused: true, movingMs: 38_000 });
    });
  });

  describe('limites exatos', () => {
    // No equador, `metros / (R·π/180)` graus de latitude dá a distância exata em haversineMeters.
    const DEGREES_PER_METER = 180 / (Math.PI * 6_371_000);
    const equator = (meters: number, seconds: number): RunSample => ({
      latitude: meters * DEGREES_PER_METER,
      longitude: 0,
      accuracy: 5,
      timestamp: T0 + seconds * 1000,
    });
    const stopped = () =>
      applySamples(startRun(T0, 1000, true), Array.from({ length: 10 }, (_, i) => equator(0, i)));

    it('as distâncias de teste são exatas', () => {
      expect(haversineMeters(equator(0, 0), equator(6, 0))).toBe(6);
      expect(haversineMeters(equator(0, 0), equator(10, 0))).toBe(10);
    });

    it('sair exatamente 6 m do centro conta como movimento', () => {
      const state = applySamples(startRun(T0, 1000, true), [equator(0, 0), equator(6, 9)]);
      expect(state).toMatchObject({ autoPaused: false, lastMoveAt: T0 + 9000 });
    });

    it('pausa só depois de 8 s, não aos 8 s', () => {
      expect(applySamples(startRun(T0, 1000, true), [equator(0, 0), equator(0, 8)]).autoPaused).toBe(false);
      expect(stopped()).toMatchObject({ autoPaused: true, movingMs: 8000 });
    });

    it('retoma com duas amostras a exatamente 10 m de onde parou', () => {
      expect(applySamples(stopped(), [equator(10, 20)])).toMatchObject({ autoPaused: true, resumePending: true });
      expect(applySamples(stopped(), [equator(10, 20), equator(10, 21)])).toMatchObject({
        autoPaused: false,
        resumedAt: T0 + 21_000,
      });
    });
  });

  describe('com a pausa manual', () => {
    it('pausar durante a automática guarda o tempo congelado', () => {
      const state = pauseRun(autoPaused(), T0 + 90_000);
      expect(state).toMatchObject({ status: 'paused', autoPaused: false, movingMs: 38_000, resumedAt: null });
      expect(elapsedMs(state, T0 + 500_000)).toBe(38_000);
    });

    it('pausar ou finalizar no meio da confirmação a descarta', () => {
      const pending = applySamples(autoPaused(), [north(140, 61)]);
      expect(pending.resumePending).toBe(true);
      expect(pauseRun(pending, T0 + 62_000).resumePending).toBe(false);
      expect(finishRun(pending, T0 + 62_000).resumePending).toBe(false);
      expect(resumeRun(pauseRun(pending, T0 + 62_000), T0 + 70_000).resumePending).toBe(false);
    });

    it('pausar com o GPS calado guarda o tempo até a parada', () => {
      expect(pauseRun(ran(), T0 + 60_000).movingMs).toBe(38_000);
    });

    it('retomar recomeça o raio de parada e o tempo volta a contar', () => {
      const resumed = resumeRun(pauseRun(autoPaused(), T0 + 90_000), T0 + 100_000);
      expect(resumed).toMatchObject({
        status: 'running',
        autoPaused: false,
        resumedAt: T0 + 100_000,
        lastMoveAt: T0 + 100_000,
        lastPoint: null,
        anchor: null,
      });
      // Sem amostra nova, o relógio corre: não há ponto de parada.
      expect(isAutoPaused(resumed, T0 + 200_000)).toBe(false);

      const state = applySamples(resumed, straight(100, 110, 4, 500));
      expect(state.autoPaused).toBe(false);
      expect(elapsedMs(state, T0 + 110_000)).toBe(48_000);
    });

    it('depois de retomar, só pausa sozinha 8 s depois da primeira amostra', () => {
      const resumed = resumeRun(pauseRun(autoPaused(), T0 + 90_000), T0 + 100_000);
      expect(applySamples(resumed, still(500, 105, 113)).autoPaused).toBe(false);
      expect(applySamples(resumed, still(500, 105, 114))).toMatchObject({ autoPaused: true, movingMs: 38_000 + 13_000 });
    });

    it('finalizar durante a automática guarda o tempo congelado', () => {
      expect(finishRun(autoPaused(), T0 + 90_000)).toMatchObject({ status: 'finished', autoPaused: false, movingMs: 38_000 });
      expect(finishRun(ran(), T0 + 90_000).movingMs).toBe(38_000);
    });
  });
});

describe('parseRunState (pausa automática)', () => {
  const running = applySamples(startRun(T0, 1000, true), straight(0, 30, 4));
  const paused = applySamples(running, Array.from({ length: 20 }, (_, i) => north(120, 31 + i)));

  it('aceita um estado em pausa automática salvo em JSON', () => {
    expect(paused.autoPaused).toBe(true);
    expect(parseRunState(JSON.parse(JSON.stringify(paused)))).toEqual(paused);
  });

  it('completa uma corrida salva antes da pausa automática', () => {
    const { autoPause: _a, autoPaused: _b, lastMoveAt: _c, anchor: _d, resumePending: _e, ...old } = running;
    expect(parseRunState(JSON.parse(JSON.stringify(old)))).toEqual({
      ...old,
      autoPause: false,
      autoPaused: false,
      lastMoveAt: T0,
      anchor: null,
      resumePending: false,
    });

    const { autoPause: _f, autoPaused: _g, lastMoveAt: _h, anchor: _i, resumePending: _j, ...oldPaused } = pauseRun(
      running,
      T0 + 40_000,
    );
    expect(parseRunState(oldPaused)).toMatchObject({
      autoPause: false,
      autoPaused: false,
      lastMoveAt: T0,
      anchor: null,
      resumePending: false,
    });
  });

  it('completa uma corrida salva antes da confirmação da retomada', () => {
    const { resumePending: _a, ...old } = paused;
    expect(parseRunState(JSON.parse(JSON.stringify(old)))).toEqual({ ...old, resumePending: false });
  });

  it('numa corrida antiga retomada, a parada conta a partir da retomada', () => {
    const { autoPause: _a, autoPaused: _b, lastMoveAt: _c, anchor: _d, resumePending: _e, ...old } = resumeRun(pauseRun(running, T0 + 40_000), T0 + 90_000);
    expect(parseRunState(old)?.lastMoveAt).toBe(T0 + 90_000);
  });

  it.each([
    ['autoPause como texto', { ...running, autoPause: 'sim' }],
    ['autoPaused como número', { ...running, autoPaused: 1 }],
    ['lastMoveAt como texto', { ...running, lastMoveAt: '0' }],
    ['lastMoveAt não finito', { ...running, lastMoveAt: Number.POSITIVE_INFINITY }],
    ['anchor como número', { ...running, anchor: 3 }],
    ['anchor vazio', { ...running, anchor: {} }],
    ['anchor como texto', { ...running, anchor: 'centro' }],
    ['anchor com latitude NaN', { ...running, anchor: { ...running.anchor, latitude: Number.NaN } }],
    ['anchor sem distância', { ...running, anchor: { latitude: -23.5, longitude: -46.6 } }],
    ['lastPoint vazio', { ...running, lastPoint: {} }],
    ['lastPoint como texto', { ...running, lastPoint: 'ponto' }],
    ['lastPoint com movingMs NaN', { ...running, lastPoint: { ...running.lastPoint, movingMs: Number.NaN } }],
    ['lastPoint com longitude em texto', { ...running, lastPoint: { ...running.lastPoint, longitude: '-46.6' } }],
    ['resumePending como texto', { ...paused, resumePending: 'sim' }],
    ['pausa automática sem o ponto de parada', { ...paused, lastPoint: null }],
    ['pausa automática numa corrida pausada', { ...paused, status: 'paused' }],
    ['pausa automática numa corrida finalizada', { ...paused, status: 'finished' }],
  ])('rejeita %s', (_name, value) => {
    expect(parseRunState(value)).toBeNull();
  });
});

describe('pausa automática pela velocidade do GPS', () => {
  /** Amostra com a velocidade Doppler do GPS. */
  const at = (meters: number, seconds: number, speed: number | null | undefined, accuracy = 5): RunSample => ({
    ...north(meters, seconds, accuracy),
    speed,
  });
  /** `count` amostras, uma por segundo a partir de `fromS`, andando `step` m por amostra com a velocidade dada. */
  const walk = (
    fromS: number,
    count: number,
    startMeters: number,
    step: number,
    speed: (i: number) => number | null | undefined,
  ) =>
    Array.from({ length: count }, (_, i) => at(startMeters + i * step, fromS + i, speed(i)));
  /** Correndo a 4 m/s (velocidade 4) de 0 a 30 s: 120 m. */
  const ran = () => applySamples(startRun(T0, 1000, true), walk(0, 31, 0, 4, () => 4));
  /** Parado nos 120 m com velocidade 0,1–0,3 de 31 a 60 s. */
  const stillSpeeds = [0.1, 0.2, 0.3];
  const paused = () => applySamples(ran(), walk(31, 30, 120, 0, (i) => stillSpeeds[i % 3]));

  it('andando devagar com a posição quase parada (velocidade 1,0), não pausa', () => {
    // 0,5 m por amostra: pela regra do raio (6 m em 8 s), pausaria.
    const state = applySamples(startRun(T0, 1000, true), walk(0, 61, 0, 0.5, () => 1));
    expect(state.autoPaused).toBe(false);
    expect(isAutoPaused(state, T0 + 60_000)).toBe(false);
    expect(elapsedMs(state, T0 + 60_000)).toBe(60_000);
  });

  it('parado com velocidade 0,1–0,3, pausa 8 s depois da última amostra em movimento', () => {
    expect(applySamples(ran(), walk(31, 8, 120, 0, (i) => stillSpeeds[i % 3])).autoPaused).toBe(false);
    expect(paused()).toMatchObject({ autoPaused: true, movingMs: 38_000, resumedAt: null });
  });

  it('parado com a posição pulando 7 m, mas velocidade baixa, pausa mesmo assim', () => {
    const state = applySamples(ran(), walk(31, 9, 120, 0, () => 0.2).map((s, i) => (i % 2 ? s : at(127, 31 + i, 0.2))));
    expect(state).toMatchObject({ autoPaused: true, movingMs: 38_000 });
  });

  it('retoma com duas amostras seguidas acima de 0,5 m/s, mesmo sem sair do lugar', () => {
    const pending = applySamples(paused(), [at(120, 61, 0.8)]);
    expect(pending).toMatchObject({ autoPaused: true, resumePending: true });
    const resumed = applySamples(pending, [at(120.5, 62, 0.8)]);
    expect(resumed).toMatchObject({ autoPaused: false, resumePending: false, resumedAt: T0 + 62_000, movingMs: 38_000 });
  });

  it('uma amostra rápida isolada não retoma', () => {
    const state = applySamples(paused(), [at(120, 61, 3), ...walk(62, 20, 120, 0, () => 0.1)]);
    expect(state).toMatchObject({ autoPaused: true, resumePending: false, movingMs: 38_000 });
  });

  describe('limite de 0,5 m/s', () => {
    it('é exatamente o valor da constante', () => {
      expect(MOVING_SPEED_MPS).toBe(0.5);
    });

    it('0,5 conta como movimento e 0,49 não', () => {
      const start = startRun(T0, 1000, true);
      expect(applySamples(start, [at(0, 0, 1), at(0, 9, 0.5)])).toMatchObject({ autoPaused: false, lastMoveAt: T0 + 9000 });
      expect(applySamples(start, [at(0, 0, 1), at(0, 9, 0.49)])).toMatchObject({ autoPaused: true, movingMs: 8000 });
    });

    it('retoma com duas amostras a 0,5, não com duas a 0,49', () => {
      expect(applySamples(paused(), [at(120, 61, 0.5), at(120, 62, 0.5)]).autoPaused).toBe(false);
      expect(applySamples(paused(), [at(120, 61, 0.49), at(120, 62, 0.49)])).toMatchObject({
        autoPaused: true,
        resumePending: false,
      });
    });
  });

  describe('sem velocidade utilizável, vale o raio', () => {
    it.each([
      ['negativa', -1],
      ['NaN', Number.NaN],
      ['infinita', Number.POSITIVE_INFINITY],
      ['null', null],
      ['ausente', undefined],
    ])('velocidade %s: correndo a 4 m/s não pausa', (_name, speed) => {
      const state = applySamples(startRun(T0, 1000, true), walk(0, 61, 0, 4, () => speed));
      expect(state.autoPaused).toBe(false);
      expect(elapsedMs(state, T0 + 60_000)).toBe(60_000);
    });

    it.each([
      ['negativa', -1],
      ['NaN', Number.NaN],
      ['infinita', Number.POSITIVE_INFINITY],
      ['null', null],
    ])('velocidade %s: parado pausa e só retoma a 10 m de onde parou', (_name, speed) => {
      const stopped = applySamples(startRun(T0, 1000, true), walk(0, 10, 0, 0, () => speed));
      expect(stopped).toMatchObject({ autoPaused: true, movingMs: 8000 });
      expect(applySamples(stopped, [at(2, 10, speed), at(2, 11, speed)]).autoPaused).toBe(true);
      expect(applySamples(stopped, [at(11, 10, speed), at(13, 11, speed)])).toMatchObject({
        autoPaused: false,
        resumedAt: T0 + 11_000,
      });
    });
  });

  describe('amostras mistas (com e sem velocidade)', () => {
    it('cada amostra usa a sua regra para contar movimento', () => {
      const state = applySamples(ran(), [
        ...walk(31, 6, 120, 0, () => 0.1), // 31–36 s: parado pela velocidade
        at(128, 37, null), // sem velocidade, 8 m do centro: movimento pelo raio
        ...walk(38, 9, 128, 0, () => 0.1), // 38–46 s: parado
      ]);
      expect(state).toMatchObject({ autoPaused: true, movingMs: 45_000 });
    });

    it('a confirmação da retomada mistura as duas regras', () => {
      // Rápida (pede confirmação) e depois sem velocidade a 2 m: perto, zera.
      let state = applySamples(paused(), [at(120, 61, 0.8), at(122, 62, null)]);
      expect(state).toMatchObject({ autoPaused: true, resumePending: false });
      // Sem velocidade a 11 m (pede) e depois rápida no mesmo lugar: retoma.
      state = applySamples(state, [at(131, 63, null), at(131, 64, 0.8)]);
      expect(state).toMatchObject({ autoPaused: false, resumedAt: T0 + 64_000 });
    });
  });

  it('corrida antiga sem centro do raio pausa sem mexer na distância', () => {
    const { anchor: _a, ...old } = ran();
    const restored = parseRunState(JSON.parse(JSON.stringify(old)))!;
    expect(restored.anchor).toBeNull();
    const state = applySamples(restored, walk(31, 9, 120, 0, () => 0.1));
    expect(state).toMatchObject({ autoPaused: true, movingMs: 38_000 });
    expect(state.distanceMeters).toBe(restored.distanceMeters);
  });

  it('regressão da rua: andar com a posição suavizada, parar e voltar devagar retoma', () => {
    // Padrão do teste real no Android: andando a ~1,5 m/s, a posição suavizada avança só ~1 m/s;
    // parado, velocidade 0,1–0,2 e a posição treme poucos decímetros; voltando a ~0,8 m/s, a
    // posição quase não sai do lugar (0,3 m/s).
    const samples = [
      ...walk(0, 41, 0, 1, (i) => 1.4 + (i % 3) * 0.1), // 0–40 s
      ...Array.from({ length: 20 }, (_, i) => at(40 + (i % 2) * 0.3, 41 + i, 0.1 + (i % 2) * 0.1)), // 41–60 s
      ...walk(61, 30, 40.5, 0.3, (i) => 0.75 + (i % 2) * 0.1), // 61–90 s
    ];
    const state = applySamples(startRun(T0, 1000, true), samples);
    expect(state).toMatchObject({ autoPaused: false, resumedAt: T0 + 62_000 });
    expect(isAutoPaused(state, T0 + 90_000)).toBe(false);
    expect(elapsedMs(state, T0 + 90_000)).toBe(48_000 + 28_000);

    // Pela regra antiga (só o raio), a mesma sequência ficaria presa em pausa.
    const withoutSpeed = applySamples(startRun(T0, 1000, true), samples.map((s) => ({ ...s, speed: null })));
    expect(withoutSpeed.autoPaused).toBe(true);
  });
});

describe('trajeto', () => {
  /** Ponto [lat, lon] do trajeto a `meters` ao norte do início. */
  const pt = (meters: number): [number, number] => [north(meters, 0).latitude, north(meters, 0).longitude];
  const seg = (...meters: number[]) => meters.map(pt);
  const withRoute = (autoPause = false) => startRun(T0, 1000, autoPause, true);

  it('só guarda o trajeto quando pedido', () => {
    expect(startRun(T0).route).toBeNull();
    expect(startRun(T0, 1000, true).route).toBeNull();
    expect(withRoute().route).toEqual([]);
  });

  it('com o trajeto desligado, não grava pontos', () => {
    expect(applySamples(startRun(T0), straight(0, 30, 4)).route).toBeNull();
  });

  it('guarda um ponto a cada 10 m ou mais do último guardado', () => {
    // 4 m/s: 0, 4, 8, 12… só 0, 12, 24 e 36 ficam a 10 m ou mais do anterior.
    expect(applySamples(withRoute(), straight(0, 10, 4)).route).toEqual([seg(0, 12, 24, 36)]);
  });

  it('não guarda amostras imprecisas, saltos impossíveis nem a tremida', () => {
    const state = applySamples(withRoute(), [
      north(0, 0),
      north(20, 3, 80), // imprecisa
      north(500, 4), // salto de 500 m em 4 s
      north(2, 5), // tremida
      north(12, 6),
    ]);
    expect(state.route).toEqual([seg(0, 12)]);
  });

  it('retomar a pausa manual abre um segmento novo, sem ligar os dois trechos', () => {
    let state = applySamples(withRoute(), straight(0, 10, 4));
    state = resumeRun(pauseRun(state, T0 + 10_000), T0 + 100_000);
    state = applySamples(state, straight(100, 105, 4, 300));
    expect(state.route).toEqual([seg(0, 12, 24, 36), seg(300, 312)]);
  });

  it('retomar da pausa automática abre um segmento novo na amostra que confirmou', () => {
    // Corre 120 m, para tremendo até pausar, sai a 131 m e confirma a 135 m.
    let state = applySamples(withRoute(true), straight(0, 30, 4));
    state = applySamples(
      state,
      Array.from({ length: 30 }, (_, i) => north(120 + (i % 2 === 0 ? 2 : -2), 31 + i)),
    );
    expect(state.autoPaused).toBe(true);
    state = applySamples(state, [north(131, 61), north(135, 62), ...straight(63, 72, 4, 139)]);
    expect(state.route).toEqual([seg(0, 12, 24, 36, 48, 60, 72, 84, 96, 108, 120), seg(135, 147, 159, 171)]);
  });

  it('para de guardar ao chegar no limite de pontos', () => {
    const almostFull = { ...withRoute(), route: [Array.from({ length: ROUTE_MAX_POINTS - 1 }, () => pt(0))] };
    const state = applySamples(almostFull, straight(0, 30, 4));
    // O primeiro ponto (segmento novo) completa o limite; os seguintes ficam de fora.
    expect(state.route).toEqual([...almostFull.route, seg(0)]);
    expect(state.distanceMeters).toBeCloseTo(120, 0);
  });

  describe('parseRunState', () => {
    const running = applySamples(withRoute(), straight(0, 10, 4));

    it('aceita um trajeto salvo em JSON', () => {
      expect(parseRunState(JSON.parse(JSON.stringify(running)))).toEqual(running);
    });

    it('uma corrida salva antes do trajeto fica sem trajeto', () => {
      const { route: _r, ...old } = running;
      expect(parseRunState(JSON.parse(JSON.stringify(old)))).toEqual({ ...old, route: null });
    });

    it.each([
      ['trajeto como texto', 'rota'],
      ['segmento vazio', [[]]],
      ['latitude fora do limite', [[[91, -46.6]]]],
      ['ponto sem longitude', [[[-23.5]]]],
    ])('rejeita %s', (_name, route) => {
      expect(parseRunState({ ...running, route })).toBeNull();
    });
  });
});
