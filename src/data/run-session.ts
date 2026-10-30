import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { addUserInteractionListener } from 'expo-widgets';

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
import { syncRunNotification } from './run-notification';
import { announceAutoPause, announceSplit } from './run-voice';
import { storage } from './storage/mmkv';

export const runRepository = createRunRepository(storage);
/** Pausa automática nas próximas corridas (por aparelho; ligada por padrão). */
export const autoPausePreference = createFlagRepository(storage, 'run-auto-pause:v1', true);
/** Guardar o trajeto das próximas corridas (só no aparelho; ligado por padrão). */
export const routePreference = createFlagRepository(storage, 'run-route:v1', true);

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
    speed: l.coords.speed ?? null,
  }));
  const next = applySamples(state, samples);
  runRepository.set(next);
  announceAutoPause(state, next);
  announceSplit(state, next);
  void syncRunNotification(next);
});

// Botão Pausar/Retomar da notificação da corrida (escopo global, como a tarefa:
// precisa ouvir com o app em segundo plano).
addUserInteractionListener((event) => {
  if (event.source !== 'RunNotification') return;
  if (event.target === 'pause') pauseRunSession();
  else if (event.target === 'resume') resumeRunSession();
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
  keepRoute: boolean,
  now: () => number = Date.now,
): Promise<StartResult> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return permission.canAskAgain ? 'denied' : 'blocked';
  if (!(await Location.hasServicesEnabledAsync())) return 'gps-off';

  runRepository.set(startRun(now(), splitMeters, autoPause, keepRoute));
  try {
    await startUpdates();
  } catch (e) {
    runRepository.set(null);
    throw e;
  }
  void syncRunNotification(runRepository.get(), now());
  return 'started';
}

export function pauseRunSession(now: number = Date.now()) {
  const state = runRepository.get();
  if (!state) return;
  const next = pauseRun(state, now);
  runRepository.set(next);
  void syncRunNotification(next, now);
}

export function resumeRunSession(now: number = Date.now()) {
  const state = runRepository.get();
  if (!state) return;
  const next = resumeRun(state, now);
  runRepository.set(next);
  void syncRunNotification(next, now);
}

export async function finishRunSession(now: number = Date.now()) {
  const state = runRepository.get();
  if (state) {
    const next = finishRun(state, now);
    runRepository.set(next);
    void syncRunNotification(next, now);
  }
  await stopUpdates();
}

/** Descarta a corrida (ou limpa depois de salvar no diário). */
export async function discardRunSession() {
  runRepository.set(null);
  void syncRunNotification(null);
  await stopUpdates();
}

/**
 * Ao abrir o app com uma corrida ativa: se o sistema encerrou o serviço,
 * volta a gravar (só é permitido com o app em primeiro plano).
 */
export async function ensureRunUpdates() {
  const state = runRepository.get();
  void syncRunNotification(state);
  if (!state || state.status === 'finished') return;
  if (!(await Location.hasStartedLocationUpdatesAsync(RUN_TASK))) await startUpdates();
}
