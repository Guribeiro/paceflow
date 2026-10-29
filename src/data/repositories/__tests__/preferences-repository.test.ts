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
});
