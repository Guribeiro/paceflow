import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import { applySamples, pauseRun, startRun } from '../../domain/run-tracker';
import { DEFAULT_VOICE_PREFERENCES } from '../../domain/run-voice';
import {
  RUN_TASK,
  discardRunSession,
  ensureRunUpdates,
  finishRunSession,
  pauseRunSession,
  resumeRunSession,
  runRepository,
  startRunSession,
} from '../run-session';
import { voicePreferences } from '../run-voice';

jest.mock('expo-speech');

// O mock do expo-task-manager (jest.setup.ts) executa a tarefa definida no import de run-session.
const { __runTask: runTask } = jest.requireMock<{ __runTask: (name: string, body: unknown) => Promise<void> }>(
  'expo-task-manager',
);
const location = jest.mocked(Location);

const T0 = new Date(2026, 10, 4, 10).getTime();
const METER = 1 / 111_195;

const permission = (granted: boolean, canAskAgain: boolean): Location.LocationPermissionResponse => ({
  granted,
  canAskAgain,
  expires: 'never',
  status: (granted ? 'granted' : 'denied') as Location.PermissionStatus,
});

/** LocationObject a `meters` ao norte, `seconds` depois de T0. */
const fix = (meters: number, seconds: number, accuracy: number | null = 5): Location.LocationObject => ({
  coords: {
    latitude: -23.5 + meters * METER,
    longitude: -46.6,
    altitude: null,
    accuracy,
    altitudeAccuracy: null,
    heading: null,
    speed: null,
  },
  timestamp: T0 + seconds * 1000,
});

const serviceStarted = () => Location.hasStartedLocationUpdatesAsync(RUN_TASK);

beforeEach(async () => {
  await discardRunSession();
  voicePreferences.update(DEFAULT_VOICE_PREFERENCES);
  jest.clearAllMocks();
});

describe('startRunSession', () => {
  it('começa a corrida e o serviço de localização em primeiro plano', async () => {
    await expect(startRunSession(1000, () => T0)).resolves.toBe('started');

    expect(runRepository.get()).toEqual(startRun(T0, 1000));
    expect(location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      RUN_TASK,
      expect.objectContaining({
        accuracy: Location.Accuracy.BestForNavigation,
        foregroundService: expect.objectContaining({ notificationTitle: 'PaceFlow gravando corrida' }),
      }),
    );
    await expect(serviceStarted()).resolves.toBe(true);
  });

  it('grava as parciais em milhas quando pedido', async () => {
    await startRunSession(1609.344, () => T0);
    expect(runRepository.get()?.splitMeters).toBe(1609.344);
  });

  it.each([
    ['denied', true],
    ['blocked', false],
  ])('devolve %s quando a permissão é negada', async (expected, canAskAgain) => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce(permission(false, canAskAgain));
    await expect(startRunSession(1000, () => T0)).resolves.toBe(expected);
    expect(runRepository.get()).toBeNull();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('devolve gps-off com o GPS desligado', async () => {
    location.hasServicesEnabledAsync.mockResolvedValueOnce(false);
    await expect(startRunSession(1000, () => T0)).resolves.toBe('gps-off');
    expect(runRepository.get()).toBeNull();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('limpa a corrida e relança se o serviço não iniciar', async () => {
    location.startLocationUpdatesAsync.mockRejectedValueOnce(new Error('serviço negado'));
    await expect(startRunSession(1000, () => T0)).rejects.toThrow('serviço negado');
    expect(runRepository.get()).toBeNull();
  });
});

describe('tarefa de localização', () => {
  it('converte as localizações e soma na corrida em andamento', async () => {
    await startRunSession(1000, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(30, 10), fix(60, 20, null)] }, error: null });
    const state = runRepository.get();
    expect(state?.distanceMeters).toBeCloseTo(60, 0);
    expect(state?.lastPoint?.movingMs).toBe(20_000);
  });

  it('ignora localizações com a corrida pausada', async () => {
    await startRunSession(1000, () => T0);
    pauseRunSession(T0 + 5000);
    const paused = runRepository.get();
    const listener = jest.fn();
    const unsubscribe = runRepository.subscribe(listener);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 6), fix(30, 16)] }, error: null });
    unsubscribe();
    expect(runRepository.get()).toBe(paused);
    expect(listener).not.toHaveBeenCalled(); // nem regrava o estado
  });

  it('ignora erros e entregas sem corrida', async () => {
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(30, 10)] }, error: null });
    expect(runRepository.get()).toBeNull();

    await startRunSession(1000, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(30, 10)] }, error: { code: 1, message: 'x' } });
    await runTask(RUN_TASK, { data: undefined, error: null });
    expect(runRepository.get()).toEqual(startRun(T0, 1000));
  });
});

