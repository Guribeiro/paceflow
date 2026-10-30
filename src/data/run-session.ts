import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import {
  type RunSample,
  applySamples,
  finishRun,
  pauseRun,
  resumeRun,
  startRun,
} from '../domain/run-tracker';
import { createFlagRepository } from './repositories/flag-repository';
import { createRunRepository } from './repositories/run-repository';
import { announceAutoPause, announceSplit } from './run-voice';
import { storage } from './storage/mmkv';

export const runRepository = createRunRepository(storage);
/** Pausa automática nas próximas corridas (por aparelho; ligada por padrão). */
export const autoPausePreference = createFlagRepository(storage, 'run-auto-pause:v1', true);

export const RUN_TASK = 'paceflow-run';

// Precisa estar no escopo global (importado pelo layout raiz): o Android pode
// entregar localizações com o app em segundo plano ou recém-reaberto.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(RUN_TASK, async ({ data, error }) => {
  if (error || !data?.locations) return;
  const state = runRepository.get();
  if (!state || state.status !== 'running') return;
  const samples: RunSample[] = data.locations.map((l) => ({
    latitude: l.coords.latitude,
    longitude: l.coords.longitude,
    accuracy: l.coords.accuracy ?? null,
    timestamp: l.timestamp,
  }));
  const next = applySamples(state, samples);
  runRepository.set(next);
  announceAutoPause(state, next);
  announceSplit(state, next);
});

export type StartResult = 'started' | 'denied' | 'blocked' | 'gps-off';

async function startUpdates() {
  // Serviço em primeiro plano (notificação fixa): continua com a tela apagada e
  // dispensa a permissão de localização "o tempo todo".
  await Location.startLocationUpdatesAsync(RUN_TASK, {
    accuracy: Location.Accuracy.BestForNavigation,
    timeInterval: 1000,
    // Uma amostra por segundo mesmo parado: é assim que a pausa automática
    // percebe a parada. A tremida do GPS parado é filtrada no domínio.
    distanceInterval: 0,
    foregroundService: {
      notificationTitle: 'PaceFlow gravando corrida',
      notificationBody: 'Toque para ver tempo, distância e pace.',
      killServiceOnDestroy: false,
    },
  });
}

async function stopUpdates() {
  if (await Location.hasStartedLocationUpdatesAsync(RUN_TASK)) {
    await Location.stopLocationUpdatesAsync(RUN_TASK);
  }
}

/** Pede a localização "durante o uso" e começa a gravar. */
export async function startRunSession(
  splitMeters: number,
  autoPause: boolean,
  now: () => number = Date.now,
): Promise<StartResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? 'denied' : 'blocked';
  if (!(await Location.hasServicesEnabledAsync())) return 'gps-off';

  runRepository.set(startRun(now(), splitMeters, autoPause));
  try {
    await startUpdates();
  } catch (e) {
    runRepository.set(null);
    throw e;
  }
  return 'started';
}

export function pauseRunSession(now: number = Date.now()) {
  const state = runRepository.get();
  if (state) runRepository.set(pauseRun(state, now));
}

export function resumeRunSession(now: number = Date.now()) {
  const state = runRepository.get();
  if (state) runRepository.set(resumeRun(state, now));
}

export async function finishRunSession(now: number = Date.now()) {
  const state = runRepository.get();
  if (state) runRepository.set(finishRun(state, now));
  await stopUpdates();
}

/** Descarta a corrida (ou limpa depois de salvar no diário). */
export async function discardRunSession() {
  runRepository.set(null);
  await stopUpdates();
}

/**
 * Ao abrir o app com uma corrida ativa: se o sistema encerrou o serviço,
 * volta a gravar (só é permitido com o app em primeiro plano).
 */
export async function ensureRunUpdates() {
  const state = runRepository.get();
  if (!state || state.status === 'finished') return;
  if (!(await Location.hasStartedLocationUpdatesAsync(RUN_TASK))) await startUpdates();
}
