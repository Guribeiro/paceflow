import { DEFAULT_REMINDER_PREFERENCES } from '../../../domain/reminders';
import { InMemoryStorage } from '../../storage/key-value';
import { createReminderPreferencesRepository } from '../reminder-preferences-repository';

describe('ReminderPreferencesRepository', () => {
  it('começa com tudo desligado', () => {
    expect(createReminderPreferencesRepository(new InMemoryStorage()).get()).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it('salva, persiste e mantém a referência até mudar', () => {
    const storage = new InMemoryStorage();
    const repo = createReminderPreferencesRepository(storage);
    repo.update({ training: true, trainingDays: [1, 3], time: '6:30' });

    const saved = repo.get();
    expect(saved).toMatchObject({ training: true, trainingDays: [1, 3], time: '06:30' });
    expect(repo.get()).toBe(saved);
    expect(createReminderPreferencesRepository(storage).get()).toEqual(saved);
  });

  it('ignora mudanças inválidas e volta ao padrão se o valor gravado estiver corrompido', () => {
    const storage = new InMemoryStorage();
    const repo = createReminderPreferencesRepository(storage);
    repo.update({ time: '99:00' });
    expect(repo.get()).toEqual(DEFAULT_REMINDER_PREFERENCES);

    storage.set('reminders:v1', '{quebrado');
    expect(createReminderPreferencesRepository(storage).get()).toEqual(DEFAULT_REMINDER_PREFERENCES);
  });

  it('notifica assinantes', () => {
    const repo = createReminderPreferencesRepository(new InMemoryStorage());
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.update({ race: true });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repo.update({ race: false });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
