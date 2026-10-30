import * as Speech from 'expo-speech';

import { type RunState, startRun } from '../../domain/run-tracker';
import { DEFAULT_VOICE_PREFERENCES } from '../../domain/run-voice';
import { announceSplit, previewAnnouncement, voicePreferences } from '../run-voice';

jest.mock('expo-speech');

const speech = jest.mocked(Speech);
const T0 = new Date(2026, 10, 4, 10).getTime();

const run = (splits: number[], splitMeters = 1000): RunState => ({ ...startRun(T0, splitMeters), splits });

beforeEach(() => {
  voicePreferences.update(DEFAULT_VOICE_PREFERENCES);
  jest.clearAllMocks();
});

describe('announceSplit', () => {
  it('fala em português quando uma parcial nova fecha', () => {
    announceSplit(run([300_000]), run([300_000, 612_000]));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith(
      'Quilômetro 2. Parcial: 5 minutos e 12 segundos. Pace médio: 5 minutos e 6 segundos por quilômetro.',
      { language: 'pt-BR' },
    );
  });

  it('não fala quando nenhuma parcial nova fecha', () => {
    announceSplit(run([300_000]), run([300_000]));
    announceSplit(run([]), run([]));
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('quando várias parciais fecham de uma vez, fala só a última, uma vez', () => {
    announceSplit(run([]), run([300_000, 600_000, 900_000]));
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith(expect.stringMatching(/^Quilômetro 3\./), { language: 'pt-BR' });
  });

  it('não fala com a voz desligada', () => {
    voicePreferences.update({ enabled: false });
    announceSplit(run([]), run([300_000]));
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('respeita os itens escolhidos', () => {
    voicePreferences.update({ splitTime: false, averagePace: false, totalTime: true });
    announceSplit(run([]), run([480_000], 1609.344));
    expect(speech.speak).toHaveBeenCalledWith('Milha 1. Tempo total: 8 minutos.', { language: 'pt-BR' });
  });
});

describe('previewAnnouncement', () => {
  it('fala um exemplo da terceira parcial, parando a fala anterior antes', () => {
    previewAnnouncement(1000);
    expect(speech.stop).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith(
      'Quilômetro 3. Parcial: 5 minutos e 5 segundos. Pace médio: 5 minutos e 8 segundos por quilômetro.',
      { language: 'pt-BR' },
    );
    expect(speech.stop.mock.invocationCallOrder[0]).toBeLessThan(speech.speak.mock.invocationCallOrder[0]);
  });

  it('fala mesmo com a voz desligada, sem mudar a preferência', () => {
    voicePreferences.update({ enabled: false });
    previewAnnouncement(1609.344);
    expect(speech.speak).toHaveBeenCalledWith(expect.stringMatching(/^Milha 3\..*por milha\.$/), { language: 'pt-BR' });
    expect(voicePreferences.get().enabled).toBe(false);
  });
});
