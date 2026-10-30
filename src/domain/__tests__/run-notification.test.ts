import { notificationKey, runNotificationProps, runSummaryProps } from '../run-notification';
import { type RunSample, applySamples, finishRun, pauseRun, startRun } from '../run-tracker';

const T0 = Date.UTC(2026, 10, 4, 9);
// ~1 m de latitude em graus.
const METER = 1 / 111_195;
const MILE = 1609.344;

/** Amostra a `meters` ao norte do ponto inicial, `seconds` depois de T0. */
const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});

/** Linha reta a `speed` m/s de 0 a `toS` s; uma amostra por segundo. */
const straight = (toS: number, speed: number) =>
  Array.from({ length: toS + 1 }, (_, i) => north(i * speed, i));

/** Corrida em andamento: `toS` segundos a `speed` m/s, com parciais de `splitMeters`. */
const run = (toS: number, speed = 4, splitMeters = 1000, autoPause = false) =>
  applySamples(startRun(T0, splitMeters, autoPause), straight(toS, speed));

describe('runNotificationProps', () => {
  it('mostra tempo, distância, unidade e pace da corrida em andamento', () => {
    // 30 s a 4 m/s: 120 m, pace de 4:10/km.
    expect(runNotificationProps(run(30), T0 + 30_000)).toEqual({
      status: 'running',
      time: '0:30',
      distance: '0,12',
      unit: 'km',
      pace: '4:10',
      lastSplit: null,
      splitProgress: expect.closeTo(0.12, 4),
    });
  });

  it('não mostra pace na corrida pausada e congela o tempo', () => {
    const paused = pauseRun(run(30), T0 + 30_000);
    expect(runNotificationProps(paused, T0 + 120_000)).toMatchObject({
      status: 'paused',
      time: '0:30',
      pace: null,
    });
  });

  it('mostra a pausa automática já pelo relógio, sem pace e com o tempo parado', () => {
    // Última amostra em movimento em 30 s; 8 s depois a pausa automática vale.
    const state = run(30, 4, 1000, true);
    expect(runNotificationProps(state, T0 + 37_000)).toMatchObject({ status: 'running', time: '0:37' });
    expect(runNotificationProps(state, T0 + 60_000)).toMatchObject({
      status: 'autoPaused',
      time: '0:38',
      pace: null,
    });
  });

  it('não mostra pace sem deslocamento suficiente', () => {
    expect(runNotificationProps(startRun(T0), T0 + 5000)).toMatchObject({ distance: '0,00', pace: null });
  });

  it('usa milhas e pace por milha quando as parciais são em milhas', () => {
    // 1200 m = 0,75 mi; 4:10/km = 6:42/mi.
    expect(runNotificationProps(run(300, 4, MILE), T0 + 300_000)).toMatchObject({
      distance: '0,75',
      unit: 'mi',
      pace: '6:42',
    });
  });

  it('mostra a última parcial fechada e o progresso da parcial em andamento', () => {
    // 1200 m: fechou o km 1 em 250 s e está a 200 m do km 2.
    expect(runNotificationProps(run(300), T0 + 300_000)).toMatchObject({
      distance: '1,20',
      lastSplit: 'Parcial 1: 4:10',
      splitProgress: expect.closeTo(0.2, 4),
    });
  });

  it('numera a parcial pela quantidade já fechada', () => {
    const state = run(600);
    expect(state.splits).toHaveLength(2);
    expect(runNotificationProps(state, T0 + 600_000).lastSplit).toBe('Parcial 2: 4:10');
  });
});

describe('runSummaryProps', () => {
  it('resume distância, tempo e pace médio da corrida finalizada', () => {
    expect(runSummaryProps(finishRun(run(300), T0 + 300_000))).toEqual({
      distance: '1,20',
      unit: 'km',
      time: '5:00',
      pace: '4:10',
    });
  });

  it('dá o pace médio por milha com parciais em milhas', () => {
    expect(runSummaryProps(finishRun(run(300, 4, MILE), T0 + 300_000))).toEqual({
      distance: '0,75',
      unit: 'mi',
      time: '5:00',
      pace: '6:42',
    });
  });

  it('não dá pace numa corrida de menos de 10 m', () => {
    const short = applySamples(startRun(T0), [north(0, 0), north(5, 4)]);
    expect(short.distanceMeters).toBeCloseTo(5, 0);
    expect(runSummaryProps(finishRun(short, T0 + 4000))).toMatchObject({ time: '0:04', pace: null });
  });

  it('não dá pace numa corrida de 0 s', () => {
    expect(runSummaryProps(finishRun(run(30), T0))).toEqual({
      distance: '0,12',
      unit: 'km',
      time: '0:00',
      pace: null,
    });
  });
});

describe('notificationKey', () => {
  // Progresso no meio de um bloco da barra, para ver o que muda a chave e o que não muda.
  const props = { ...runNotificationProps(run(300), T0 + 300_000), splitProgress: 0.25 };

  it('não muda sem mudança visível na notificação', () => {
    expect(notificationKey({ ...props, splitProgress: 0.255 })).toBe(notificationKey(props));
  });

  it.each([
    ['status', { status: 'paused' as const }],
    ['tempo', { time: '5:01' }],
    ['distância', { distance: '1,21' }],
    ['unidade', { unit: 'mi' as const }],
    ['pace', { pace: '4:11' }],
    ['parcial', { lastSplit: 'Parcial 2: 4:10' }],
    ['bloco a mais na barra', { splitProgress: 0.35 }],
  ])('muda quando muda %s', (_label, change) => {
    expect(notificationKey({ ...props, ...change })).not.toBe(notificationKey(props));
  });
});
