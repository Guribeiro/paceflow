import * as Speech from 'expo-speech';

import type { RunState } from '../domain/run-tracker';
import { expandPhases } from '../domain/interval-plan';
import { autoPauseAnnouncement, intervalAnnouncement, phaseStartText, splitAnnouncement } from '../domain/run-voice';
import { createVoicePreferencesRepository } from './repositories/voice-preferences-repository';
import { storage } from './storage/mmkv';

export const voicePreferences = createVoicePreferencesRepository(storage);

const LANGUAGE = 'pt-BR';

/**
 * Chamado pela tarefa do GPS a cada lote de amostras: fala só quando uma
 * parcial nova fechou. Se fecharem várias de uma vez (GPS voltou depois de
 * um túnel), fala só a última.
 */
export function announceSplit(before: RunState, after: RunState) {
  // No intervalado, a voz guia as fases: as parciais não atropelam.
  if (after.intervals || after.splits.length <= before.splits.length) return;
  const text = splitAnnouncement(after, voicePreferences.get());
  if (text) Speech.speak(text, { language: LANGUAGE });
}

/** Chamado pela tarefa do GPS: avisa quando a pausa automática começa ou termina. */
export function announceAutoPause(before: RunState, after: RunState) {
  const text = autoPauseAnnouncement(before, after, voicePreferences.get());
  if (text) Speech.speak(text, { language: LANGUAGE });
}

/** Chamado pela tarefa do GPS: fases do intervalado, aviso de 10 s e pace na metade do tiro. */
export function announceIntervals(before: RunState, after: RunState) {
  const text = intervalAnnouncement(before, after, voicePreferences.get());
  if (text) Speech.speak(text, { language: LANGUAGE });
}

/** Primeira fase, ao começar o intervalado. */
export function announceFirstPhase(state: RunState) {
  const phase = state.intervals ? expandPhases(state.intervals.plan)[0] : undefined;
  if (!phase || !voicePreferences.get().enabled) return;
  Speech.speak(phaseStartText(phase, state.intervals!.plan.reps), { language: LANGUAGE });
}

/** Amostra para o botão "Ouvir exemplo" dos Ajustes. */
export function previewAnnouncement(splitMeters: number) {
  // Terceira parcial de uma corrida em ~5:10/unidade.
  const sample = { splits: [312_000, 620_000, 925_000], splitMeters };
  const text = splitAnnouncement(sample, { ...voicePreferences.get(), enabled: true });
  Speech.stop();
  if (text) Speech.speak(text, { language: LANGUAGE });
}
