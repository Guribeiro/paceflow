import { createShoeRepository } from './repositories/shoe-repository';
import { storage } from './storage/mmkv';

export const shoeRepository = createShoeRepository(storage);
