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
});

