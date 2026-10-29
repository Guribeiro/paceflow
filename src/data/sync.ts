import { storage } from './storage/mmkv';
import { createSyncState } from './sync/sync-state';

export const syncState = createSyncState(storage);
