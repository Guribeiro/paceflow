import {
  DEFAULT_REMINDER_PREFERENCES,
  type ReminderPreferences,
  parseReminderPreferences,
} from '../../domain/reminders';
import type { KeyValueStorage } from '../storage/key-value';

// Por aparelho, fora do sync: cada celular decide se e quando avisa.
const KEY = 'reminders:v1';

export interface ReminderPreferencesRepository {
  /** Referência estável até mudar (para useSyncExternalStore). */
  get(): ReminderPreferences;
  update(change: Partial<ReminderPreferences>): void;
  subscribe(listener: () => void): () => void;
}

export function createReminderPreferencesRepository(storage: KeyValueStorage): ReminderPreferencesRepository {
  const listeners = new Set<() => void>();
  let cache: { raw: string | undefined; value: ReminderPreferences } | null = null;

  const repo: ReminderPreferencesRepository = {
    get() {
      const raw = storage.getString(KEY);
      if (cache && cache.raw === raw) return cache.value;
      let value: ReminderPreferences | null = null;
      try {
        value = raw === undefined ? null : parseReminderPreferences(JSON.parse(raw));
      } catch {
        value = null;
      }
      cache = { raw, value: value ?? DEFAULT_REMINDER_PREFERENCES };
      return cache.value;
    },

    update(change) {
      const next = parseReminderPreferences({ ...repo.get(), ...change });
      if (!next) return;
      storage.set(KEY, JSON.stringify(next));
      listeners.forEach((listener) => listener());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
