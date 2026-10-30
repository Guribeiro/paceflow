import { useSyncExternalStore } from 'react';

import { routePreference } from '../data/run-session';

export function useKeepRoute(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(routePreference.subscribe, routePreference.get);
  return [value, routePreference.set];
}
