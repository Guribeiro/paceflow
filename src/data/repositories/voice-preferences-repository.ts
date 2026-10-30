import { DEFAULT_VOICE_PREFERENCES, type VoicePreferences, parseVoicePreferences } from '../../domain/run-voice';
import type { KeyValueStorage } from '../storage/key-value';

// Por aparelho, fora do sync: fone e volume são de cada celular.
const KEY = 'run-voice:v1';

export interface VoicePreferencesRepository {
  /** Referência estável até mudar (para useSyncExternalStore). */
  get(): VoicePreferences;
  update(change: Partial<VoicePreferences>): void;
  subscribe(listener: () => void): () => void;
}

export function createVoicePreferencesRepository(storage: KeyValueStorage): VoicePreferencesRepository {
  const listeners = new Set<() => void>();
  let cache: { raw: string | undefined; value: VoicePreferences } | null = null;

  const repo: VoicePreferencesRepository = {
    get() {
      const raw = storage.getString(KEY);
      if (cache && cache.raw === raw) return cache.value;
      let value: VoicePreferences | null = null;
      try {
        value = raw === undefined ? null : parseVoicePreferences(JSON.parse(raw));
      } catch {
        value = null;
      }
      cache = { raw, value: value ?? DEFAULT_VOICE_PREFERENCES };
      return cache.value;
    },

    update(change) {
      const next = parseVoicePreferences({ ...repo.get(), ...change });
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
