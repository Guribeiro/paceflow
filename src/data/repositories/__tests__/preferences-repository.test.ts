import { InMemoryStorage } from '../../storage/key-value';
import { createPreferencesRepository } from '../preferences-repository';

describe('PreferencesRepository', () => {
  it('usa km quando nada foi salvo', () => {
    const repo = createPreferencesRepository(new InMemoryStorage());
    expect(repo.getUnit()).toBe('km');
  });

  it('salva e persiste a unidade', () => {
    const storage = new InMemoryStorage();
    createPreferencesRepository(storage).setUnit('mi');
    expect(createPreferencesRepository(storage).getUnit()).toBe('mi');
  });

  it('volta para km se o valor salvo for inválido', () => {
    const storage = new InMemoryStorage();
    storage.set('prefs:v1:unit', 'léguas');
    expect(createPreferencesRepository(storage).getUnit()).toBe('km');
  });

  it('notifica assinantes ao mudar e para após unsubscribe', () => {
    const repo = createPreferencesRepository(new InMemoryStorage());
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.setUnit('mi');
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repo.setUnit('km');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  describe('tema', () => {
    it('segue o sistema quando nada foi salvo', () => {
      expect(createPreferencesRepository(new InMemoryStorage()).getTheme()).toBe('system');
    });

    it.each(['light', 'dark', 'system'] as const)('salva e persiste "%s"', (theme) => {
      const storage = new InMemoryStorage();
      createPreferencesRepository(storage).setTheme(theme);
      expect(createPreferencesRepository(storage).getTheme()).toBe(theme);
    });

    it('volta para system se o valor salvo for inválido', () => {
      const storage = new InMemoryStorage();
      storage.set('prefs:v1:theme', 'sépia');
      expect(createPreferencesRepository(storage).getTheme()).toBe('system');
    });

    it('notifica assinantes ao mudar', () => {
      const repo = createPreferencesRepository(new InMemoryStorage());
      const listener = jest.fn();
      repo.subscribe(listener);
      repo.setTheme('dark');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('meta semanal', () => {
    it('começa sem meta', () => {
      expect(createPreferencesRepository(new InMemoryStorage()).getWeeklyGoal()).toBeNull();
    });

    it('salva em metros, persiste e pode ser removida', () => {
      const storage = new InMemoryStorage();
      const repo = createPreferencesRepository(storage);
      repo.setWeeklyGoal(20000);
      expect(createPreferencesRepository(storage).getWeeklyGoal()).toBe(20000);
      repo.setWeeklyGoal(null);
      expect(createPreferencesRepository(storage).getWeeklyGoal()).toBeNull();
    });

    it.each(['abc', '-5', '0', 'Infinity'])('valor salvo inválido (%s) vira sem meta', (raw) => {
      const storage = new InMemoryStorage();
      storage.set('prefs:v1:weeklyGoal', raw);
      expect(createPreferencesRepository(storage).getWeeklyGoal()).toBeNull();
    });

    it('notifica ao mudar', () => {
      const repo = createPreferencesRepository(new InMemoryStorage());
      const listener = jest.fn();
      repo.subscribe(listener);
      repo.setWeeklyGoal(10000);
      repo.setWeeklyGoal(null);
      expect(listener).toHaveBeenCalledTimes(2);
    });
  });

  describe('prova-alvo', () => {
    const goal = { distanceKm: 21.0975, date: '2026-11-23', targetSeconds: 6300 };

    it('salva, persiste e remove', () => {
      const storage = new InMemoryStorage();
      const repo = createPreferencesRepository(storage);
      expect(repo.getRaceGoal()).toBeNull();
      repo.setRaceGoal(goal);
      expect(createPreferencesRepository(storage).getRaceGoal()).toEqual(goal);
      repo.setRaceGoal(null);
      expect(repo.getRaceGoal()).toBeNull();
    });

    it('devolve a mesma referência enquanto nada muda (useSyncExternalStore)', () => {
      const repo = createPreferencesRepository(new InMemoryStorage());
      repo.setRaceGoal(goal);
      expect(repo.getRaceGoal()).toBe(repo.getRaceGoal());
    });

    it('JSON inválido vira sem prova', () => {
      const storage = new InMemoryStorage();
      storage.set('prefs:v1:raceGoal', '{quebrado');
      expect(createPreferencesRepository(storage).getRaceGoal()).toBeNull();
    });
  });

  describe('sync das preferências', () => {
    function setup() {
      const storage = new InMemoryStorage();
      const changes: string[][] = [];
      let clock = Date.parse('2026-10-29T10:00:00.000Z');
      const repo = createPreferencesRepository(storage, {
        now: () => new Date((clock += 1000)).toISOString(),
        onLocalChange: (ids) => changes.push(ids),
      });
      return { storage, repo, changes };
    }

    it('instalação nova não tem o que enviar', () => {
      const { repo } = setup();
      expect(repo.listAll()).toEqual([]);
      expect(repo.getRecord('preferences')).toBeUndefined();
    });

    it('unidade, meta e prova marcam alteração; o tema não', () => {
      const { repo, changes } = setup();
      repo.setTheme('dark');
      expect(changes).toEqual([]);
      repo.setUnit('mi');
      repo.setWeeklyGoal(20000);
      repo.setRaceGoal({ distanceKm: 10, date: '2026-12-01' });
      expect(changes).toEqual([['preferences'], ['preferences'], ['preferences']]);
      expect(repo.getRecord('preferences')).toEqual({
        id: 'preferences',
        unit: 'mi',
        weeklyGoalMeters: 20000,
        raceGoal: { distanceKm: 10, date: '2026-12-01' },
        createdAt: '2026-10-29T10:00:01.000Z',
        updatedAt: '2026-10-29T10:00:03.000Z',
        deletedAt: null,
      });
      expect(repo.listAll()).toHaveLength(1);
    });

    it('importa só o que for mais recente, sem marcar alteração', () => {
      const { repo, changes } = setup();
      repo.setUnit('mi'); // updatedAt 10:00:01
      const remote = {
        id: 'preferences' as const,
        unit: 'km' as const,
        weeklyGoalMeters: 30000,
        raceGoal: null,
        createdAt: '2026-10-01T00:00:00.000Z',
        deletedAt: null,
      };
      repo.importRecords([{ ...remote, updatedAt: '2026-10-29T09:00:00.000Z' }], { origin: 'remote' });
      expect(repo.getUnit()).toBe('mi');

      const listener = jest.fn();
      repo.subscribe(listener);
      repo.importRecords([{ ...remote, updatedAt: '2026-10-29T11:00:00.000Z' }], { origin: 'remote' });
      expect(repo.getUnit()).toBe('km');
      expect(repo.getWeeklyGoal()).toBe(30000);
      expect(repo.getRaceGoal()).toBeNull();
      expect(listener).toHaveBeenCalled();
      expect(changes).toEqual([['preferences']]);
    });

    it('o tema local não é afetado pela importação', () => {
      const { repo } = setup();
      repo.setTheme('light');
      repo.importRecords(
        [
          {
            id: 'preferences',
            unit: 'km',
            weeklyGoalMeters: null,
            raceGoal: null,
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-30T00:00:00.000Z',
            deletedAt: null,
          },
        ],
        { origin: 'remote' },
      );
      expect(repo.getTheme()).toBe('light');
    });
  });

  describe('preferências de antes do sync (sem data)', () => {
    it('sobem com data zero: entram numa conta vazia e perdem para qualquer valor da conta', () => {
      const storage = new InMemoryStorage();
      storage.set('prefs:v1:weeklyGoal', '20000'); // gravado por uma versão antiga
      const repo = createPreferencesRepository(storage);
      expect(repo.getRecord('preferences')).toMatchObject({
        weeklyGoalMeters: 20000,
        updatedAt: '1970-01-01T00:00:00.000Z',
      });
      expect(repo.listAll()).toHaveLength(1);

      repo.importRecords(
        [
          {
            id: 'preferences',
            unit: 'km',
            weeklyGoalMeters: 30000,
            raceGoal: null,
            createdAt: '2026-10-01T00:00:00.000Z',
            updatedAt: '2026-10-01T00:00:00.000Z',
            deletedAt: null,
          },
        ],
        { origin: 'remote' },
      );
      expect(repo.getWeeklyGoal()).toBe(30000);
    });

    it('só o tema não conta como preferência da conta', () => {
      const storage = new InMemoryStorage();
      storage.set('prefs:v1:theme', 'dark');
      expect(createPreferencesRepository(storage).listAll()).toEqual([]);
    });
  });
});

