import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { notificationKey, runNotificationProps, runSummaryProps } from '../domain/run-notification';
import type { RunState } from '../domain/run-tracker';
import { RunNotification, RunSummaryNotification } from '../widgets/RunNotification';

/** Id fixo: repostar com ele troca a notificação no lugar. */
const NOTIFICATION_ID = 'run';
// Importância padrão (sem som nem vibração) para ficar com as notificações de
// alerta, no topo; com LOW o Android a joga em "silenciosas". Um canal não
// sobe de importância depois de criado: por isso o id novo.
const CHANNEL_ID = 'run-live-v2';
/** O resumo some sozinho depois disso. */
const SUMMARY_TIMEOUT_MS = 30 * 60 * 1000;
/** Tocar na notificação abre a aba Correr (no resumo, é onde está a tela de salvar). */
function runUrl(): string | undefined {
  const scheme = Constants.expoConfig?.scheme;
  const first = Array.isArray(scheme) ? scheme[0] : scheme;
  return first ? `${first}://correr` : undefined;
}

let channelsReady: Promise<void> | null = null;

/**
 * Canal da notificação da corrida (silencioso) e, para ela ficar no topo, o
 * canal do serviço de GPS do expo-location (`<pacote>:<tarefa>`) com importância
 * mínima. Criar um canal existente com importância menor baixa a dele, desde
 * que o usuário não o tenha alterado.
 */
function ensureChannels(serviceTask: string): Promise<void> {
  channelsReady ??= (async () => {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Corrida em andamento',
      description: 'Tempo, distância e pace enquanto você corre',
      importance: AndroidImportance.DEFAULT,
      sound: null,
      vibrationPattern: null,
      enableVibrate: false,
    });
    const pkg = Constants.expoConfig?.android?.package;
    if (pkg) {
      await Notifications.setNotificationChannelAsync(`${pkg}:${serviceTask}`, {
        name: 'Gravação com GPS',
        importance: AndroidImportance.MIN,
        sound: null,
        vibrationPattern: null,
        enableVibrate: false,
      });
    }
  })().catch(() => {
    channelsReady = null;
  });
  return channelsReady;
}

type Shown = { kind: 'run'; key: string } | { kind: 'summary' } | null;

/**
 * Sincroniza a notificação com o estado da corrida. As chamadas entram numa
 * fila de uma posição: com uma em andamento, só a mais recente roda depois.
 * Falhas (notificações desligadas, etc.) são engolidas: a notificação nunca
 * atrapalha a gravação.
 */
export function createRunNotificationSync(deps: {
  run: typeof RunNotification;
  summary: typeof RunSummaryNotification;
  ensureChannels: () => Promise<void>;
}) {
  let shown: Shown = null;
  let running: Promise<void> | null = null;
  let pending: { state: RunState | null; now: number } | null = null;

  async function apply(state: RunState | null, now: number) {
    if (state === null) {
      if (shown === null) return;
      shown = null;
      await Promise.all([deps.run.cancelAll(), deps.summary.cancelAll()]);
      return;
    }
    await deps.ensureChannels();
    if (state.status === 'finished') {
      if (shown?.kind === 'summary') return;
      await deps.run.cancelAll();
      await deps.summary.post(runSummaryProps(state), {
        id: NOTIFICATION_ID,
        channelId: CHANNEL_ID,
        title: 'Corrida finalizada',
        ongoing: false,
        timeoutAfter: SUMMARY_TIMEOUT_MS,
        url: runUrl(),
      });
      shown = { kind: 'summary' };
      return;
    }
    const props = runNotificationProps(state, now);
    const key = notificationKey(props);
    if (shown?.kind === 'run' && shown.key === key) return;
    if (shown?.kind === 'summary') await deps.summary.cancelAll();
    // Postar com o mesmo id troca no lugar: serve para a primeira vez e para as seguintes,
    // e funciona mesmo depois de o processo reiniciar.
    await deps.run.post(props, {
      id: NOTIFICATION_ID,
      channelId: CHANNEL_ID,
      title: 'PaceFlow · corrida',
      text: `${props.time} · ${props.distance} ${props.unit}`,
      ongoing: true,
      alertOnlyOnce: true,
      url: runUrl(),
    });
    shown = { kind: 'run', key };
  }

  async function drain() {
    while (pending) {
      const { state, now } = pending;
      pending = null;
      try {
        await apply(state, now);
      } catch {
        // Esquece o que estava na tela: a próxima chamada reposta.
        shown = null;
      }
    }
    running = null;
  }

  return function sync(state: RunState | null, now: number = Date.now()): Promise<void> {
    if (Platform.OS !== 'android') return Promise.resolve();
    pending = { state, now };
    running ??= drain();
    return running;
  };
}

export const syncRunNotification = createRunNotificationSync({
  run: RunNotification,
  summary: RunSummaryNotification,
  // O mesmo nome de RUN_TASK (run-session.ts); importar de lá faria um ciclo.
  ensureChannels: () => ensureChannels('paceflow-run'),
});
