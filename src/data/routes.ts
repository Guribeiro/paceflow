import { createRouteRepository } from './repositories/route-repository';
import { storage } from './storage/mmkv';

export const routeRepository = createRouteRepository(storage);
