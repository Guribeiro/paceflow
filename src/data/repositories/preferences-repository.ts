import type { DistanceUnit } from '../../domain/pace/units';
import type { KeyValueStorage } from '../storage/key-value';

export type ThemePreference = 'system' | 'light' | 'dark';

const UNIT_KEY = 'prefs:v1:unit';
const THEME_KEY = 'prefs:v1:theme';
const WEEKLY_GOAL_KEY = 'prefs:v1:weeklyGoal';
const DEFAULT_UNIT: DistanceUnit = 'km';
const DEFAULT_THEME: ThemePreference = 'system';

const isDistanceUnit = (value: unknown): value is DistanceUnit => value === 'km' || value === 'mi';
const isThemePreference = (value: unknown): value is ThemePreference =>
  value === 'system' || value === 'light' || value === 'dark';

export interface PreferencesRepository {
  getUnit(): DistanceUnit;
  setUnit(unit: DistanceUnit): void;
  getTheme(): ThemePreference;
  setTheme(theme: ThemePreference): void;
  /** Meta semanal em metros (independe da unidade exibida); null = sem meta. */
  getWeeklyGoal(): number | null;
  setWeeklyGoal(meters: number | null): void;
  subscribe(listener: () => void): () => void;
}

export function createPreferencesRepository(storage: KeyValueStorage): PreferencesRepository {
  const listeners = new Set<() => void>();

  function set(key: string, value: string) {
    storage.set(key, value);
    listeners.forEach((listener) => listener());
  }

  return {
    getUnit() {
      const value = storage.getString(UNIT_KEY);
      return isDistanceUnit(value) ? value : DEFAULT_UNIT;
    },

    setUnit(unit) {
      set(UNIT_KEY, unit);
    },

    getTheme() {
      const value = storage.getString(THEME_KEY);
      return isThemePreference(value) ? value : DEFAULT_THEME;
    },

    setTheme(theme) {
      set(THEME_KEY, theme);
    },

    getWeeklyGoal() {
      const value = Number(storage.getString(WEEKLY_GOAL_KEY));
      return Number.isFinite(value) && value > 0 ? value : null;
    },

    setWeeklyGoal(meters) {
      if (meters === null) {
        storage.remove(WEEKLY_GOAL_KEY);
        listeners.forEach((listener) => listener());
      } else {
        set(WEEKLY_GOAL_KEY, String(meters));
      }
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
