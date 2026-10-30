import { applySamples, startRun } from '../../../domain/run-tracker';
import { InMemoryStorage } from '../../storage/key-value';
import { createRunRepository } from '../run-repository';

const T0 = new Date(2026, 10, 4, 10).getTime();
const running = applySamples(startRun(T0), [
  { latitude: -23.5, longitude: -46.6, accuracy: 5, timestamp: T0 },
  { latitude: -23.5001, longitude: -46.6, accuracy: 5, timestamp: T0 + 5000 },
]);

describe('RunRepository', () => {
  it('começa sem corrida', () => {
    expect(createRunRepository(new InMemoryStorage()).get()).toBeNull();
  });

  it('salva e persiste a corrida', () => {
    const storage = new InMemoryStorage();
    createRunRepository(storage).set(running);
    expect(createRunRepository(storage).get()).toEqual(running);
  });

  it('devolve a mesma referência até a próxima escrita', () => {
    const repo = createRunRepository(new InMemoryStorage());
    repo.set(running);
    const first = repo.get();
    expect(repo.get()).toBe(first);
    repo.set({ ...running, distanceMeters: 50 });
    expect(repo.get()).not.toBe(first);
    expect(repo.get()?.distanceMeters).toBe(50);
  });

  it('set(null) apaga a corrida salva', () => {
    const storage = new InMemoryStorage();
    const repo = createRunRepository(storage);
    repo.set(running);
    repo.set(null);
    expect(repo.get()).toBeNull();
    expect(storage.getString('run:v1')).toBeUndefined();
  });

  it('volta a null com JSON corrompido ou estado irreconhecível', () => {
    const storage = new InMemoryStorage();
    storage.set('run:v1', '{"status":');
    expect(createRunRepository(storage).get()).toBeNull();
    storage.set('run:v1', JSON.stringify({ ...running, status: 'walking' }));
    expect(createRunRepository(storage).get()).toBeNull();
  });

  it('notifica assinantes ao salvar e ao apagar, e para após unsubscribe', () => {
    const repo = createRunRepository(new InMemoryStorage());
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.set(running);
    repo.set(null);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    repo.set(running);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
