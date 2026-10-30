import { useSyncExternalStore } from 'react';

import { voicePreferences } from '../data/run-voice';
import type { VoicePreferences } from '../domain/run-voice';

export function useVoicePreferences(): [VoicePreferences, (change: Partial<VoicePreferences>) => void] {
  const prefs = useSyncExternalStore(voicePreferences.subscribe, voicePreferences.get);
  return [prefs, voicePreferences.update];
}