describe('aviso falado na tarefa de localização', () => {
  const speak = jest.mocked(Speech.speak);

  it('fala quando as amostras fecham um quilômetro, e só nesse lote', async () => {
    await startRunSession(1000, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(600, 180)] }, error: null });
    expect(speak).not.toHaveBeenCalled();

    await runTask(RUN_TASK, { data: { locations: [fix(1200, 360)] }, error: null });
    expect(runRepository.get()?.splits).toHaveLength(1);
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith(
      'Quilômetro 1. Parcial: 5 minutos. Pace médio: 5 minutos por quilômetro.',
      { language: 'pt-BR' },
    );

    await runTask(RUN_TASK, { data: { locations: [fix(1500, 450)] }, error: null });
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('não fala com a voz desligada', async () => {
    voicePreferences.update({ enabled: false });
    await startRunSession(1000, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(1200, 360)] }, error: null });
    expect(runRepository.get()?.splits).toHaveLength(1);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('pausar, retomar, finalizar e descartar', () => {
  it('pausa e retoma com o instante informado', async () => {
    await startRunSession(1000, () => T0);
    pauseRunSession(T0 + 30_000);
    expect(runRepository.get()).toMatchObject({ status: 'paused', movingMs: 30_000, resumedAt: null });
    resumeRunSession(T0 + 90_000);
    expect(runRepository.get()).toMatchObject({ status: 'running', movingMs: 30_000, resumedAt: T0 + 90_000 });
  });

  it('pausar ou retomar sem corrida não cria nada', () => {
    pauseRunSession(T0);
    resumeRunSession(T0);
    expect(runRepository.get()).toBeNull();
  });

  it('finalizar congela a corrida e desliga o GPS', async () => {
    await startRunSession(1000, () => T0);
    await finishRunSession(T0 + 60_000);
    expect(runRepository.get()).toMatchObject({ status: 'finished', movingMs: 60_000 });
    expect(location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_TASK);
    await expect(serviceStarted()).resolves.toBe(false);
  });

  it('descartar apaga a corrida e desliga o GPS', async () => {
    await startRunSession(1000, () => T0);
    await discardRunSession();
    expect(runRepository.get()).toBeNull();
    await expect(serviceStarted()).resolves.toBe(false);
  });
});

describe('ensureRunUpdates', () => {
  it('religa o GPS de uma corrida em andamento cujo serviço parou', async () => {
    runRepository.set(applySamples(startRun(T0), []));
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).toHaveBeenCalledWith(RUN_TASK, expect.any(Object));
  });

  it('religa também uma corrida pausada', async () => {
    runRepository.set(pauseRun(startRun(T0), T0 + 1000));
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).toHaveBeenCalledTimes(1);
  });

  it('não religa se o serviço já está ativo', async () => {
    await startRunSession(1000, () => T0);
    location.startLocationUpdatesAsync.mockClear();
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('não religa sem corrida nem com a corrida finalizada', async () => {
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();

    await startRunSession(1000, () => T0);
    await finishRunSession(T0 + 1000);
    location.startLocationUpdatesAsync.mockClear();
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
