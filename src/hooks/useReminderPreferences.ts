import { useSyncExternalStore } from 'react';

import { reminderPreferences } from '../data/reminders';
import type { ReminderPreferences } from '../domain/reminders';

export function useReminderPreferences(): [ReminderPreferences, (change: Partial<ReminderPreferences>) => void] {
  const prefs = useSyncExternalStore(reminderPreferences.subscribe, reminderPreferences.get);
  return [prefs, reminderPreferences.update];
}
