import type { DistanceUnit } from '../../domain/pace/units';
import { type GoalHistory, parseGoalHistory, recordGoal } from '../../domain/goal-history';
import { PREFERENCES_ID, type SyncedPreferences } from '../../domain/preferences';
import { type RaceGoal, parseRaceGoal } from '../../domain/race-goal';
import { keyOfDate } from '../../domain/workout-date';
import { startOfWeek } from '../../domain/workout-summary';
import type { KeyValueStorage } from '../storage/key-value';
import type { ImportOptions } from './record-store';

export type ThemePreference = 'system' | 'light' | 'dark';

const UNIT_KEY = 'prefs:v1:unit';
const THEME_KEY = 'prefs:v1:theme';
const WEEKLY_GOAL_KEY = 'prefs:v1:weeklyGoal';
const RACE_GOAL_KEY = 'prefs:v1:raceGoal';
// Metas por semana, para a sequência; fica só no aparelho.
const GOAL_HISTORY_KEY = 'prefs:v1:weeklyGoalHistory';
// Datas das preferências sincronizáveis (unidade, meta, prova). Ausentes =
// nunca mudou: a instalação nova não sobe nada e recebe o que está na conta.
const CREATED_AT_KEY = 'prefs:v1:createdAt';
const UPDATED_AT_KEY = 'prefs:v1:updatedAt';
// Valores gravados por versões anteriores ao sync não têm data: contam como
// alterados na "data zero", então sobem para uma conta vazia e perdem para
// qualquer valor que a conta já tenha.
const LEGACY_UPDATED_AT = new Date(0).toISOString();
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
  /** Mudanças da meta por semana; referência estável até mudar. */
  getGoalHistory(): GoalHistory;
  /** Prova-alvo; referência estável até mudar. */
  getRaceGoal(): RaceGoal | null;
  setRaceGoal(goal: RaceGoal | null): void;
  subscribe(listener: () => void): () => void;
  /** Para o motor de sync: o registro das preferências da conta (vazio se nunca mudou). */
  listAll(): SyncedPreferences[];
  getRecord(id: string): SyncedPreferences | undefined;
  /** Aplica o registro recebido se for mais recente; não marca alteração local. */
  importRecords(records: readonly SyncedPreferences[], options?: ImportOptions): void;
}

interface Deps {
  now?: () => string;
  /** Data local usada para a semana do histórico da meta. */
  today?: () => Date;
  /** Chamado ao mudar unidade, meta ou prova (o sync marca como pendente). */
  onLocalChange?: (ids: string[]) => void;
}

export function createPreferencesRepository(
  storage: KeyValueStorage,
  { now = () => new Date().toISOString(), today = () => new Date(), onLocalChange }: Deps = {},
): PreferencesRepository {
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  // Cache da prova-alvo pelo texto gravado: mesma referência enquanto não mudar.
  let raceGoalCache: { raw: string | undefined; value: RaceGoal | null } | null = null;
  let goalHistoryCache: { raw: string | undefined; value: GoalHistory } | null = null;

  /** Anota no histórico a meta desta semana, se mudou. Chamar antes de gravar a nova meta. */
  function recordGoalChange(meters: number | null) {
    const previous = repo.getWeeklyGoal();
    if (previous === meters) return;
    const week = keyOfDate(startOfWeek(today()));
    storage.set(GOAL_HISTORY_KEY, JSON.stringify(recordGoal(repo.getGoalHistory(), week, meters, previous)));
  }

  function set(key: string, value: string) {
    storage.set(key, value);
    notify();
  }

  /** Grava (ou remove) uma preferência sincronizável e carimba a alteração. */
  function setSynced(key: string, value: string | null) {
    if (value === null) storage.remove(key);
    else storage.set(key, value);
    const timestamp = now();
    if (storage.getString(CREATED_AT_KEY) === undefined) storage.set(CREATED_AT_KEY, timestamp);
    storage.set(UPDATED_AT_KEY, timestamp);
    onLocalChange?.([PREFERENCES_ID]);
    notify();
  }

  const repo: PreferencesRepository = {
    getUnit() {
      const value = storage.getString(UNIT_KEY);
      return isDistanceUnit(value) ? value : DEFAULT_UNIT;
    },

    setUnit(unit) {
      setSynced(UNIT_KEY, unit);
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
      recordGoalChange(meters);
      setSynced(WEEKLY_GOAL_KEY, meters === null ? null : String(meters));
    },

    getGoalHistory() {
      const raw = storage.getString(GOAL_HISTORY_KEY);
      if (goalHistoryCache && goalHistoryCache.raw === raw) return goalHistoryCache.value;
      let value: GoalHistory = [];
      try {
        value = raw === undefined ? [] : (parseGoalHistory(JSON.parse(raw)) ?? []);
      } catch {
        value = [];
      }
      goalHistoryCache = { raw, value };
      return value;
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
      setSynced(RACE_GOAL_KEY, goal === null ? null : JSON.stringify(goal));
    },

    getRecord(id) {
      const hasLegacyValues = [UNIT_KEY, WEEKLY_GOAL_KEY, RACE_GOAL_KEY].some((k) => storage.getString(k) !== undefined);
      const updatedAt = storage.getString(UPDATED_AT_KEY) ?? (hasLegacyValues ? LEGACY_UPDATED_AT : undefined);
      if (id !== PREFERENCES_ID || updatedAt === undefined) return undefined;
      return {
        id: PREFERENCES_ID,
        unit: repo.getUnit(),
        weeklyGoalMeters: repo.getWeeklyGoal(),
        raceGoal: repo.getRaceGoal(),
        createdAt: storage.getString(CREATED_AT_KEY) ?? updatedAt,
        updatedAt,
        deletedAt: null,
      };
    },

    listAll() {
      const record = repo.getRecord(PREFERENCES_ID);
      return record ? [record] : [];
    },

    importRecords(records) {
      for (const incoming of records) {
        const current = storage.getString(UPDATED_AT_KEY);
        if (current !== undefined && Date.parse(current) >= Date.parse(incoming.updatedAt)) continue;
        storage.set(UNIT_KEY, incoming.unit);
        // Instalação nova recebendo a conta: sem histórico, vale a meta atual.
        if (current !== undefined) recordGoalChange(incoming.weeklyGoalMeters);
        if (incoming.weeklyGoalMeters === null) storage.remove(WEEKLY_GOAL_KEY);
        else storage.set(WEEKLY_GOAL_KEY, String(incoming.weeklyGoalMeters));
        if (incoming.raceGoal === null) storage.remove(RACE_GOAL_KEY);
        else storage.set(RACE_GOAL_KEY, JSON.stringify(incoming.raceGoal));
        storage.set(CREATED_AT_KEY, incoming.createdAt);
        storage.set(UPDATED_AT_KEY, incoming.updatedAt);
        notify();
      }
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
