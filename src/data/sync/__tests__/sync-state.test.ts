import { InMemoryStorage } from '../../storage/key-value';
import { createSyncState } from '../sync-state';

describe('SyncState', () => {
  it('fila de pendentes sem duplicatas e persistente', () => {
    const storage = new InMemoryStorage();
    const state = createSyncState(storage);
    state.markDirty(['a', 'b']);
    state.markDirty(['b', 'c']);
    expect(createSyncState(storage).getDirty()).toEqual(['a', 'b', 'c']);
    state.clearDirty(['a', 'c']);
    expect(state.getDirty()).toEqual(['b']);
  });

  it('cursor, bootstrap e última sincronização', () => {
    const state = createSyncState(new InMemoryStorage());
    expect(state.getCursor()).toBeNull();
    expect(state.isBootstrapped()).toBe(false);
    expect(state.getLastSync()).toBeNull();

    state.setCursor('2026-10-29T12:00:00.000Z');
    state.setBootstrapped();
    state.setLastSync({ at: '2026-10-29T12:00:01.000Z' });

    expect(state.getCursor()).toBe('2026-10-29T12:00:00.000Z');
    expect(state.isBootstrapped()).toBe(true);
    expect(state.getLastSync()).toEqual({ at: '2026-10-29T12:00:01.000Z' });
  });

  it('reset limpa tudo (ao sair da conta)', () => {
    const state = createSyncState(new InMemoryStorage());
    state.markDirty(['a']);
    state.setCursor('2026-10-29T12:00:00.000Z');
    state.setBootstrapped();
    state.setLastSync({ at: 'x' });
    state.reset();
    expect(state.getDirty()).toEqual([]);
    expect(state.getCursor()).toBeNull();
    expect(state.isBootstrapped()).toBe(false);
    expect(state.getLastSync()).toBeNull();
  });

  it('tolera valores corrompidos', () => {
    const storage = new InMemoryStorage();
    storage.set('sync:v1:dirty', 'lixo');
    storage.set('sync:v1:last', '{quebrado');
    const state = createSyncState(storage);
    expect(state.getDirty()).toEqual([]);
    expect(state.getLastSync()).toBeNull();
  });

  it('notifica mudanças de última sincronização', () => {
    const state = createSyncState(new InMemoryStorage());
    const listener = jest.fn();
    state.subscribe(listener);
    state.setLastSync({ at: 'x' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('estados com prefixos diferentes não se misturam', () => {
    const storage = new InMemoryStorage();
    const workouts = createSyncState(storage);
    const shoes = createSyncState(storage, 'sync:v1:shoes:');
    workouts.markDirty(['w1']);
    shoes.markDirty(['s1']);
    shoes.setBootstrapped();
    expect(workouts.getDirty()).toEqual(['w1']);
    expect(shoes.getDirty()).toEqual(['s1']);
    expect(workouts.isBootstrapped()).toBe(false);
    // Treinos mantêm as chaves originais (sem migração para quem já sincronizou).
    expect(storage.getString('sync:v1:dirty')).toBe('["w1"]');
  });
});

