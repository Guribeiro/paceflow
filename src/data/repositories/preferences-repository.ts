import type { DistanceUnit } from '../../domain/pace/units';
import { type RaceGoal, parseRaceGoal } from '../../domain/race-goal';
import type { KeyValueStorage } from '../storage/key-value';

export type ThemePreference = 'system' | 'light' | 'dark';

const UNIT_KEY = 'prefs:v1:unit';
const THEME_KEY = 'prefs:v1:theme';
const WEEKLY_GOAL_KEY = 'prefs:v1:weeklyGoal';
const RACE_GOAL_KEY = 'prefs:v1:raceGoal';
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
  /** Prova-alvo; referência estável até mudar. */
  getRaceGoal(): RaceGoal | null;
  setRaceGoal(goal: RaceGoal | null): void;
  subscribe(listener: () => void): () => void;
}

export function createPreferencesRepository(storage: KeyValueStorage): PreferencesRepository {
  const listeners = new Set<() => void>();
  // Cache da prova-alvo pelo texto gravado: mesma referência enquanto não mudar.
  let raceGoalCache: { raw: string | undefined; value: RaceGoal | null } | null = null;

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

    getRaceGoal() {
      const raw = storage.getString(RACE_GOAL_KEY);
      if (raceGoalCache && raceGoalCache.raw === raw) return raceGoalCache.value;
      let value: RaceGoal | null = null;
      try {
        value = raw === undefined ? null : parseRaceGoal(JSON.parse(raw));
      } catch {
        value = null;
      }
      raceGoalCache = { raw, value };
      return value;
    },

    setRaceGoal(goal) {
      if (goal === null) {
        storage.remove(RACE_GOAL_KEY);
        listeners.forEach((listener) => listener());
      } else {
        set(RACE_GOAL_KEY, JSON.stringify(goal));
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
