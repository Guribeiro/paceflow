import { createPreferencesRepository } from './repositories/preferences-repository';
import { storage } from './storage/mmkv';
import { prefsSyncState } from './sync';

export const preferencesRepository = createPreferencesRepository(storage, {
  onLocalChange: (ids) => prefsSyncState.markDirty(ids),
});
