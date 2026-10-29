import { useEffect, useState, useSyncExternalStore } from 'react';

import { subscribeToAccount } from '../data/cloud';
import { syncState } from '../data/sync';
import type { LastSync } from '../data/sync/sync-state';

/** E-mail da conta conectada; undefined enquanto a sessão carrega. */
export function useAccountEmail(): string | null | undefined {
  const [email, setEmail] = useState<string | null | undefined>(undefined);
  useEffect(() => subscribeToAccount(setEmail), []);
  return email;
}

export function useLastSync(): LastSync | null {
  return useSyncExternalStore(syncState.subscribe, syncState.getLastSync);
}
