import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { type Reminder, planReminders } from '../domain/reminders';
import { preferencesRepository } from './preferences';
import { createReminderPreferencesRepository } from './repositories/reminder-preferences-repository';
import { storage } from './storage/mmkv';
import { workoutRepository } from './workouts';

export const reminderPreferences = createReminderPreferencesRepository(storage);

const CHANNEL_ID = 'lembretes';
// Só mexe no que é do app: outros agendamentos (se um dia houver) ficam intactos.
const PREFIX = 'paceflow:';

// Com o app aberto, o lembrete aparece igual (banner e lista), sem som extra.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/** No Android 13+, o pedido de permissão só aparece depois que existe um canal. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lembretes',
    description: 'Dias de treino, meta da semana e prova chegando',
    importance: AndroidImportance.DEFAULT,
  });
}

export async function hasReminderPermission(): Promise<boolean> {
  return (await Notifications.getPermissionsAsync()).granted;
}

/** Pede a permissão se ainda der; false se o usuário negou (aí só pelas configurações). */
export async function requestReminderPermission(): Promise<boolean> {
  await ensureChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** Muda junto com qualquer parte do lembrete: data, título ou texto. */
const fingerprint = (r: Reminder) => `${r.date.getTime()}|${r.title}|${r.body}`;

/** Deixa agendado exatamente `desired`: cancela o que sobrou ou mudou e agenda o que falta. */
export async function applyReminders(desired: readonly Reminder[]): Promise<void> {
  const pending = new Map(desired.map((r) => [PREFIX + r.id, r]));
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();

  for (const request of scheduled) {
    if (!request.identifier.startsWith(PREFIX)) continue;
    const wanted = pending.get(request.identifier);
    if (wanted && request.content.data?.fingerprint === fingerprint(wanted)) {
      pending.delete(request.identifier);
    } else {
      await Notifications.cancelScheduledNotificationAsync(request.identifier);
    }
  }

  if (pending.size > 0) await ensureChannel();
  for (const [identifier, r] of pending) {
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: { title: r.title, body: r.body, data: { fingerprint: fingerprint(r) } },
      // Sem "alarmClock": o Android pode atrasar alguns minutos, e o app não
      // precisa da permissão de alarme exato.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL_ID },
    });
  }
}

let running: Promise<void> | null = null;
let again = false;

/**
 * Recalcula e aplica os lembretes. Chamadas durante uma sincronização em curso
 * viram uma única rodada extra no fim (ex.: importar muitos treinos de uma vez).
 */
export function syncReminders(now: () => Date = () => new Date()): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        const desired = planReminders(
          reminderPreferences.get(),
          {
            workouts: workoutRepository.list(),
            unit: preferencesRepository.getUnit(),
            weeklyGoalMeters: preferencesRepository.getWeeklyGoal(),
            raceGoal: preferencesRepository.getRaceGoal(),
            goalHistory: preferencesRepository.getGoalHistory(),
          },
          now(),
        );
        // Sem permissão nada aparece; limpar evita lembretes antigos se ela voltar.
        await applyReminders((await hasReminderPermission()) ? desired : []);
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}
