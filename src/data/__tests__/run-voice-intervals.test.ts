import * as Speech from 'expo-speech';

import { DEFAULT_INTERVAL_PLAN, type IntervalPlan } from '../../domain/interval-plan';
import { type RunSample, type RunState, applySamples, startRun } from '../../domain/run-tracker';
import { DEFAULT_VOICE_PREFERENCES } from '../../domain/run-voice';
import { announceFirstPhase, announceIntervals, announceSplit, voicePreferences } from '../run-voice';

jest.mock('expo-speech');

const speech = jest.mocked(Speech);
const T0 = new Date(2026, 10, 4, 10).getTime();
const METER = 1 / 111_195;
const north = (meters: number, seconds: number): RunSample => ({
  latitude: -23.5 + meters * METER,
  longitude: -46.6,
  accuracy: 5,
  timestamp: T0 + seconds * 1000,
});
const straight = (toS: number, speed: number) => Array.from({ length: toS + 1 }, (_, i) => north(i * speed, i));

const PLAN: IntervalPlan = {
  warmup: null,
  reps: 2,
  work: { kind: 'distance', meters: 400 },
  recovery: { kind: 'time', seconds: 60 },
  cooldown: null,
  targetSecondsPerKm: null,
};
const begin = (plan: IntervalPlan): RunState => startRun(T0, 1000, false, false, plan);

beforeEach(() => {
  voicePreferences.update(DEFAULT_VOICE_PREFERENCES);
  jest.clearAllMocks();
});

describe('announceSplit no intervalado', () => {
  it('não fala a parcial: a voz guia as fases', () => {
    const before = begin({ ...PLAN, work: { kind: 'distance', meters: 2000 } });
    const after = applySamples(before, straight(300, 4));
    expect(after.splits).toHaveLength(1);
    announceSplit(before, after);
    expect(speech.speak).not.toHaveBeenCalled();
  });
});

describe('announceIntervals', () => {
  const before = applySamples(begin(PLAN), straight(99, 4));
  const after = applySamples(before, [north(400, 100), north(404, 101)]);

  it('fala a troca de fase em português', () => {
    announceIntervals(before, after);
    expect(speech.speak).toHaveBeenCalledTimes(1);
    expect(speech.speak).toHaveBeenCalledWith(
      'Tiro 1: 1 minuto e 40 segundos, pace 4 minutos e 10 segundos por quilômetro. Recuperação: 1 minuto.',
      { language: 'pt-BR' },
    );
  });

  it('não fala sem nada novo nem com a voz desligada', () => {
    announceIntervals(after, after);
    voicePreferences.update({ enabled: false });
    announceIntervals(before, after);
    expect(speech.speak).not.toHaveBeenCalled();
  });
});

describe('announceFirstPhase', () => {
  it('fala a primeira fase do plano', () => {
    announceFirstPhase(begin(DEFAULT_INTERVAL_PLAN));
    expect(speech.speak).toHaveBeenCalledWith('Aquecimento: 10 minutos.', { language: 'pt-BR' });

    announceFirstPhase(begin(PLAN));
    expect(speech.speak).toHaveBeenLastCalledWith('Tiro 1 de 2: 400 metros.', { language: 'pt-BR' });
  });

  it('calada na corrida livre e com a voz desligada', () => {
    announceFirstPhase(startRun(T0));
    voicePreferences.update({ enabled: false });
    announceFirstPhase(begin(PLAN));
    expect(speech.speak).not.toHaveBeenCalled();
  });
});
