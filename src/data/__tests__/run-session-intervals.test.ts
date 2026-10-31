import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import { DEFAULT_INTERVAL_PLAN, type IntervalPlan } from '../../domain/interval-plan';
import { startRun } from '../../domain/run-tracker';
import { DEFAULT_VOICE_PREFERENCES } from '../../domain/run-voice';
import {
  RUN_TASK,
  discardRunSession,
  intervalPlanRepository,
  pauseRunSession,
  runRepository,
  skipPhaseSession,
  startRunSession,
} from '../run-session';
import { syncRunNotification } from '../run-notification';
import { voicePreferences } from '../run-voice';
import { storage } from '../storage/mmkv';

jest.mock('expo-speech');
jest.mock('../run-notification', () => ({ syncRunNotification: jest.fn(() => Promise.resolve()) }));

// O mock do expo-task-manager (jest.setup.ts) executa a tarefa definida no import de run-session.
const { __runTask: runTask } = jest.requireMock<{ __runTask: (name: string, body: unknown) => Promise<void> }>(
  'expo-task-manager',
);
const location = jest.mocked(Location);
const speak = jest.mocked(Speech.speak);
const sync = jest.mocked(syncRunNotification);

const T0 = new Date(2026, 10, 4, 10).getTime();
const METER = 1 / 111_195;
const PLAN_KEY = 'run-interval-plan:v1';

const PLAN: IntervalPlan = {
  warmup: null,
  reps: 2,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'time', seconds: 60 },
  cooldown: null,
  targetSecondsPerKm: null,
};

/** LocationObject a `meters` ao norte, `seconds` depois de T0. */
const fix = (meters: number, seconds: number): Location.LocationObject => ({
  coords: {
    latitude: -23.5 + meters * METER,
    longitude: -46.6,
    altitude: null,
    accuracy: 5,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: T0 + seconds * 1000,
});
/** Uma localização por segundo a `speed` m/s, de `fromS` a `toS`, a partir de `startMeters`. */
const run = (fromS: number, toS: number, speed = 4, startMeters = 0) =>
  Array.from({ length: toS - fromS + 1 }, (_, i) => fix(startMeters + i * speed, fromS + i));
const deliver = (locations: Location.LocationObject[]) => runTask(RUN_TASK, { data: { locations }, error: null });

beforeEach(async () => {
  await discardRunSession();
  storage.remove(PLAN_KEY);
  voicePreferences.update(DEFAULT_VOICE_PREFERENCES);
  jest.clearAllMocks();
});

afterAll(() => storage.remove(PLAN_KEY));

describe('startRunSession com plano', () => {
  it('começa o intervalado sem pausa automática, guarda o plano e fala a primeira fase', async () => {
    await expect(startRunSession(1000, true, false, () => T0, PLAN)).resolves.toBe('started');

    expect(runRepository.get()).toEqual(startRun(T0, 1000, false, false, PLAN));
    expect(intervalPlanRepository.get()).toEqual(PLAN);
    expect(JSON.parse(storage.getString(PLAN_KEY) ?? 'null')).toEqual(PLAN);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith('Tiro 1 de 2: 400 metros.', { language: 'pt-BR' });
    expect(sync).toHaveBeenCalledWith(runRepository.get(), T0);
  });

  it('corrida livre não mexe no plano guardado nem fala ao começar', async () => {
    intervalPlanRepository.set(PLAN);
    await startRunSession(1000, true, false, () => T0);
    expect(runRepository.get()?.intervals).toBeNull();
    expect(intervalPlanRepository.get()).toEqual(PLAN);
    expect(speak).not.toHaveBeenCalled();
  });

  it('com a permissão negada, não guarda o plano nem fala', async () => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce({
      granted: false,
      canAskAgain: true,
      expires: 'never',
      status: 'denied' as Location.PermissionStatus,
    });
    await expect(startRunSession(1000, false, false, () => T0, PLAN)).resolves.toBe('denied');
    expect(storage.getString(PLAN_KEY)).toBeUndefined();
    expect(intervalPlanRepository.get()).toEqual(DEFAULT_INTERVAL_PLAN);
    expect(speak).not.toHaveBeenCalled();
  });

  it('com a voz desligada, começa calado', async () => {
    voicePreferences.update({ enabled: false });
    await startRunSession(1000, false, false, () => T0, PLAN);
    expect(runRepository.get()?.intervals?.plan).toEqual(PLAN);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('tarefa de localização no intervalado', () => {
  it('anuncia o fim do tiro e a fase seguinte, uma vez', async () => {
    await startRunSession(1000, false, false, () => T0, PLAN);
    speak.mockClear();

    await deliver(run(0, 99));
    expect(speak).not.toHaveBeenCalled();

    await deliver(run(100, 101, 4, 400));
    expect(runRepository.get()?.intervals?.index).toBe(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(
      'Tiro 1: 1 minuto e 40 segundos, pace 4 minutos e 10 segundos por quilômetro. Recuperação: 1 minuto.',
      { language: 'pt-BR' },
    );

    await deliver(run(102, 110, 4, 408));
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('não fala a parcial de quilômetro no intervalado', async () => {
    await startRunSession(1000, false, false, () => T0, { ...PLAN, work: { kind: 'distance', meters: 2000 } });
    speak.mockClear();
    await deliver(run(0, 300));
    expect(runRepository.get()?.splits).toHaveLength(1);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('skipPhaseSession', () => {
  it('encerra a fase, anuncia a próxima e atualiza a notificação', async () => {
    await startRunSession(1000, false, false, () => T0, PLAN);
    await deliver(run(0, 20));
    speak.mockClear();
    sync.mockClear();

    skipPhaseSession(T0 + 20_000);

    const state = runRepository.get();
    expect(state?.intervals).toMatchObject({
      index: 1,
      results: [{ kind: 'work', rep: 1, ms: 20_000, meters: expect.closeTo(80, 0), skipped: true }],
    });
    expect(speak).toHaveBeenCalledWith('Recuperação: 1 minuto.', { language: 'pt-BR' });
    expect(sync).toHaveBeenCalledWith(state, T0 + 20_000);
  });

  it('pular com a corrida pausada encerra a fase no tempo congelado', async () => {
    await startRunSession(1000, false, false, () => T0, PLAN);
    pauseRunSession(T0 + 30_000);
    skipPhaseSession(T0 + 40_000);
    expect(runRepository.get()?.intervals).toMatchObject({
      index: 1,
      phaseStart: { movingMs: 30_000, distanceMeters: 0 },
      results: [{ kind: 'work', rep: 1, ms: 30_000, meters: 0, skipped: true }],
    });
  });

  it('sem corrida, não cria nada', () => {
    skipPhaseSession(T0);
    expect(runRepository.get()).toBeNull();
    expect(speak).not.toHaveBeenCalled();
  });
});
