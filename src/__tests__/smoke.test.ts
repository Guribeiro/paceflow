import { storage } from '../data/storage/mmkv';

describe('setup', () => {
  it('persiste e lê valores no MMKV', () => {
    storage.set('ping', 'pong');
    expect(storage.getString('ping')).toBe('pong');
  });
});
