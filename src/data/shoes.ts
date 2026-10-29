import { createShoeRepository } from './repositories/shoe-repository';
import { storage } from './storage/mmkv';
import { shoeSyncState } from './sync';

export const shoeRepository = createShoeRepository(storage, {
  onLocalChange: (ids) => shoeSyncState.markDirty(ids),
});
