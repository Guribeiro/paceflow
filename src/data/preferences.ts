import { createPreferencesRepository } from './repositories/preferences-repository';
import { storage } from './storage/mmkv';

export const preferencesRepository = createPreferencesRepository(storage);
