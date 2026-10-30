import { DEFAULT_VOICE_PREFERENCES } from '../../../domain/run-voice';
import { InMemoryStorage } from '../../storage/key-value';
import { createVoicePreferencesRepository } from '../voice-preferences-repository';

const KEY = 'run-voice:v1';

describe('VoicePreferencesRepository', () => {
  it('começa com as preferências padrão', () => {
    expect(createVoicePreferencesRepository(new InMemoryStorage()).get()).toEqual(DEFAULT_VOICE_PREFERENCES);
  });

  it('salva uma mudança parcial sem perder os outros campos e persiste', () => {
    const storage = new InMemoryStorage();
    const repo = createVoicePreferencesRepository(storage);
    repo.update({ totalTime: true });
    repo.update({ averagePace: false });

    const expected = { enabled: true, splitTime: true, averagePace: false, totalTime: true };
    expect(repo.get()).toEqual(expected);
    expect(JSON.parse(storage.getString(KEY) ?? 'null')).toEqual(expected);
    expect(createVoicePreferencesRepository(storage).get()).toEqual(expected);
  });

  it('mantém a referência até mudar', () => {
    const repo = createVoicePreferencesRepository(new InMemoryStorage());
    const first = repo.get();
    expect(repo.get()).toBe(first);

    repo.update({ enabled: false });
    const changed = repo.get();
    expect(changed).not.toBe(first);
    expect(repo.get()).toBe(changed);
  });

  it.each([
    ['JSON quebrado', '{quebrado'],
    ['campo faltando', JSON.stringify({ enabled: false, splitTime: true, averagePace: true })],
    ['campo não booleano', JSON.stringify({ enabled: 'não', splitTime: true, averagePace: true, totalTime: true })],
    ['valor que não é objeto', '42'],
  ])('volta ao padrão com %s gravado', (_, raw) => {
    const storage = new InMemoryStorage();
    storage.set(KEY, raw);
    expect(createVoicePreferencesRepository(storage).get()).toEqual(DEFAULT_VOICE_PREFERENCES);
  });

  it('ignora mudanças com valores inválidos', () => {
    const storage = new InMemoryStorage();
    const repo = createVoicePreferencesRepository(storage);
    repo.update({ enabled: 'não' as unknown as boolean });
    expect(repo.get()).toEqual(DEFAULT_VOICE_PREFERENCES);
    expect(storage.getString(KEY)).toBeUndefined();
  });

  it('notifica assinantes até cancelarem', () => {
    const repo = createVoicePreferencesRepository(new InMemoryStorage());
    const listener = jest.fn();
    const unsubscribe = repo.subscribe(listener);
    repo.update({ enabled: false });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    repo.update({ enabled: true });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
