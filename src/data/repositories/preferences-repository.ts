import type { DistanceUnit } from '../../domain/pace/units';
import type { KeyValueStorage } from '../storage/key-value';

const UNIT_KEY = 'prefs:v1:unit';
const DEFAULT_UNIT: DistanceUnit = 'km';

const isDistanceUnit = (value: unknown): value is DistanceUnit => value === 'km' || value === 'mi';

export interface PreferencesRepository {
  getUnit(): DistanceUnit;
  setUnit(unit: DistanceUnit): void;
  subscribe(listener: () => void): () => void;
}

export function createPreferencesRepository(storage: KeyValueStorage): PreferencesRepository {
  const listeners = new Set<() => void>();

  return {
    getUnit() {
      const value = storage.getString(UNIT_KEY);
      return isDistanceUnit(value) ? value : DEFAULT_UNIT;
    },

    setUnit(unit) {
      storage.set(UNIT_KEY, unit);
      listeners.forEach((listener) => listener());
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
