import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import { applySamples, pauseRun, startRun } from '../../domain/run-tracker';
import { DEFAULT_VOICE_PREFERENCES } from '../../domain/run-voice';
import {
  RUN_TASK,
  discardRunSession,
  ensureRunUpdates,
  finishRunSession,
  autoPausePreference,
  pauseRunSession,
  resumeRunSession,
  runRepository,
  startRunSession,
} from '../run-session';
import { storage } from '../storage/mmkv';
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
const fix = (
  meters: number,
  seconds: number,
  accuracy: number | null = 5,
  speed: number | null = null,
): Location.LocationObject => ({
  coords: {
    latitude: -23.5 + meters * METER,
    longitude: -46.6,
    altitude: null,
    accuracy,
    altitudeAccuracy: null,
    heading: null,
    speed,
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
    await expect(startRunSession(1000, false, false, () => T0)).resolves.toBe('started');

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

  it('grava a pausa automática pedida e pede uma amostra por segundo mesmo parado', async () => {
    await startRunSession(1000, true, false, () => T0);
    expect(runRepository.get()).toEqual(startRun(T0, 1000, true));
    expect(location.startLocationUpdatesAsync).toHaveBeenCalledWith(
      RUN_TASK,
      expect.objectContaining({ timeInterval: 1000, distanceInterval: 0 }),
    );
  });

  it('grava as parciais em milhas quando pedido', async () => {
    await startRunSession(1609.344, false, false, () => T0);
    expect(runRepository.get()?.splitMeters).toBe(1609.344);
  });

  it.each([
    ['denied', true],
    ['blocked', false],
  ])('devolve %s quando a permissão é negada', async (expected, canAskAgain) => {
    location.requestForegroundPermissionsAsync.mockResolvedValueOnce(permission(false, canAskAgain));
    await expect(startRunSession(1000, false, false, () => T0)).resolves.toBe(expected);
    expect(runRepository.get()).toBeNull();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('devolve gps-off com o GPS desligado', async () => {
    location.hasServicesEnabledAsync.mockResolvedValueOnce(false);
    await expect(startRunSession(1000, false, false, () => T0)).resolves.toBe('gps-off');
    expect(runRepository.get()).toBeNull();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('limpa a corrida e relança se o serviço não iniciar', async () => {
    location.startLocationUpdatesAsync.mockRejectedValueOnce(new Error('serviço negado'));
    await expect(startRunSession(1000, false, false, () => T0)).rejects.toThrow('serviço negado');
    expect(runRepository.get()).toBeNull();
  });
});

describe('tarefa de localização', () => {
  it('converte as localizações e soma na corrida em andamento', async () => {
    await startRunSession(1000, false, false, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(30, 10), fix(60, 20, null)] }, error: null });
    const state = runRepository.get();
    expect(state?.distanceMeters).toBeCloseTo(60, 0);
    expect(state?.lastPoint?.movingMs).toBe(20_000);
  });

  it('ignora localizações com a corrida pausada', async () => {
    await startRunSession(1000, false, false, () => T0);
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

    await startRunSession(1000, false, false, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(30, 10)] }, error: { code: 1, message: 'x' } });
    await runTask(RUN_TASK, { data: undefined, error: null });
    expect(runRepository.get()).toEqual(startRun(T0, 1000));
  });
});

