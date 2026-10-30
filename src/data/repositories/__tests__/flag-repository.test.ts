import { InMemoryStorage } from '../../storage/key-value';
import { createFlagRepository } from '../flag-repository';

const KEY = 'teste:v1';

describe('FlagRepository', () => {
  it.each([true, false])('sem nada gravado, devolve o padrão (%s)', (defaultValue) => {
    expect(createFlagRepository(new InMemoryStorage(), KEY, defaultValue).get()).toBe(defaultValue);
  });

  it('grava como texto na chave dada e persiste entre instâncias', () => {
    const storage = new InMemoryStorage();
    const repo = createFlagRepository(storage, KEY, true);
    repo.set(false);
    expect(repo.get()).toBe(false);
    expect(storage.getString(KEY)).toBe('false');
    expect(createFlagRepository(storage, KEY, true).get()).toBe(false);

    repo.set(true);
    expect(storage.getString(KEY)).toBe('true');
    expect(createFlagRepository(storage, KEY, false).get()).toBe(true);
  });

  it.each(['1', 'sim', 'TRUE', '', '{"value":false}'])('volta ao padrão com "%s" gravado', (raw) => {
    const storage = new InMemoryStorage();
    storage.set(KEY, raw);
    expect(createFlagRepository(storage, KEY, true).get()).toBe(true);
    expect(createFlagRepository(storage, KEY, false).get()).toBe(false);
  });

  it('não mistura chaves diferentes', () => {
    const storage = new InMemoryStorage();
    createFlagRepository(storage, KEY, true).set(false);
    expect(createFlagRepository(storage, 'outra:v1', true).get()).toBe(true);
  });

  it('notifica assinantes até cancelarem', () => {
    const repo = createFlagRepository(new InMemoryStorage(), KEY, true);
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.set(false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repo.set(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
