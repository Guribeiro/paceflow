import * as Speech from 'expo-speech';

import type { RunState } from '../domain/run-tracker';
import { splitAnnouncement } from '../domain/run-voice';
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
  if (after.splits.length <= before.splits.length) return;
  const text = splitAnnouncement(after, voicePreferences.get());
  if (text) Speech.speak(text, { language: LANGUAGE });
}

/** Amostra para o botão "Ouvir exemplo" dos Ajustes. */
export function previewAnnouncement(splitMeters: number) {
  // Terceira parcial de uma corrida em ~5:10/unidade.
  const sample = { splits: [312_000, 620_000, 925_000], splitMeters };
  const text = splitAnnouncement(sample, { ...voicePreferences.get(), enabled: true });
  Speech.stop();
  if (text) Speech.speak(text, { language: LANGUAGE });
}
