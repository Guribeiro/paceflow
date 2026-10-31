import * as Notifications from 'expo-notifications';

import type { Reminder } from '../../domain/reminders';
import { preferencesRepository } from '../preferences';
import { applyReminders, reminderPreferences, requestReminderPermission, syncReminders } from '../reminders';
import { storage } from '../storage/mmkv';
import { workoutRepository } from '../workouts';

const mocked = jest.mocked(Notifications);

const reminder = (id: string, date: Date, body = 'Hora de correr!'): Reminder => ({ id, date, title: 'Dia de treino', body });

async function scheduledIds() {
  return (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier).sort();
}

beforeEach(async () => {
  await applyReminders([]);
  jest.clearAllMocks();
});

describe('applyReminders', () => {
  const a = reminder('treino:2026-11-05', new Date(2026, 10, 5, 7));
  const b = reminder('treino:2026-11-07', new Date(2026, 10, 7, 7));

  it('agenda com id do app, data e canal de lembretes', async () => {
    await applyReminders([a]);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: 'paceflow:treino:2026-11-05',
      content: expect.objectContaining({ title: 'Dia de treino', body: 'Hora de correr!' }),
      trigger: { type: 'date', date: a.date, channelId: 'lembretes' },
    });
  });

  it('não duplica nem reagenda o que já está igual', async () => {
    await applyReminders([a, b]);
    mocked.scheduleNotificationAsync.mockClear();
    await applyReminders([a, b]);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(mocked.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    expect(await scheduledIds()).toEqual(['paceflow:treino:2026-11-05', 'paceflow:treino:2026-11-07']);
  });

  it('cancela o que saiu da lista e reagenda o que mudou de texto', async () => {
    await applyReminders([a, b]);
    jest.clearAllMocks();
    await applyReminders([{ ...a, body: 'Limiar: 3×5 min.' }]);

    expect(mocked.cancelScheduledNotificationAsync.mock.calls.map(([id]) => id).sort()).toEqual([
      'paceflow:treino:2026-11-05',
      'paceflow:treino:2026-11-07',
    ]);
    expect(await scheduledIds()).toEqual(['paceflow:treino:2026-11-05']);
    const [request] = await Notifications.getAllScheduledNotificationsAsync();
    expect(request.content.body).toBe('Limiar: 3×5 min.');
  });

  it('não mexe em agendamentos que não são do app', async () => {
    await Notifications.scheduleNotificationAsync({
      identifier: 'outro',
      content: { title: 'x' },
      trigger: null,
    });
    await applyReminders([]);
    expect(await scheduledIds()).toEqual(['outro']);
    await Notifications.cancelScheduledNotificationAsync('outro');
  });
});

describe('syncReminders', () => {
  afterEach(() => {
    reminderPreferences.update({ race: false });
    preferencesRepository.setRaceGoal(null);
  });

  it('agenda a partir das preferências e limpa tudo sem permissão', async () => {
    preferencesRepository.setRaceGoal({ distanceKm: 10, date: '2026-11-22' });
    reminderPreferences.update({ race: true });
    await syncReminders(() => new Date(2026, 10, 4, 10));
    expect(await scheduledIds()).toEqual(['paceflow:prova:1:2026-11-22', 'paceflow:prova:7:2026-11-22']);

    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    await syncReminders(() => new Date(2026, 10, 4, 10));
    expect(await scheduledIds()).toEqual([]);
  });

  it('a sequência usa o histórico da meta gravado no aparelho', async () => {
    // Meta de 10 km até a semana passada e 20 km a partir desta (02/11).
    storage.set('prefs:v1:weeklyGoal', '20000');
    storage.set(
      'prefs:v1:weeklyGoalHistory',
      JSON.stringify([
        { week: '0000-01-01', meters: 10000 },
        { week: '2026-11-02', meters: 20000 },
      ]),
    );
    const created = workoutRepository.create({
      date: new Date(2026, 9, 28, 7).toISOString(),
      distanceMeters: 12000, // basta para os 10 km da época, não para os 20 de hoje
      durationSeconds: 3600,
      terrain: 'rua',
    });
    if (!created.ok) throw new Error(created.error);
    reminderPreferences.update({ streak: true });
    try {
      await syncReminders(() => new Date(2026, 10, 4, 10));
      expect(await scheduledIds()).toEqual(['paceflow:sequencia:2026-11-08']);
    } finally {
      reminderPreferences.update({ streak: false });
      workoutRepository.remove(created.value.id);
      storage.remove('prefs:v1:weeklyGoal');
      storage.remove('prefs:v1:weeklyGoalHistory');
    }
  });

  it('chamadas seguidas viram uma rodada extra, não várias', async () => {
    await Promise.all([syncReminders(), syncReminders(), syncReminders()]);
    expect(mocked.getAllScheduledNotificationsAsync).toHaveBeenCalledTimes(2);
  });
});

describe('requestReminderPermission', () => {
  it('cria o canal antes de pedir', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: true } as never);
    expect(await requestReminderPermission()).toBe(true);
    expect(mocked.requestPermissionsAsync).toHaveBeenCalled();
  });

  it('não pede de novo quando o usuário bloqueou', async () => {
    mocked.getPermissionsAsync.mockResolvedValueOnce({ granted: false, canAskAgain: false } as never);
    expect(await requestReminderPermission()).toBe(false);
    expect(mocked.requestPermissionsAsync).not.toHaveBeenCalled();
  });
});
