import { storage } from './storage/mmkv';
import { createSyncState } from './sync/sync-state';

/** Estado do sync dos treinos (chaves originais sync:v1:*). */
export const syncState = createSyncState(storage);
/** Estado do sync dos tênis. */
export const shoeSyncState = createSyncState(storage, 'sync:v1:shoes:');
/** Estado do sync das preferências (unidade, meta, prova). */
export const prefsSyncState = createSyncState(storage, 'sync:v1:prefs:');
