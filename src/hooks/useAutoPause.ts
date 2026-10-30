import { useSyncExternalStore } from 'react';

import { autoPausePreference } from '../data/run-session';

export function useAutoPause(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(autoPausePreference.subscribe, autoPausePreference.get);
  return [value, autoPausePreference.set];
}