describe('aviso falado na tarefa de localização', () => {
  const speak = jest.mocked(Speech.speak);

  it('fala quando as amostras fecham um quilômetro, e só nesse lote', async () => {
    await startRunSession(1000, false, false, () => T0);
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
    await startRunSession(1000, false, false, () => T0);
    await runTask(RUN_TASK, { data: { locations: [fix(0, 0), fix(1200, 360)] }, error: null });
    expect(runRepository.get()?.splits).toHaveLength(1);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('autoPausePreference', () => {
  afterEach(() => storage.remove('run-auto-pause:v1'));

  it('vem ligada por padrão e fica guardada no aparelho', () => {
    storage.remove('run-auto-pause:v1');
    expect(autoPausePreference.get()).toBe(true);
    autoPausePreference.set(false);
    expect(storage.getString('run-auto-pause:v1')).toBe('false');
  });
});

describe('pausa automática na tarefa de localização', () => {
  const speak = jest.mocked(Speech.speak);
  /** Uma localização por segundo: correndo a 4 m/s de `fromS` a `toS`, a partir de `startMeters`. */
  const run = (fromS: number, toS: number, startMeters = 0) =>
    Array.from({ length: toS - fromS + 1 }, (_, i) => fix(startMeters + i * 4, fromS + i));
  /** Parado nos `at` m, com a tremida do GPS de ±2 m. */
  const still = (at: number, fromS: number, toS: number) =>
    Array.from({ length: toS - fromS + 1 }, (_, i) => fix(at + (i % 2 === 0 ? 2 : -2), fromS + i));
  const deliver = (locations: Location.LocationObject[]) => runTask(RUN_TASK, { data: { locations }, error: null });

  it('fala "Pausa automática." ao parar e "Retomando." ao voltar, uma vez cada', async () => {
    await startRunSession(1000, true, false, () => T0);
    await deliver(run(0, 30));
    await deliver(still(120, 31, 36));
    expect(speak).not.toHaveBeenCalled();

    await deliver(still(120, 37, 45));
    expect(runRepository.get()).toMatchObject({ autoPaused: true, movingMs: 38_000 });
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenLastCalledWith('Pausa automática.', { language: 'pt-BR' });

    await deliver(still(120, 46, 60));
    expect(speak).toHaveBeenCalledTimes(1);

    // Uma amostra longe só pede confirmação: ainda não fala.
    await deliver(run(61, 61, 131));
    expect(runRepository.get()).toMatchObject({ autoPaused: true, resumePending: true });
    expect(speak).toHaveBeenCalledTimes(1);

    await deliver(run(62, 63, 135));
    expect(runRepository.get()).toMatchObject({ autoPaused: false, resumedAt: T0 + 62_000 });
    expect(speak).toHaveBeenCalledTimes(2);
    expect(speak).toHaveBeenLastCalledWith('Retomando.', { language: 'pt-BR' });

    await deliver(run(64, 70, 143));
    expect(speak).toHaveBeenCalledTimes(2);
  });

  it('não pausa nem fala com a pausa automática desligada', async () => {
    await startRunSession(1000, false, false, () => T0);
    await deliver([...run(0, 30), ...still(120, 31, 60)]);
    expect(runRepository.get()?.autoPaused).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });

  it('salto único do GPS parado não fala "Retomando."', async () => {
    await startRunSession(1000, true, false, () => T0);
    await deliver([...run(0, 30), ...still(120, 31, 45)]);
    expect(speak).toHaveBeenCalledTimes(1);
    await deliver([fix(620, 46), ...still(120, 47, 60)]);
    expect(runRepository.get()?.autoPaused).toBe(true);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it('repassa a velocidade do GPS: parado pela velocidade e retomando sem sair do lugar', async () => {
    await startRunSession(1000, true, false, () => T0);
    await deliver(Array.from({ length: 31 }, (_, i) => fix(i * 4, i, 5, 4)));
    await deliver(Array.from({ length: 10 }, (_, i) => fix(120, 31 + i, 5, 0.1)));
    expect(runRepository.get()).toMatchObject({ autoPaused: true, movingMs: 38_000 });

    await deliver([fix(120, 41, 5, 1.2), fix(120, 42, 5, 1.2)]);
    expect(runRepository.get()).toMatchObject({ autoPaused: false, resumedAt: T0 + 42_000 });
    expect(speak).toHaveBeenLastCalledWith('Retomando.', { language: 'pt-BR' });
  });

  it('pausa calada com a voz desligada', async () => {
    voicePreferences.update({ enabled: false });
    await startRunSession(1000, true, false, () => T0);
    await deliver([...run(0, 30), ...still(120, 31, 60)]);
    expect(runRepository.get()?.autoPaused).toBe(true);
    await deliver(run(61, 63, 131));
    expect(runRepository.get()?.autoPaused).toBe(false);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe('pausar, retomar, finalizar e descartar', () => {
  it('pausa e retoma com o instante informado', async () => {
    await startRunSession(1000, false, false, () => T0);
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
    await startRunSession(1000, false, false, () => T0);
    await finishRunSession(T0 + 60_000);
    expect(runRepository.get()).toMatchObject({ status: 'finished', movingMs: 60_000 });
    expect(location.stopLocationUpdatesAsync).toHaveBeenCalledWith(RUN_TASK);
    await expect(serviceStarted()).resolves.toBe(false);
  });

  it('descartar apaga a corrida e desliga o GPS', async () => {
    await startRunSession(1000, false, false, () => T0);
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
    await startRunSession(1000, false, false, () => T0);
    location.startLocationUpdatesAsync.mockClear();
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });

  it('não religa sem corrida nem com a corrida finalizada', async () => {
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();

    await startRunSession(1000, false, false, () => T0);
    await finishRunSession(T0 + 1000);
    location.startLocationUpdatesAsync.mockClear();
    await ensureRunUpdates();
    expect(location.startLocationUpdatesAsync).not.toHaveBeenCalled();
  });
});
